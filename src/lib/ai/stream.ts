import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const FLUSH_INTERVAL_MS = 150

const ERROR_CONTENT =
  "I'm having trouble responding right now. Please try again."

/**
 * Creates a debounced updater that accumulates streamed tokens and flushes
 * them to the AI message row in Supabase at a throttled interval.
 *
 * Uses the service-role client to bypass RLS (AI messages have sender_id=null).
 */
export function createMessageUpdater(
  supabase: SupabaseClient<Database>,
  messageId: string
) {
  let content = ''
  let lastFlush = 0

  /** Flush current content to the database. */
  async function flush() {
    lastFlush = Date.now()
    await supabase
      .from('messages')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
  }

  return {
    /**
     * Append a text delta. Flushes to Supabase at most every 150ms
     * so Realtime pushes updates to all clients without overwhelming the DB.
     */
    async append(delta: string) {
      content += delta
      if (Date.now() - lastFlush >= FLUSH_INTERVAL_MS) {
        await flush()
      }
    },

    /** Final flush: write complete content and set status to 'delivered'. */
    async finish() {
      await supabase
        .from('messages')
        .update({
          content,
          status: 'delivered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
    },

    /** On failure: write error message and set status to 'error'. */
    async error() {
      await supabase
        .from('messages')
        .update({
          content: ERROR_CONTENT,
          status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
    },
  }
}