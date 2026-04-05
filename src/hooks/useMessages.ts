import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMessageStore } from '@/lib/stores/messageStore'
import { sendMessage as sendMessageAction } from '@/lib/actions/messages'
import type { Message } from '@/types'

const PAGE_SIZE = 50
const EMPTY_MESSAGES: Message[] = []

// Stable action references from the Zustand store factory — never change.
const {
  setMessages,
  addMessage,
  updateMessage,
  prependMessages,
} = useMessageStore.getState()

/**
 * Subscribes to real-time messages for a room and manages pagination.
 *
 * - On mount: seeds Zustand with `initialMessages` (from server) and subscribes
 *   to Supabase Realtime for INSERT/UPDATE events on the messages table.
 * - `sendMessage`: calls the server action, waits for confirmation, then adds
 *   the message to the store. Returns `isSending` state for loading UI.
 * - `loadMore`: fetches the next page of older messages using cursor-based
 *   pagination (created_at < oldest message's created_at).
 * - Cleans up the Realtime channel on unmount or when roomId changes.
 */
export function useMessages(roomId: string, initialMessages: Message[]) {
  const messages = useMessageStore(
    (state) => state.messagesByRoom[roomId] ?? EMPTY_MESSAGES
  )

  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE)

  // Track server-confirmed message IDs so the Realtime INSERT handler
  // can skip duplicates for messages we already added after the server action.
  const confirmedIds = useRef<Set<string>>(new Set())

  // Seed the store once per room during render so there is never an async gap
  // where the store is empty. On same-room re-renders (RSC refresh after a
  // server action) we skip — the store already has the message because
  // sendMessage adds it via addMessage after server confirmation.
  const seededForRoom = useRef<string | null>(null)

  if (seededForRoom.current !== roomId) {
    const existing = useMessageStore.getState().messagesByRoom[roomId]
    if (!existing || existing.length === 0) {
      setMessages(roomId, initialMessages)
    }
    seededForRoom.current = roomId
  }

  // Set up Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const incoming = payload.new

          // Skip if we already added this message from the server action response
          if (confirmedIds.current.has(incoming.id)) {
            confirmedIds.current.delete(incoming.id)
            return
          }

          addMessage(roomId, incoming)
        }
      )
      .on<Message>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          updateMessage(roomId, payload.new.id, payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  /**
   * Send a message — waits for server confirmation before it appears in chat.
   * Sets `isSending` to true while the request is in flight.
   */
  const sendMessage = useCallback(
    async (content: string, _senderId: string): Promise<{ error: string | null }> => {
      setIsSending(true)

      try {
        const { data, error } = await sendMessageAction({
          content,
          roomId,
        })

        if (error || !data) {
          return { error: error ?? 'Failed to send message' }
        }

        // Mark as confirmed so Realtime INSERT handler skips the duplicate
        confirmedIds.current.add(data.id)
        addMessage(roomId, data)
        return { error: null }
      } finally {
        setIsSending(false)
      }
    },
    [roomId]
  )

  /**
   * Reconcile local state with server after a reconnection.
   *
   * **Important:** The browser Supabase client may not have a Supabase auth
   * session (when auth is handled by BetterAuth). In that case RLS blocks
   * the SELECT and returns zero rows. We must NOT wipe the store.
   */
  const reconcile = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (data && !error) {
      const fresh = (data as Message[]).reverse()

      // Guard: if the query returned zero rows but the store has messages,
      // this is likely an RLS/auth issue — do NOT wipe the store.
      const currentMessages = useMessageStore.getState().messagesByRoom[roomId] ?? []
      if (fresh.length === 0 && currentMessages.length > 0) {
        return
      }

      setMessages(roomId, fresh)
    }
  }, [roomId])

  /** Fetch the next page of older messages (cursor-based). */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    const currentMessages = useMessageStore.getState().messagesByRoom[roomId]
    if (!currentMessages?.length) return

    const oldestMessage = currentMessages[0]!
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) {
        console.error('Failed to load more messages:', error.message)
        return
      }

      const older = (data as Message[]).reverse()
      if (older.length > 0) {
        prependMessages(roomId, older)
      }
      if (older.length < PAGE_SIZE) {
        setHasMore(false)
      }
    } finally {
      setIsLoading(false)
    }
  }, [roomId, isLoading, hasMore])

  return { messages, isLoading, isSending, loadMore, hasMore, sendMessage, reconcile }
}