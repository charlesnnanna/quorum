import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { buildAIContext } from '@/lib/ai/context'
import { createMessageUpdater } from '@/lib/ai/stream'
import { checkAIRateLimit } from '@/lib/ai/ratelimit'

/** Netlify free-tier function timeout. */
export const maxDuration = 26

/**
 * Streaming AI chat endpoint.
 *
 * Called AFTER the server action has already:
 * 1. Inserted the user's message (status: 'delivered')
 * 2. Inserted an AI placeholder message (status: 'sending', content: '')
 *
 * This handler streams Gemini's response token-by-token, updating the
 * AI message row in Supabase as it goes. Supabase Realtime pushes each
 * UPDATE to all connected clients so everyone sees the stream.
 */
export async function POST(req: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── 2. Parse request body ──────────────────────────────────────────
  let body: { roomId: string; aiMessageId: string; currentMessage: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { roomId, aiMessageId, currentMessage } = body
  if (!roomId || !aiMessageId || !currentMessage) {
    return new Response('Missing required fields: roomId, aiMessageId, currentMessage', { status: 400 })
  }

  // ── 3. Authorization — verify room membership ──────────────────────
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── 4. Rate limit — max 1 AI invocation per user per 10 seconds ────
  const { allowed, retryAfterMs } = checkAIRateLimit(session.user.id)
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limited',
        retryAfterMs,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        },
      }
    )
  }

  // ── 5. Build context window (fetches history, truncates, summarizes) ─
  const serviceClient = createServiceRoleClient()
  const updater = createMessageUpdater(serviceClient, aiMessageId)

  let context: Awaited<ReturnType<typeof buildAIContext>>

  try {
    context = await buildAIContext(roomId, currentMessage)
  } catch {
    // If context building fails entirely, mark the AI message as error
    await updater.error()
    return new Response('Context building failed', { status: 500 })
  }

  // ── 6. Stream from Gemini, updating Supabase as tokens arrive ──────
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const result = streamText({
          model: google('gemini-1.5-flash'),
          system: context.systemPrompt,
          messages: context.messages,
        })

        for await (const delta of result.textStream) {
          // Send token to the requesting client
          controller.enqueue(encoder.encode(delta))

          // Update the AI message row → Supabase Realtime → all clients
          await updater.append(delta)
        }

        // Final: mark delivered with complete content
        await updater.finish()
        controller.close()
      } catch {
        // Gemini failure: update message to error state
        await updater.error()
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}