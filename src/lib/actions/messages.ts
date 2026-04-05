'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { messageSchema } from '@/lib/validations/message'
import type { Message, MessageSearchResult, ServerActionResponse } from '@/types'

/** Insert a new human message into a room. */
export async function sendMessage(input: unknown): Promise<ServerActionResponse<Message>> {
  const supabase = await createServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: null, error: 'Unauthorized' }

  const parsed = messageSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: 'Invalid input' }

  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', parsed.data.roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) return { data: null, error: 'Not a member of this room' }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: parsed.data.roomId,
      sender_id: session.user.id,
      sender_type: 'human',
      content: parsed.data.content,
      status: 'delivered',
      ...(parsed.data.metadata ? { metadata: parsed.data.metadata } : {}),
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Message, error: null }
}

/**
 * Full-text search messages within a room.
 * Uses the `search_messages` Postgres function with ts_vector + GIN index.
 * Returns results ranked by relevance with sender profile info.
 */
export async function searchMessages(
  roomId: string,
  query: string
): Promise<ServerActionResponse<MessageSearchResult[]>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  if (!query || query.trim().length < 2) return { data: [], error: null }

  const supabase = createServiceRoleClient()

  // Verify user is a member of this room
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) return { data: null, error: 'Not a member of this room' }

  const { data, error } = await supabase.rpc('search_messages', {
    p_room_id: roomId,
    p_query: query.trim(),
    p_limit: 50,
  })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as MessageSearchResult[], error: null }
}