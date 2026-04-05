'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'
import { messageSchema } from '@/lib/validations/message'
import type { Message, MessageSearchResult, ServerActionResponse } from '@/types'

/** Insert a new human message into a room. */
export async function sendMessage(input: unknown): Promise<ServerActionResponse<Message>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  const parsed = messageSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: 'Invalid input' }

  const supabase = createServiceRoleClient()

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
      ...(parsed.data.metadata ? { metadata: parsed.data.metadata as Json } : {}),
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Message, error: null }
}

/**
 * Insert an AI placeholder message (status: 'sending', content: '').
 * Must use the service role client because RLS only allows human messages
 * from the browser client (sender_type='human', sender_id=auth.uid()).
 */
export async function createAIPlaceholder(roomId: string): Promise<ServerActionResponse<Message>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  if (!roomId) return { data: null, error: 'Room ID is required' }

  const supabase = createServiceRoleClient()

  // Verify membership
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) return { data: null, error: 'Not a member of this room' }

  const { data, error } = await supabase
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