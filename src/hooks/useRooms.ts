import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRooms as fetchRooms } from '@/lib/actions/rooms'
import type { RoomWithDetails } from '@/types'

/**
 * Fetches and subscribes to real-time updates for the current user's rooms.
 *
 * - On mount: fetches rooms via the `getRooms` server action.
 * - Subscribes to Supabase Realtime for INSERT/UPDATE/DELETE on `rooms`,
 *   `room_members`, and `messages` tables to refresh the room list when
 *   membership, room details, or last messages change.
 * - Optimistically increments unread counts for non-active rooms when new
 *   messages arrive via Realtime.
 * - Returns the room list sorted by most recent activity.
 */
export function useRooms(initialRooms?: RoomWithDetails[], activeRoomId?: string | null) {
  const [rooms, setRooms] = useState<RoomWithDetails[]>(initialRooms ?? [])
  const [isLoading, setIsLoading] = useState(!initialRooms)
  const hasFetched = useRef(false)

  const refresh = useCallback(async () => {
    const { data, error } = await fetchRooms()
    if (!error && data) {
      setRooms(data)
    }
  }, [])

  // Initial fetch if no initialRooms provided
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    if (initialRooms) {
      setRooms(initialRooms)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    refresh().finally(() => setIsLoading(false))
  }, [initialRooms, refresh])

  // Subscribe to realtime changes that affect the room list.
  // Use a unique channel name per hook instance so multiple sidebar mounts
  // (e.g. tablet compact + desktop full, both rendered but CSS-hidden) don't
  // conflict by adding callbacks to the same already-subscribed channel.
  const channelIdRef = useRef<string | null>(null)

  // Keep a ref to activeRoomId so the realtime callback always sees the latest value
  const activeRoomIdRef = useRef(activeRoomId)
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    if (!channelIdRef.current) {
      channelIdRef.current = crypto.randomUUID()
    }
    const supabase = createClient()

    const channel = supabase
      .channel(`rooms-list-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => { refresh() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => { refresh() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as { room_id?: string; content?: string; sender_type?: string; created_at?: string }
          const msgRoomId = newMsg.room_id

          // Optimistically update the room's unread count and last message preview
          if (msgRoomId && msgRoomId !== activeRoomIdRef.current) {
            setRooms((prev) =>
              prev.map((room) =>
                room.room_id === msgRoomId
                  ? {
                      ...room,
                      unread_count: room.unread_count + 1,
                      last_message_content: newMsg.content ?? room.last_message_content,
                      last_message_at: newMsg.created_at ?? room.last_message_at,
                      last_message_type: newMsg.sender_type ?? room.last_message_type,
                    }
                  : room
              )
            )
          } else {
            // Active room — just update the last message preview
            refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  // When the user navigates to a room, optimistically clear its unread count
  useEffect(() => {
    if (!activeRoomId) return
    setRooms((prev) =>
      prev.map((room) =>
        room.room_id === activeRoomId && room.unread_count > 0
          ? { ...room, unread_count: 0 }
          : room
      )
    )
  }, [activeRoomId])

  /** Sorted by most recent activity (last_message_at or room_created_at). */
  const sortedRooms = [...rooms].sort((a, b) => {
    const aTime = a.last_message_at ?? a.room_created_at
    const bTime = b.last_message_at ?? b.room_created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return { rooms: sortedRooms, isLoading, refresh }
}