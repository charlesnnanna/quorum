/**
 * Server-side in-memory rate limiter for AI invocations.
 *
 * Enforces: max 1 AI invocation per user per 10 seconds.
 *
 * Design decisions:
 * - **In-memory, not Supabase**: a DB round-trip for every rate-limit check
 *   adds latency to the streaming path. An in-memory Map is O(1) and fine
 *   for a single-instance deployment (Netlify functions are short-lived anyway).
 * - **Per-user, not per-room**: prevents a single user from spamming @ai
 *   across multiple rooms simultaneously, while allowing different users in
 *   the same room to invoke concurrently (each gets its own placeholder).
 * - **Concurrent invocations across users are allowed**: each invocation
 *   creates its own AI message placeholder and streams independently.
 *   This is better than a global queue because users don't block each other.
 * - **Stale entries are cleaned lazily** on each check rather than on a timer,
 *   keeping the implementation trivial with no background processes.
 */

const RATE_LIMIT_MS = 10_000
const store = new Map<string, number>()

/** Check whether the user is rate-limited. If not, records the current time. */
export function checkAIRateLimit(userId: string): {
  allowed: boolean
  retryAfterMs: number
} {
  const now = Date.now()
  const lastInvocation = store.get(userId)

  // Lazy cleanup: remove entries older than the window
  if (lastInvocation && now - lastInvocation > RATE_LIMIT_MS) {
    store.delete(userId)
  }

  const existing = store.get(userId)
  if (existing) {
    const elapsed = now - existing
    return {
      allowed: false,
      retryAfterMs: RATE_LIMIT_MS - elapsed,
    }
  }

  store.set(userId, now)
  return { allowed: true, retryAfterMs: 0 }
}