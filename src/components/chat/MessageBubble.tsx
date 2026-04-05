'use client'

import { format } from 'date-fns'
import { AlertCircle, Bot, Check, Loader2, RotateCcw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Message, Profile } from '@/types'

/**
 * Renders text with **bold** markdown syntax converted to <strong> elements.
 */
function FormattedContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

/** Animated typing dots — shown while waiting for AI response. */
function AITypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="AI is typing">
      <span className="text-xs text-muted-foreground">AI is typing</span>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 rounded-full bg-muted-foreground/60"
            style={{
              animation: 'typing-bounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  /** The currently logged-in user — used to determine sent vs received. */
  currentUserId: string
  /** Sender profile. Null for AI messages. */
  sender: Profile | null
  /** Whether this message is grouped with the previous one from the same sender. */
  isGrouped: boolean
  onRetry?: (messageId: string) => void
}

function StatusIcon({ status }: { status: string }) {
  const label = status === 'sending' ? 'Sending' : status === 'delivered' ? 'Delivered' : 'Failed to send'

  if (status === 'sending') {
    return (
      <span role="status">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  if (status === 'delivered') {
    return (
      <span>
        <Check className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return (
    <span>
      <AlertCircle className="h-3 w-3 text-destructive" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function SenderAvatar({ sender, isAI }: { sender: Profile | null; isAI: boolean }) {
  if (isAI) {
    return (
      <Avatar size="sm">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
    )
  }

  if (!sender) return null

  const initials = (sender.full_name ?? sender.username)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Avatar size="sm">
      {sender.avatar_url && <AvatarImage src={sender.avatar_url} alt={sender.username} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

export default function MessageBubble({
  message,
  currentUserId,
  sender,
  isGrouped,
  onRetry,
}: MessageBubbleProps) {
  const isAI = message.sender_type === 'ai'
  const isSent = !isAI && message.sender_id === currentUserId
  const isError = message.status === 'error'
  const isSending = message.status === 'sending'
  const timestamp = isSending ? null : format(new Date(message.created_at), 'h:mm a')
  const senderName = isAI
    ? 'Quorum AI'
    : sender?.full_name ?? sender?.username ?? 'Unknown'

  // Sent messages: right-aligned
  if (isSent) {
    return (
      <div className={cn('flex justify-end px-4', isGrouped ? 'pt-0.5' : 'pt-3')}>
        <div className="flex max-w-[80%] flex-col items-end md:max-w-[65%]">
          {!isGrouped && timestamp && (
            <span className="mb-1 text-xs text-muted-foreground">{timestamp}</span>
          )}
          <div
            className={cn(
              'rounded-2xl rounded-br-md px-3 py-2 text-sm',
              'bg-primary text-primary-foreground',
              isSending && 'opacity-80',
              isError && 'opacity-70'
            )}
          >
            <FormattedContent text={message.content} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatusIcon status={message.status} />
            {isError && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Received (human or AI): left-aligned
  return (
    <div className={cn('flex px-4', isGrouped ? 'pt-0.5' : 'pt-3')}>
      {/* Avatar column — fixed width to keep bubbles aligned */}
      <div className="mr-2 w-6 shrink-0">
        {!isGrouped && <SenderAvatar sender={sender} isAI={isAI} />}
      </div>
      <div className="flex max-w-[80%] flex-col md:max-w-[65%]">
        {!isGrouped && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-xs font-medium">{senderName}</span>
            {timestamp && <span className="text-xs text-muted-foreground">{timestamp}</span>}
          </div>
        )}
        <div
          className={cn(
            'rounded-2xl rounded-bl-md px-3 py-2 text-sm',
            isAI
              ? 'bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20'
              : 'bg-muted'
          )}
        >
          {isAI && message.status === 'sending' && !message.content ? (
            <AITypingIndicator />
          ) : (
            <FormattedContent text={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}