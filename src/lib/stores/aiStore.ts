import { create } from 'zustand'

const RATE_LIMIT_MS = 10_000

interface AIStore {
  /** Timestamp of the last AI invocation per user, keyed by `userId`. */
  lastInvocationByUser: Record<string, number>

  /** Set of AI message IDs that are taking longer than expected. */
  slowAiMessageIds: Set<string>

  /**
   * Check if the current user can invoke AI.
   * Returns `{ allowed, retryAfterMs }`.
   */
  canInvoke: (userId: string) => { allowed: boolean; retryAfterMs: number }

  /** Record that the user just invoked AI. */
  recordInvocation: (userId: string) => void

  /** Mark an AI message as slow (taking longer than expected). */
  markSlow: (messageId: string) => void

  /** Remove an AI message from the slow set. */
  clearSlow: (messageId: string) => void
}

/**
 * Client-side rate-limit store for AI invocations.
 *
 * Tracks the last invocation timestamp per user. The 10-second cooldown
 * is enforced here for instant feedback (disable the send button, show
 * a countdown) and also enforced server-side as the authoritative check.
 *
 * This is NOT a security boundary — the server-side rate limiter in
 * `lib/ai/ratelimit.ts` is the real gate. This store exists purely for UX.
 */
export const useAIStore = create<AIStore>((set, get) => ({
  lastInvocationByUser: {},
  slowAiMessageIds: new Set<string>(),

  canInvoke: (userId: string) => {
    const last = get().lastInvocationByUser[userId]
    if (!last) return { allowed: true, retryAfterMs: 0 }

    const elapsed = Date.now() - last
    if (elapsed >= RATE_LIMIT_MS) return { allowed: true, retryAfterMs: 0 }

    return { allowed: false, retryAfterMs: RATE_LIMIT_MS - elapsed }
  },

  recordInvocation: (userId: string) =>
    set((state) => ({
      lastInvocationByUser: {
        ...state.lastInvocationByUser,
        [userId]: Date.now(),
      },
    })),

  markSlow: (messageId: string) =>
    set((state) => {
      const next = new Set(state.slowAiMessageIds)
      next.add(messageId)
      return { slowAiMessageIds: next }
    }),

  clearSlow: (messageId: string) =>
    set((state) => {
      const next = new Set(state.slowAiMessageIds)
      next.delete(messageId)
      return { slowAiMessageIds: next }
    }),
}))