'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createRoomSchema, inviteUserSchema } from '@/lib/validations/room'
import type { Room, RoomWithDetails, ServerActionResponse, Profile } from '@/types'

/**
 * Create a new room and add the creator as owner.
 */
export async function createRoom(input: unknown): Promise<ServerActionResponse<Room>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  const parsed = createRoomSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = createServiceRoleClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_private: parsed.data.isPrivate,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (roomError) return { data: null, error: roomError.message }

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: session.user.id,
      role: 'owner',
    })

  if (memberError) return { data: null, error: memberError.message }

  return { data: room as Room, error: null }
}

/**
 * Fetch all rooms the current user is a member of, with last message info.
 */
export async function getRooms(): Promise<ServerActionResponse<RoomWithDetails[]>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc('get_user_rooms', {
    p_user_id: session.user.id,
  })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as RoomWithDetails[], error: null }
}

/**
 * Add a user to a room. Only room owners/members can invite.
 * Sends a system message announcing the new member.
 */
export async function addRoomMember(input: unknown): Promise<ServerActionResponse<{ success: boolean }>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  const parsed = inviteUserSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: 'Invalid input' }

  const supabase = createServiceRoleClient()

  // Verify inviter is a member of the room
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', parsed.data.roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) return { data: null, error: 'You are not a member of this room' }

  // Check if target user is already a member
  const { data: existing } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', parsed.data.roomId)
    .eq('user_id', parsed.data.userId)
    .single()

  if (existing) return { data: null, error: 'User is already a member' }

  // Add the member
  const { error: insertError } = await supabase
    .from('room_members')
    .insert({
      room_id: parsed.data.roomId,
      user_id: parsed.data.userId,
      role: 'member',
    })

  if (insertError) return { data: null, error: insertError.message }

  // Get the invited user's profile for the system message
  const { data: invitedProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', parsed.data.userId)
    .single()

  // Send a system message announcing the new member
  if (invitedProfile) {
    await supabase.from('messages').insert({
      room_id: parsed.data.roomId,
      sender_id: null,
      sender_type: 'ai',
      content: `${invitedProfile.username} was added to the room.`,
      status: 'delivered',
      metadata: { type: 'system', action: 'member_added', userId: parsed.data.userId },
    })
  }

  return { data: { success: true }, error: null }
}

/**
 * Search users by username for the invite modal.
 * Excludes users already in the specified room.
 */
export async function searchUsers(
  query: string,
  roomId: string
): Promise<ServerActionResponse<Profile[]>> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return { data: null, error: 'Unauthorized' }

  if (!query || query.length < 2) return { data: [], error: null }

  const supabase = createServiceRoleClient()

  // Get current room members to exclude them
  const { data: members } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)

  const memberIds = (members ?? []).map((m) => m.user_id)

  // Search profiles by username (case-insensitive)
  let q = supabase
    .from('profiles')
    .select()
    .ilike('username', `%${query}%`)
    .limit(10)

  if (memberIds.length > 0) {
    q = q.not('id', 'in', `(${memberIds.join(',')})`)
  }

  const { data, error } = await q

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as Profile[], error: null }
}