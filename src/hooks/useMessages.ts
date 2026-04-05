import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMessageStore } from '@/lib/stores/messageStore'
import { sendMessage as sendMessageAction } from '@/lib/actions/messages'
import type { Message } from '@/types'

const PAGE_SIZE = 50
const TEMP_ID_PREFIX = 'temp_'

interface QueuedMessage {
  tempId: string
  content: string
  senderId: string
}

/**
 * Subscribes to real-time messages for a room and manages pagination.
 *
 * - On mount: seeds Zustand with `initialMessages` (from server) and subscribes
 *   to Supabase Realtime for INSERT/UPDATE events on the messages table.
 * - `sendMessage`: optimistically adds the message with status='sending',
 *   then confirms or marks as 'error' after the server responds.
 * - `retrySendMessage`: retries a failed optimistic message.
 * - `loadMore`: fetches the next page of older messages using cursor-based
 *   pagination (created_at < oldest message's created_at).
 * - Cleans up the Realtime channel on unmount or when roomId changes.
 */
export function useMessages(roomId: string, initialMessages: Message[]) {
  const {
    setMessages,
    addMessage,
    updateMessage,
    replaceMessage,
    prependMessages,
  } = useMessageStore()
  const messages = useMessageStore(
    (state) => state.messagesByRoom[roomId] ?? []
  )

  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE)

  // Track whether we've seeded the store for this room
  const seededRoomRef = useRef<string | null>(null)

  // Track temp IDs that are pending server confirmation so the Realtime
  // INSERT handler can skip duplicates for our own messages.
  const pendingTempIds = useRef<Map<string, string>>(new Map())

  // Queue of messages that failed to send due to connectivity issues.
  // These are flushed when the connection is restored.
  const messageQueue = useRef<QueuedMessage[]>([])

  // Seed the store with server-fetched messages once per room
  useEffect(() => {
    if (seededRoomRef.current !== roomId) {
      setMessages(roomId, initialMessages)
      setHasMore(initialMessages.length >= PAGE_SIZE)
      seededRoomRef.current = roomId
    }
  }, [roomId, initialMessages, setMessages])

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

          // Check if this INSERT is the server echo of our own optimistic message.
          // If so, replace the temp message instead of adding a duplicate.
          let matchedTempId: string | null = null
          pendingTempIds.current.forEach((serverId, tempId) => {
            if (serverId === incoming.id) {
              matchedTempId = tempId
            }
          })

          if (matchedTempId) {
            replaceMessage(roomId, matchedTempId, incoming)
            pendingTempIds.current.delete(matchedTempId)
          } else {
            addMessage(roomId, incoming)
          }
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
  }, [roomId, addMessage, updateMessage, replaceMessage])

  /**
   * Send a message optimistically.
   * Adds a temp message to the store immediately, then calls the server action.
   * On success the temp message is replaced with the confirmed one (or by the
   * Realtime INSERT, whichever arrives first). On failure the message is marked
   * with status='error'. If offline, queues the message for later.
   */
  const sendMessage = useCallback(
    async (content: string, senderId: string): Promise<{ error: string | null }> => {
      const tempId = `${TEMP_ID_PREFIX}${crypto.randomUUID()}`

      const optimistic: Message = {
        id: tempId,
        room_id: roomId,
        sender_id: senderId,
        sender_type: 'human',
        content,
        status: 'sending',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      addMessage(roomId, optimistic)

      // If offline, queue for later
      if (!navigator.onLine) {
        messageQueue.current.push({ tempId, content, senderId })
        return { error: null }
      }

      const { data, error } = await sendMessageAction({
        content,
        roomId,
      })

      if (error || !data) {
        // If the error is a connectivity issue, queue instead of marking error
        if (!navigator.onLine) {
          messageQueue.current.push({ tempId, content, senderId })
          return { error: null }
        }
        updateMessage(roomId, tempId, { status: 'error' })
        return { error: error ?? 'Failed to send message' }
      }

      // Register the mapping so the Realtime INSERT handler can reconcile.
      pendingTempIds.current.set(tempId, data.id)

      // Also replace immediately in case the Realtime event already fired
      // before we registered (or arrives late). replaceMessage is a no-op
      // if the tempId no longer exists in the store.
      replaceMessage(roomId, tempId, data)
      return { error: null }
    },
    [roomId, addMessage, updateMessage, replaceMessage]
  )

  /**
   * Retry sending a message that previously failed.
   * Resets status to 'sending' and re-attempts the server action.
   */
  const retrySendMessage = useCallback(
    async (messageId: string) => {
      const current = useMessageStore.getState().messagesByRoom[roomId]
      const failed = current?.find((m) => m.id === messageId)
      if (!failed || failed.status !== 'error') return

      updateMessage(roomId, messageId, { status: 'sending' })

      const { data, error } = await sendMessageAction({
        content: failed.content,
        roomId,
      })

      if (error || !data) {
        updateMessage(roomId, messageId, { status: 'error' })
        return
      }

      pendingTempIds.current.set(messageId, data.id)
      replaceMessage(roomId, messageId, data)
    },
    [roomId, updateMessage, replaceMessage]
  )

  /**
   * Flush queued messages that were sent while offline.
   * Called automatically when the connection is restored.
   */
  const flushQueue = useCallback(async () => {
    const queue = [...messageQueue.current]
    messageQueue.current = []

    for (const { tempId, content } of queue) {
      const { data, error } = await sendMessageAction({ content, roomId })

      if (error || !data) {
        updateMessage(roomId, tempId, { status: 'error' })
      } else {
        pendingTempIds.current.set(tempId, data.id)
        replaceMessage(roomId, tempId, data)
      }
    }
  }, [roomId, updateMessage, replaceMessage])

  /**
   * Reconcile local state with server after a reconnection.
   * Fetches the latest messages and merges them with the local store,
   * then flushes any queued messages.
   */
  const reconcile = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (data) {
      const fresh = (data as Message[]).reverse()
      // Keep any local optimistic (temp) messages that haven't been confirmed
      const currentMessages = useMessageStore.getState().messagesByRoom[roomId] ?? []
      const pendingOptimistic = currentMessages.filter(
        (m) => m.id.startsWith(TEMP_ID_PREFIX) && m.status === 'sending'
      )
      const freshIds = new Set(fresh.map((m) => m.id))
      const merged = [
        ...fresh,
        ...pendingOptimistic.filter((m) => !freshIds.has(m.id)),
      ]
      setMessages(roomId, merged)
    }

    await flushQueue()
  }, [roomId, setMessages, flushQueue])

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
  }, [roomId, isLoading, hasMore, prependMessages])

  return { messages, isLoading, loadMore, hasMore, sendMessage, retrySendMessage, reconcile }
}
