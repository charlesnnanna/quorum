import { create } from 'zustand'
import type { Message } from '@/types'

interface MessageStore {
  messagesByRoom: Record<string, Message[]>
  /** Replace all messages for a room (used for initial fetch). */
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
    set((state) => ({
      messagesByRoom: { ...state.messagesByRoom, [roomId]: messages },
    })),

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
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: existing.map((m) => (m.id === tempId ? confirmed : m)),
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