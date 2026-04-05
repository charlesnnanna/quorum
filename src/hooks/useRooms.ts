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
 * - Returns the room list sorted by most recent activity.
 */
export function useRooms(initialRooms?: RoomWithDetails[]) {
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
        () => { refresh() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  /** Sorted by most recent activity (last_message_at or room_created_at). */
  const sortedRooms = [...rooms].sort((a, b) => {
    const aTime = a.last_message_at ?? a.room_created_at
    const bTime = b.last_message_at ?? b.room_created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return { rooms: sortedRooms, isLoading, refresh }
}