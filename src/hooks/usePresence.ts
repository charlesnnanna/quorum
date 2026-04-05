import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresenceUser {
  userId: string
  username: string
  avatarUrl: string | null
}

interface PresenceState {
  userId: string
  username: string
  avatarUrl: string | null
  isTyping: boolean
}

const TYPING_TIMEOUT_MS = 2000

/**
 * Manages ephemeral presence for a room via Supabase Realtime Presence.
 *
 * Tracks two things on a single channel:
 * 1. **Who is online** in this room (everyone who has joined the channel).
 * 2. **Who is typing** (users whose presence state has `isTyping: true`).
 *
 * Typing is debounced: calling `startTyping()` sets `isTyping: true` in presence,
 * and automatically resets to `false` after 2 seconds of inactivity.
 *
 * All state is ephemeral — stored only in the Realtime channel, never in the DB.
 * When a user disconnects, their presence is removed automatically by the server.
 */
export function usePresence(
  roomId: string,
  currentUser: PresenceUser | null
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([])

  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  useEffect(() => {
    if (!currentUser) return

    const supabase = createClient()

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: currentUser.userId } },
    })

    channelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>()

      const online: PresenceUser[] = []
      const typing: PresenceUser[] = []

      Object.values(state).forEach((presences) => {
        // Each key may have multiple presences; take the first
        const p = presences[0]
        if (!p) return

        const user: PresenceUser = {
          userId: p.userId,
          username: p.username,
          avatarUrl: p.avatarUrl,
        }

        online.push(user)

        if (p.isTyping && p.userId !== currentUser.userId) {
          typing.push(user)
        }
      })

      setOnlineUsers(online)
      setTypingUsers(typing)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: currentUser.userId,
          username: currentUser.username,
          avatarUrl: currentUser.avatarUrl,
          isTyping: false,
        } satisfies PresenceState)
      }
    })

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      isTypingRef.current = false
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, currentUser])

  /**
   * Call this on every keystroke in the message input.
   * It sets isTyping=true in presence, then auto-resets to false after 2s of
   * no further calls (debounce).
   */
  const startTyping = useCallback(() => {
    if (!channelRef.current || !currentUser) return

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Only send a track update if we weren't already typing
    if (!isTypingRef.current) {
      isTypingRef.current = true
      channelRef.current.track({
        userId: currentUser.userId,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        isTyping: true,
      } satisfies PresenceState)
    }

    // After 2s of inactivity, stop typing
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      channelRef.current?.track({
        userId: currentUser.userId,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        isTyping: false,
      } satisfies PresenceState)
    }, TYPING_TIMEOUT_MS)
  }, [currentUser])

  /** Immediately stop the typing indicator (e.g. after sending a message). */
  const stopTyping = useCallback(() => {
    if (!channelRef.current || !currentUser) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (isTypingRef.current) {
      isTypingRef.current = false
      channelRef.current.track({
        userId: currentUser.userId,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        isTyping: false,
      } satisfies PresenceState)
    }
  }, [currentUser])

  return { onlineUsers, typingUsers, startTyping, stopTyping }
}

/**
 * Returns true if a given userId is in the onlineUsers list.
 * Convenience for the PresenceDot component when it receives
 * the onlineUsers array from a parent.
 */
export function isUserOnline(onlineUsers: PresenceUser[], userId: string): boolean {
  return onlineUsers.some((u) => u.userId === userId)
}

export type { PresenceUser }
