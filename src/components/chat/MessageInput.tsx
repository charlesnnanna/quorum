'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Send, Mic, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendMessage } from '@/lib/actions/messages'
import { useVoice } from '@/hooks/useVoice'
import type { Profile } from '@/types'

const MAX_CHARS = 4000
const AI_MENTION_REGEX = /@ai\b/gi

interface MessageInputProps {
  roomId: string
  currentUser: Profile
  isAIResponding?: boolean
  onStartTyping?: () => void
  onStopTyping?: () => void
}

/**
 * Chat message composer with auto-resize, @ai mention detection,
 * typing indicator broadcasting, character limit, and voice input.
 */
export default function MessageInput({
  roomId,
  currentUser: _currentUser,
  isAIResponding = false,
  onStartTyping,
  onStopTyping,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    startListening,
    stopListening,
    transcript,
    isListening,
    duration,
    isSupported: isVoiceSupported,
    error: voiceError,
  } = useVoice()

  const charCount = content.length
  const isOverLimit = charCount > MAX_CHARS
  const isEmpty = content.trim().length === 0
  const isDisabled = isAIResponding || isSending
  const hasAIMention = AI_MENTION_REGEX.test(content)

  // Reset regex lastIndex after each test (global flag side effect)
  AI_MENTION_REGEX.lastIndex = 0

  // When voice transcript finalizes (user stops recording), insert into textarea
  const prevListeningRef = useRef(false)
  useEffect(() => {
    // Detect transition from listening → not listening
    if (prevListeningRef.current && !isListening && transcript) {
      setContent((prev) => {
        const separator = prev.trim() ? ' ' : ''
        return prev + separator + transcript
      })
      textareaRef.current?.focus()
    }
    prevListeningRef.current = isListening
  }, [isListening, transcript])

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [content, adjustHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    if (sendError) setSendError(null)
    onStartTyping?.()
  }

  const handleSend = useCallback(async (voiceOriginated = false) => {
    const trimmed = content.trim()
    if (!trimmed || isOverLimit || isDisabled) return

    setIsSending(true)
    setSendError(null)
    onStopTyping?.()

    const metadata = voiceOriginated
      ? { source: 'voice', original_language: 'en' }
      : undefined

    const { error } = await sendMessage({
      content: trimmed,
      roomId,
      ...(metadata ? { metadata } : {}),
    })

    if (error) {
      // Map server errors to user-friendly messages
      const friendlyError =
        error === 'Not a member of this room'
          ? "You're no longer a member of this room"
          : error === 'Unauthorized'
            ? 'Your session has expired. Please sign in again.'
            : 'Failed to send message. Please try again.'
      setSendError(friendlyError)
      setIsSending(false)
      return
    }

    setContent('')
    setIsSending(false)
    textareaRef.current?.focus()
  }, [content, isOverLimit, isDisabled, roomId, onStopTyping])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const handleVoiceCancel = () => {
    stopListening()
    // Don't insert transcript — user cancelled
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Render content with @ai highlights for the visual overlay
  const renderHighlightedContent = () => {
    if (!hasAIMention) return null

    const parts = content.split(/(@ai\b)/gi)
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2.5 text-base text-transparent md:text-sm"
      >
        {parts.map((part, i) =>
          /^@ai$/i.test(part) ? (
            <span
              key={i}
              className="rounded bg-primary/20 text-transparent"
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    )
  }

  return (
    <div className="safe-bottom border-t border-border bg-background px-3 py-2">
      {/* AI mention indicator */}
      {hasAIMention && (
        <div role="status" className="mb-1.5 flex items-center gap-1.5 text-xs text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          AI will be summoned when you send this message
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div role="alert" className="mb-1.5 flex items-center justify-between text-xs text-destructive">
          <span>{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div role="alert" className="mb-1.5 text-xs text-destructive">{voiceError}</div>
      )}

      {/* Recording overlay */}
      {isListening ? (
        <div className="flex items-center gap-3 py-1">
          {/* Cancel button */}
          <button
            type="button"
            onClick={handleVoiceCancel}
            aria-label="Cancel recording"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          {/* Recording indicator */}
          <div className="flex flex-1 items-center gap-3">
            {/* Animated bars */}
            <div className="flex items-center gap-0.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-destructive"
                  style={{
                    height: '16px',
                    animation: `voice-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>

            <span className="text-sm font-medium text-destructive">
              {formatDuration(duration)}
            </span>

            {/* Live transcript preview */}
            {transcript && (
              <span className="truncate text-sm text-muted-foreground">
                {transcript}
              </span>
            )}
          </div>

          {/* Stop button */}
          <button
            type="button"
            onClick={stopListening}
            aria-label="Stop recording"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Square className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Textarea with highlight overlay */}
          <div className="relative flex-1">
            {renderHighlightedContent()}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              aria-label="Message"
              placeholder={
                isAIResponding
                  ? 'AI is responding...'
                  : 'Type a message... (@ai to summon AI)'
              }
              disabled={isDisabled}
              rows={1}
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors',
                'placeholder:text-muted-foreground',
                'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'md:text-sm',
                isOverLimit && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50'
              )}
            />
          </div>

          {/* Voice / Send button */}
          {isEmpty ? (
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={isDisabled || !isVoiceSupported}
              aria-label="Record voice message"
              title={isVoiceSupported ? 'Voice input' : 'Voice input not supported in this browser'}
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <Mic className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isDisabled || isOverLimit}
              aria-label="Send message"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors',
                'hover:bg-primary/90',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <Send className="size-5" />
            </button>
          )}
        </div>
      )}

      {/* Character counter */}
      {!isListening && charCount > MAX_CHARS * 0.8 && (
        <div
          className={cn(
            'mt-1 text-right text-xs',
            isOverLimit ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {charCount}/{MAX_CHARS}
        </div>
      )}
    </div>
  )
}