'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, Loader2 } from 'lucide-react'
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { useConnection } from '@/hooks/useConnection'
import { useMessageStore } from '@/lib/stores/messageStore'
import { useUIStore } from '@/lib/stores/uiStore'
import MessageBubble from './MessageBubble'
import DateSeparator from './DateSeparator'
import EmptyMessages from './EmptyMessages'
import type { Message, Profile } from '@/types'

interface MessageListProps {
  roomId: string
  initialMessages: Message[]
  currentUser: Profile
  /** Map of userId → Profile for all room members. */
  members: Record<string, Profile>
}

// ── Virtual list row types ──────────────────────────────────────────

type Row =
  | { kind: 'date'; date: string; key: string }
  | { kind: 'message'; message: Message; isGrouped: boolean; key: string }

/**
 * Converts a flat messages array into rows with date separators and grouping.
 * Consecutive messages from the same sender on the same day are "grouped"
 * (no repeated avatar/name).
 */
function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!
    const prev = i > 0 ? messages[i - 1]! : null

    // Date separator when the day changes
    const msgDate = new Date(msg.created_at)
    if (!prev || !isSameDay(new Date(prev.created_at), msgDate)) {
      rows.push({ kind: 'date', date: msg.created_at, key: `date-${msg.created_at}` })
    }

    // Group consecutive messages from the same sender on the same day
    const isGrouped =
      !!prev &&
      prev.sender_id === msg.sender_id &&
      prev.sender_type === msg.sender_type &&
      isSameDay(new Date(prev.created_at), msgDate)

    rows.push({ kind: 'message', message: msg, isGrouped, key: msg.id })
  }

  return rows
}

// ── Scroll detection thresholds ─────────────────────────────────────

/** How far from the bottom (px) the user can be and still count as "at bottom". */
const SCROLL_BOTTOM_THRESHOLD = 80
/** How close to the top (px) triggers loading more messages. */
const SCROLL_TOP_THRESHOLD = 200

