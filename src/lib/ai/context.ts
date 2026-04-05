import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import type { ModelMessage } from 'ai'
import { createServiceRoleClient } from '@/lib/supabase/server'

const CHARS_PER_TOKEN = 4
const DEFAULT_MAX_TOKENS = 6000
const MAX_MESSAGES_TO_FETCH = 50

const SYSTEM_PROMPT = `You are Quorum AI, a professional team workspace assistant. You participate in team conversations when summoned with @ai.

Rules:
- Be concise and helpful. Prefer short, direct answers over lengthy explanations.
- You have full awareness of the conversation context — reference earlier messages naturally.
- Respond as a knowledgeable team member, not a chatbot. No "How can I help you today?" filler.
- Use markdown formatting when it improves readability (code blocks, lists, bold).
- If the conversation context is insufficient to answer, say so honestly.`

interface DBMessage {
  sender_type: string
  content: string
  sender_id: string | null
}

/**
 * Rough token estimate for an array of messages.
 *
 * Uses the rule of thumb that 1 token ≈ 4 characters. This is intentionally
 * imprecise — a proper tokenizer (tiktoken) would add a dependency for minimal
 * gain, since the estimate only drives a summarize-or-not decision, not billing.
 *
 * **Tradeoff:**
 * - Too little context → AI gives irrelevant responses, misses prior decisions.
 * - Too much context → expensive, slow, risks hitting API rate/size limits.
 * - Estimation error → worst case we summarize one round too early or too late,
 *   both of which are acceptable.
 */
export function estimateTokens(messages: DBMessage[]): number {
  return messages.reduce(
    (sum, m) => sum + Math.ceil(m.content.length / CHARS_PER_TOKEN),
    0
  )
}

/**
 * Truncate a message array to fit within a token budget, keeping the most
 * recent messages (which are the most relevant to the current question).
 *
 * Walks backwards from the newest message, accumulating tokens until the
 * budget is exhausted, then returns the surviving slice in chronological order.
 *
 * **Tradeoff:**
 * - Too little context → AI loses thread of the conversation.
 * - Too much context → slower response, higher cost, possible API rejection.
 * - Prioritizing recency → the AI may forget decisions made early in a long
 *   conversation, which is why `summarizeOldMessages` exists as a companion.
 */
export function truncateToContextWindow(
  messages: DBMessage[],
  maxTokens: number = DEFAULT_MAX_TOKENS
): { kept: DBMessage[]; dropped: DBMessage[] } {
  let budget = maxTokens
  let cutoff = messages.length

  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = Math.ceil(messages[i].content.length / CHARS_PER_TOKEN)
    if (budget - cost < 0) break
    budget -= cost
    cutoff = i
  }

  return {
    kept: messages.slice(cutoff),
    dropped: messages.slice(0, cutoff),
  }
}

/**
 * Summarize older messages into a 2–3 sentence digest using a fast,
 * non-streaming Gemini call.
 *
 * Called only when the full conversation exceeds the token budget. The summary
 * is injected into the system prompt so the AI retains awareness of early
 * discussion without consuming the full token window.
 *
 * **Tradeoff:**
 * - Skipping summarization → AI has zero memory of dropped messages; may
 *   contradict earlier decisions or re-ask resolved questions.
 * - Summarizing → adds one extra (cheap, fast) Gemini call but captures the
 *   gist of history in ~50 tokens instead of thousands.
 * - The summary is lossy by design: fine-grained details are sacrificed for
 *   a compact representation that fits alongside the recent messages.
 */
export async function summarizeOldMessages(
  messages: DBMessage[]
): Promise<string> {
  if (messages.length === 0) return ''

  const transcript = messages
    .map(
      (m) =>
        `${m.sender_type === 'ai' ? 'AI' : 'User'}: ${m.content}`
    )
    .join('\n')

  const { text } = await generateText({
    model: google('gemini-1.5-flash'),
    prompt: `Summarize this team conversation in 2–3 sentences. Preserve key topics, decisions, and any open questions:\n\n${transcript}`,
  })

  return text
}

/**
 * Orchestrate the full context-building pipeline for an AI invocation.
 *
 * 1. Fetch the last 50 messages for the room from Supabase.
 * 2. Estimate total tokens.
 * 3. If within budget → format and return all messages.
 * 4. If over budget → truncate to fit, summarize the dropped portion,
 *    and prepend the summary to the system prompt.
 *
 * Returns the system prompt and a `ModelMessage[]` ready for `streamText`.
 *
 * **Tradeoff:**
 * - Too little context → AI gives irrelevant responses.
 * - Too much context → expensive, slow, hits API limits.
 * - Summarization → best of both — captures history cheaply while keeping
 *   recent messages verbatim for precision.
 */
export async function buildAIContext(
  roomId: string,
  currentMessage: string
): Promise<{
  systemPrompt: string
  messages: ModelMessage[]
}> {
  // ── Fetch conversation history ──────────────────────────────────────
  const supabase = createServiceRoleClient()

  const { data: rows } = await supabase
    .from('messages')
    .select('sender_type, content, sender_id')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES_TO_FETCH)

  const history: DBMessage[] = rows ?? []

  // Append the current user message (it may not be in the DB yet when
  // this runs, depending on timing)
  const allMessages: DBMessage[] = [
    ...history,
    { sender_type: 'human', content: currentMessage, sender_id: null },
  ]

  // ── Check token budget ──────────────────────────────────────────────
  const totalTokens = estimateTokens(allMessages)

  if (totalTokens <= DEFAULT_MAX_TOKENS) {
    return {
      systemPrompt: SYSTEM_PROMPT,
      messages: formatForSDK(allMessages),
    }
  }

  // ── Over budget: truncate + summarize ───────────────────────────────
  const { kept, dropped } = truncateToContextWindow(
    allMessages,
    DEFAULT_MAX_TOKENS
  )

  let systemPrompt = SYSTEM_PROMPT

  if (dropped.length > 0) {
    try {
      const summary = await summarizeOldMessages(dropped)
      systemPrompt = `${SYSTEM_PROMPT}\n\nEarlier conversation summary:\n${summary}`
    } catch {
      // If summarization fails, proceed without it — truncated context
      // is better than no response at all.
    }
  }

  return {
    systemPrompt,
    messages: formatForSDK(kept),
  }
}

/** Convert database messages to Vercel AI SDK ModelMessage format. */
function formatForSDK(messages: DBMessage[]): ModelMessage[] {
  return messages.map((m) => ({
    role:
      m.sender_type === 'ai'
        ? ('assistant' as const)
        : ('user' as const),
    content: m.content,
  }))
}