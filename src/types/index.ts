import type { Tables } from '@/lib/supabase/types'

// ── Row types from Supabase ────────────────────────────────────────
export type Profile = Tables<'profiles'>
export type Room = Tables<'rooms'>
export type RoomMember = Tables<'room_members'>
/** Messages always have created_at and status (DB defaults). Override nullability. */
export type Message = Omit<Tables<'messages'>, 'created_at' | 'status'> & {
  created_at: string
  status: string
}

// ── Enums ──────────────────────────────────────────────────────────
export type MessageStatus = 'sending' | 'delivered' | 'error'
export type SenderType = 'human' | 'ai'
export type RoomRole = 'owner' | 'member'

// ── Composite types ───────────────────────────────────────────────
/** Returned by the `get_user_rooms` Postgres function. */
export type RoomWithDetails = {
  room_id: string
  room_name: string
  room_description: string | null
  is_private: boolean
  created_by: string
  room_created_at: string
  user_role: string
  member_count: number
  last_message_id: string | null
  last_message_content: string | null
  last_message_sender: string | null
  last_message_type: string | null
  last_message_at: string | null
}

/** Returned by the `search_messages` Postgres function. */
export type MessageSearchResult = {
  id: string
  room_id: string
  sender_id: string | null
  sender_type: string
  content: string
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  rank: number
  sender_username: string | null
  sender_avatar: string | null
}

// ── Server Action response ─────────────────────────────────────────
export type ServerActionResponse<T> = {
  data: T | null
  error: string | null
}
