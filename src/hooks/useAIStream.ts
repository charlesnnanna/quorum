import { useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAIStore } from '@/lib/stores/aiStore'

const AI_MENTION_REGEX = /@ai\b/i

/** Show "AI is taking longer than usual" after this many ms. */
const SLOW_THRESHOLD_MS = 10_000
/** Hard cancel the AI request after this many ms. */
const TIMEOUT_MS = 30_000

interface UseAIStreamOptions {
  roomId: string
  userId: string
}

/**
 * Orchestrates the full AI invocation flow:
 *
 * 1. Client-side rate-limit check (instant UX feedback).
 * 2. Insert an AI placeholder message (status: 'sending', content: '').
 *    → Supabase Realtime broadcasts the INSERT → all clients show "AI typing…"
 * 3. POST to `/api/ai/chat` with { roomId, aiMessageId, currentMessage }.
 *    → Route handler streams Gemini tokens, updating the placeholder row.
 *    → Supabase Realtime broadcasts each UPDATE → all clients see the stream.
 * 4. On 429 (server rate limit): mark placeholder as error.
 * 5. On network/stream failure: mark placeholder as error.
 *
 * **Concurrency model — why we allow parallel invocations:**
 * Multiple users can invoke @ai in the same room simultaneously. Each invocation
 * creates its own placeholder and streams independently. This is better than a
 * global queue because no user has to wait for another user's response to finish.
 * The per-user rate limit (10s cooldown) prevents any single user from spamming.
 *
 * Returns:
 * - `streamAI(messageContent)` — call after the user's message is inserted.
 * - `isStreaming` — ref-based, true while a stream is in flight.
 * - `canInvoke()` — checks the client-side rate limit.
 */
export function useAIStream({ roomId, userId }: UseAIStreamOptions) {
  const isStreamingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { canInvoke, recordInvocation, markSlow, clearSlow } = useAIStore()

  /**
   * Trigger the AI flow. Call this AFTER the user's human message has been
   * inserted via the sendMessage server action.
   *
   * @returns `{ error }` — null on success, string on failure.
   */
  const streamAI = useCallback(
    async (messageContent: string): Promise<{ error: string | null }> => {
      // ── 1. Client-side rate limit ─────────────────────────────────
      const { allowed, retryAfterMs } = canInvoke(userId)
      if (!allowed) {
        const seconds = Math.ceil(retryAfterMs / 1000)
        return { error: `Please wait ${seconds}s before invoking AI again.` }
      }

      if (isStreamingRef.current) {
        return { error: 'AI is already responding.' }
      }

      isStreamingRef.current = true
      recordInvocation(userId)

      // ── 2. Insert AI placeholder ──────────────────────────────────
      const supabase = createClient()

      const { data: placeholder, error: insertError } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          sender_id: null,
          sender_type: 'ai',
          content: '',
          status: 'sending',
        })
        .select()
        .single()

      if (insertError || !placeholder) {
        isStreamingRef.current = false
        return { error: 'Failed to create AI message.' }
      }

      // ── 3. POST to streaming endpoint with timeout ───────────────
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Timer: mark as slow after 10s
      const slowTimer = setTimeout(() => {
        markSlow(placeholder.id)
      }, SLOW_THRESHOLD_MS)

      // Timer: hard cancel after 30s
      const timeoutTimer = setTimeout(() => {
        abortController.abort()
      }, TIMEOUT_MS)

      const cleanup = () => {
        clearTimeout(slowTimer)
        clearTimeout(timeoutTimer)
        clearSlow(placeholder.id)
        abortControllerRef.current = null
        isStreamingRef.current = false
      }

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            aiMessageId: placeholder.id,
            currentMessage: messageContent,
          }),
          signal: abortController.signal,
        })

        if (response.status === 429) {
          await supabase
            .from('messages')
            .update({
              content: 'Rate limited — please wait a moment before invoking AI again.',
              status: 'error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', placeholder.id)

          cleanup()
          return { error: 'Rate limited by server.' }
        }

        if (!response.ok) {
          await supabase
            .from('messages')
            .update({
              content: "I'm having trouble responding right now. Please try again.",
              status: 'error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', placeholder.id)

          cleanup()
          return { error: 'AI request failed.' }
        }

        // Consume the stream — content updates happen server-side via
        // Supabase Realtime. We drain to keep the connection alive.
        const reader = response.body?.getReader()
        if (reader) {
          while (true) {
            const { done } = await reader.read()
            if (done) break
          }
        }

        cleanup()
        return { error: null }
      } catch (err) {
        const isTimeout =
          err instanceof DOMException && err.name === 'AbortError'

        await supabase
          .from('messages')
          .update({
            content: isTimeout
              ? 'AI took too long to respond. Please try again.'
              : "I'm having trouble responding right now. Please try again.",
            status: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', placeholder.id)

        cleanup()
        return {
          error: isTimeout ? 'AI request timed out.' : 'Network error.',
        }
      }
    },
    [roomId, userId, canInvoke, recordInvocation, markSlow, clearSlow]
  )

  /** Check whether this user can currently invoke AI (client-side). */
  const checkCanInvoke = useCallback(
    () => canInvoke(userId),
    [userId, canInvoke]
  )

  return {
    streamAI,
    /** Whether an AI stream is currently in flight. */
    get isStreaming() {
      return isStreamingRef.current
    },
    canInvoke: checkCanInvoke,
    hasAIMention: (text: string) => AI_MENTION_REGEX.test(text),
  }
}