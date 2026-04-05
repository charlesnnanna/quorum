import { create } from 'zustand'
import type { Message } from '@/types'

const TEMP_ID_PREFIX = 'temp_'

interface MessageStore {
  messagesByRoom: Record<string, Message[]>
  /** Replace all messages for a room. Automatically preserves any
   *  in-flight optimistic messages (temp IDs with status='sending')
   *  so that setMessages can never accidentally remove them. */
  setMessages: (roomId: string, messages: Message[]) => void
  /** Append a message, deduplicating by id. */
  addMessage: (roomId: string, message: Message) => void
  /** Partially update a message in a room. */
  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void
  /** Swap a temp message for the server-confirmed one. */
  replaceMessage: (roomId: string, tempId: string, confirmed: Message) => void
  /** Prepend older messages (for pagination). */
  prependMessages: (roomId: string, messages: Message[]) => void
}

export const useMessageStore = create<MessageStore>((set) => ({
  messagesByRoom: {},

  setMessages: (roomId, messages) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId] ?? []
      // Preserve any in-flight optimistic messages that aren't in the
      // incoming array — this makes setMessages safe to call from
      // anywhere (seeding, reconcile, search) without losing messages
      // the user just sent.
      const incomingIds = new Set(messages.map((m) => m.id))
      const optimistic = existing.filter(
        (m) =>
          m.id.startsWith(TEMP_ID_PREFIX) &&
          m.status === 'sending' &&
          !incomingIds.has(m.id)
      )
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: optimistic.length > 0
            ? [...messages, ...optimistic]
            : messages,
        },
      }
    }),

  addMessage: (roomId, message) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId] ?? []
      // Deduplicate — if the message already exists, don't add it again
      if (existing.some((m) => m.id === message.id)) return state
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: [...existing, message],
        },
      }
    }),

  updateMessage: (roomId, messageId, updates) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId]
      if (!existing) return state
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: existing.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        },
      }
    }),

  replaceMessage: (roomId, tempId, confirmed) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId]
      if (!existing) return state
      // Replace the temp, then deduplicate by id in case the confirmed
      // message was also added by the Realtime INSERT handler.
      const replaced = existing.map((m) => (m.id === tempId ? confirmed : m))
      const seen = new Set<string>()
      const deduped = replaced.filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: deduped,
        },
      }
    }),

  prependMessages: (roomId, messages) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId] ?? []
      // Deduplicate against existing ids
      const existingIds = new Set(existing.map((m) => m.id))
      const newMessages = messages.filter((m) => !existingIds.has(m.id))
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: [...newMessages, ...existing],
        },
      }
    }),
}))
