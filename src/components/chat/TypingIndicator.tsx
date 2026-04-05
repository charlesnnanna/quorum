'use client'

import type { PresenceUser } from '@/hooks/usePresence'

interface TypingIndicatorProps {
  typingUsers: PresenceUser[]
}

function formatTypingText(users: PresenceUser[]): string {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0]!.username} is typing`
  if (users.length === 2) {
    return `${users[0]!.username} and ${users[1]!.username} are typing`
  }
  return `${users[0]!.username} and ${users.length - 1} others are typing`
}

/**
 * Displays a typing indicator with animated dots. The outer wrapper is always
 * rendered so the aria-live region persists — screen readers only announce
 * content changes inside a live region that is already in the DOM.
 */
export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const text = formatTypingText(typingUsers)

  return (
    <div aria-live="polite" aria-atomic="true" role="status">
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground">
          <span className="inline-flex gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-muted-foreground"
                style={{
                  animation: 'typing-bounce 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </span>
          <span>{text}</span>
        </div>
      )}
    </div>
  )
}
