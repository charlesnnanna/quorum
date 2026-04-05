'use client'

import { useState, useCallback } from 'react'
import { AlertCircle, Clock, RotateCcw, Sparkles, Volume2, Square } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/lib/stores/aiStore'
import type { Message } from '@/types'

interface AIMessageProps {
  message: Message
  /** Whether to show the "Quorum AI" label + avatar (first in a sequence). */
  showHeader?: boolean
  /** Called when the user clicks retry on an error state. */
  onRetry?: () => void
}

/**
 * Renders an AI-generated message with streaming support, markdown, and TTS.
 *
 * Three visual states based on `status` and `content`:
 * - **Waiting** (status='sending', no content): animated typing dots
 * - **Streaming** (status='sending', content growing): markdown + blinking cursor
 * - **Complete** (status='delivered'): markdown + TTS play button
 * - **Error** (status='error'): error styling with message
 */
export default function AIMessage({ message, showHeader = true, onRetry }: AIMessageProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSlow = useAIStore((s) => s.slowAiMessageIds.has(message.id))

  const isWaiting = message.status === 'sending' && !message.content
  const isStreaming = message.status === 'sending' && !!message.content
  const isComplete = message.status === 'delivered'
  const isError = message.status === 'error'

  const handleTTS = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.rate = 1.0
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [message.content, isSpeaking])

  return (
    <div className="flex gap-2.5 px-3 py-1.5">
      {/* Avatar */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          'bg-gradient-to-br from-primary/80 to-primary/40',
          showHeader ? 'visible' : 'invisible'
        )}
      >
        <Sparkles className="size-4 text-primary-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Header */}
        {showHeader && (
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">
            AI Assistant
          </p>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl rounded-tl-sm px-3.5 py-2.5',
            'bg-muted/60',
            isError && 'border border-destructive/40 bg-destructive/5'
          )}
        >
          {/* Waiting: typing dots + slow warning */}
          {isWaiting && (
            <>
              <TypingDots />
              {isSlow && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="size-3 shrink-0" />
                  AI is taking longer than usual…
                </p>
              )}
            </>
          )}

          {/* Error state with retry */}
          {isError && !message.content && (
            <div className="flex items-center gap-2 text-sm text-destructive/80">
              <AlertCircle className="size-4 shrink-0" />
              <span>Failed to generate a response.</span>
            </div>
          )}

          {/* Streaming or complete: render markdown */}
          {(isStreaming || isComplete || (isError && message.content)) && message.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>

              {/* Blinking cursor while streaming */}
              {isStreaming && (
                <span
                  className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-foreground"
                  style={{ animation: 'blink-cursor 0.8s step-end infinite' }}
                  aria-hidden
                />
              )}
            </div>
          )}
        </div>

        {/* Retry button — only on error */}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            <RotateCcw className="size-3" />
            Retry
          </button>
        )}

        {/* TTS button — only when complete and has content */}
        {isComplete && message.content && (
          <button
            type="button"
            onClick={handleTTS}
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
              'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              isSpeaking && 'text-primary'
            )}
          >
            {isSpeaking ? (
              <>
                <Square className="size-3" />
                Stop
              </>
            ) : (
              <>
                <Volume2 className="size-3" />
                Play response
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/** Three dots that bounce in sequence — shown while waiting for the first token. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="AI is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/60"
          style={{
            animation: 'typing-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}