export default function MessageList({
  roomId,
  initialMessages,
  currentUser,
  members,
}: MessageListProps) {
  const { messages, isLoading, loadMore, hasMore, retrySendMessage, reconcile } =
    useMessages(roomId, initialMessages)

  // Reconcile messages when connection is restored
  useConnection(reconcile)

  const rows = useMemo(() => buildRows(messages), [messages])

  // ── Refs ────────────────────────────────────────────────────────────

  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const prevMessageCountRef = useRef(messages.length)
  const [showNewIndicator, setShowNewIndicator] = useState(false)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)

  // Track IDs of messages that arrived after the initial render so we can
  // animate only those (not the initial load or paginated history).
  const knownIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)))
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())

  // Screen-reader announcement for new messages
  const [liveAnnouncement, setLiveAnnouncement] = useState('')

  useEffect(() => {
    const newIds: string[] = []
    for (const m of messages) {
      if (!knownIdsRef.current.has(m.id)) {
        knownIdsRef.current.add(m.id)
        newIds.push(m.id)
      }
    }

    // Announce new messages to screen readers
    if (newIds.length > 0 && newIds.length <= 5) {
      const newMessages = messages.filter((m) => newIds.includes(m.id))
      const announcements = newMessages.map((m) => {
        const senderName = m.sender_type === 'ai'
          ? 'AI Assistant'
          : (m.sender_id && members[m.sender_id])
            ? (members[m.sender_id]!.full_name ?? members[m.sender_id]!.username)
            : 'Someone'
        return `${senderName}: ${m.content.slice(0, 120)}`
      })
      setLiveAnnouncement(announcements.join('. '))
    }

    if (newIds.length > 0 && newIds.length <= 3) {
      // Only animate a small batch — bulk loads (pagination) should not animate
      setAnimatingIds((prev) => {
        const next = new Set(prev)
        for (const id of newIds) next.add(id)
        return next
      })
      // Clear after animation completes (250ms)
      const t = setTimeout(() => {
        setAnimatingIds((prev) => {
          const next = new Set(prev)
          for (const id of newIds) next.delete(id)
          return next
        })
      }, 250)
      return () => clearTimeout(t)
    }
  }, [messages, members])

  // ── Search highlight: scroll to message ────────────────────────────

  const highlightedMessageId = useUIStore((s) => s.highlightedMessageId)
  const setHighlightedMessageId = useUIStore((s) => s.setHighlightedMessageId)

  useEffect(() => {
    if (!highlightedMessageId) return

    const rowIndex = rows.findIndex(
      (r) => r.kind === 'message' && r.message.id === highlightedMessageId
    )

    if (rowIndex >= 0) {
      // Message is loaded — scroll to it and flash highlight
      virtualizer.scrollToIndex(rowIndex, { align: 'center' })
      setFlashMessageId(highlightedMessageId)
      setHighlightedMessageId(null)

      // Clear flash after animation
      const t = setTimeout(() => setFlashMessageId(null), 2000)
      return () => clearTimeout(t)
    }

    // Message not loaded — fetch a window of messages around it
    let cancelled = false
    ;(async () => {
      const supabase = createClient()

      // First get the target message's timestamp
      const { data: targetMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', highlightedMessageId)
        .single()

      if (cancelled || !targetMsg) {
        setHighlightedMessageId(null)
        return
      }

      // Fetch 25 messages before and 25 after the target
      const { data: around } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .gte('created_at', new Date(new Date(targetMsg.created_at!).getTime() - 60000 * 60).toISOString())
        .lte('created_at', new Date(new Date(targetMsg.created_at!).getTime() + 60000 * 60).toISOString())
        .order('created_at', { ascending: true })
        .limit(50)

      if (cancelled || !around) {
        setHighlightedMessageId(null)
        return
      }

      // Replace messages in the store — the virtualizer will re-render
      useMessageStore.getState().setMessages(roomId, around as Message[])

      // Wait for re-render, then scroll
      requestAnimationFrame(() => {
        const newRows = buildRows(around as Message[])
        const idx = newRows.findIndex(
          (r) => r.kind === 'message' && r.message.id === highlightedMessageId
        )
        if (idx >= 0) {
          virtualizer.scrollToIndex(idx, { align: 'center' })
        }
        setFlashMessageId(highlightedMessageId)
        setHighlightedMessageId(null)
        setTimeout(() => setFlashMessageId(null), 2000)
      })
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedMessageId, roomId, setHighlightedMessageId])

  // ── Virtualizer ─────────────────────────────────────────────────────

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 50
      if (row.kind === 'date') return 44
      return row.isGrouped ? 36 : 64
    },
    overscan: 15,
  })

  // ── Track scroll position ───────────────────────────────────────────

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD
    if (isAtBottomRef.current) {
      setShowNewIndicator(false)
    }
  }, [])

  const checkIfAtTop = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop < SCROLL_TOP_THRESHOLD && hasMore && !isLoading) {
      loadMore()
    }
  }, [hasMore, isLoading, loadMore])

  const handleScroll = useCallback(() => {
    checkIfAtBottom()
    checkIfAtTop()
  }, [checkIfAtBottom, checkIfAtTop])

  // ── Auto-scroll on new messages ─────────────────────────────────────

  useEffect(() => {
    const newCount = messages.length
    const oldCount = prevMessageCountRef.current
    prevMessageCountRef.current = newCount

    if (newCount <= oldCount) return // no new messages (or loadMore prepended)

    if (isAtBottomRef.current) {
      // Scroll to bottom after virtualizer re-measures
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
      })
    } else {
      setShowNewIndicator(true)
    }
  }, [messages.length, rows.length, virtualizer])

  // ── Initial scroll to bottom ────────────────────────────────────────

  const hasScrolledInitially = useRef(false)
  useEffect(() => {
    if (rows.length > 0 && !hasScrolledInitially.current) {
      hasScrolledInitially.current = true
      // Wait for virtualizer to mount and measure
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
      })
    }
  }, [rows.length, virtualizer])

  // ── Jump to bottom button ───────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
    setShowNewIndicator(false)
    isAtBottomRef.current = true
  }, [virtualizer, rows.length])

  // ── Render ──────────────────────────────────────────────────────────

  // Empty state: no messages in the room
  if (messages.length === 0 && !isLoading) {
    return <EmptyMessages />
  }

  return (
    <div className="relative flex-1 overflow-hidden" role="region" aria-label="Messages">
      {/* Visually hidden live region — announces new messages to screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="false">
        {liveAnnouncement}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
        {/* Loading spinner at top during pagination */}
        {isLoading && (
          <div className="flex justify-center py-3" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading older messages</span>
          </div>
        )}

        {/* Virtualized rows */}
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            const isFlashed =
              row.kind === 'message' && row.message.id === flashMessageId
            const isAnimating =
              row.kind === 'message' && animatingIds.has(row.message.id)

            return (
              <div
                key={row.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  'absolute left-0 top-0 w-full transition-colors duration-700',
                  isFlashed && 'bg-yellow-100/70 dark:bg-yellow-500/15'
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  animation: isAnimating
                    ? 'message-slide-in 250ms ease-out both'
                    : undefined,
                }}
              >
                {row.kind === 'date' ? (
                  <DateSeparator date={row.date} />
                ) : (
                  <MessageBubble
                    message={row.message}
                    currentUserId={currentUser.id}
                    sender={
                      row.message.sender_id
                        ? members[row.message.sender_id] ?? null
                        : null
                    }
                    isGrouped={row.isGrouped}
                    onRetry={retrySendMessage}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom padding so last message isn't flush with edge */}
        <div className="h-2" />
      </div>

      {/* "New messages" indicator */}
      {showNewIndicator && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg hover:brightness-110 active:scale-95"
          style={{ animation: 'new-msg-bounce 2s ease-in-out infinite' }}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          New messages
        </button>
      )}
    </div>
  )
}