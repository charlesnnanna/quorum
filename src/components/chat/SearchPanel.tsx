'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Loader2, ArrowRight } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { cn, highlightMatches } from '@/lib/utils'
import { searchMessages } from '@/lib/actions/messages'
import { useUIStore } from '@/lib/stores/uiStore'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { MessageSearchResult, Profile } from '@/types'

interface SearchPanelProps {
  roomId: string
  members: Record<string, Profile>
}

/**
 * Slide-in panel for full-text message search within a room.
 * Uses Supabase FTS via the searchMessages server action.
 * Highlights matching terms and scrolls to selected messages.
 */
export default function SearchPanel({ roomId, members }: SearchPanelProps) {
  const { isSearchOpen, setSearchOpen, setHighlightedMessageId } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when panel opens
  useEffect(() => {
    if (isSearchOpen) {
      // Small delay to let the slide animation start
      const t = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [isSearchOpen])

  // Reset state when panel closes
  useEffect(() => {
    if (!isSearchOpen) {
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }, [isSearchOpen])

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (value.trim().length < 2) {
        setResults([])
        setHasSearched(false)
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      debounceRef.current = setTimeout(async () => {
        const { data, error } = await searchMessages(roomId, value)
        if (!error && data) {
          setResults(data)
        }
        setIsSearching(false)
        setHasSearched(true)
      }, 350)
    },
    [roomId]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleResultClick = (messageId: string) => {
    // Set the highlighted message ID — MessageList will scroll to it
    // and load surrounding messages if needed.
    setHighlightedMessageId(messageId)
  }

  if (!isSearchOpen) return null

  return (
    <div
      role="search"
      aria-label="Search messages"
      className={cn(
        'absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-border bg-background',
        'md:w-80 xl:w-96',
        'animate-in slide-in-from-right duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search messages..."
          aria-label="Search messages"
          className="h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-sm"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setSearchOpen(false)}
          aria-label="Close search"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1" aria-label="Search results">
        <div aria-live="polite" aria-atomic="true">
        {isSearching ? (
          <div className="flex items-center justify-center py-12" role="status">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Searching messages</span>
          </div>
        ) : results.length > 0 ? (
          <div className="divide-y divide-border">
            {results.map((result) => (
              <SearchResultItem
                key={result.id}
                result={result}
                query={query}
                members={members}
                onClick={() => handleResultClick(result.id)}
              />
            ))}
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60">
              <Search className="size-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No messages found
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              No messages match &ldquo;{query}&rdquo;. Try different keywords or check your spelling.
            </p>
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <Search className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Search messages in this channel
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports phrases, OR, and - for exclusion
            </p>
          </div>
        )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ── Search result item ──────────────────────────────────────────────

function SearchResultItem({
  result,
  query,
  members,
  onClick,
}: {
  result: MessageSearchResult
  query: string
  members: Record<string, Profile>
  onClick: () => void
}) {
  const sender = result.sender_id ? members[result.sender_id] : null
  const senderName =
    result.sender_type === 'ai'
      ? 'AI Assistant'
      : sender?.full_name ?? result.sender_username ?? 'Unknown'
  const avatarUrl = sender?.avatar_url ?? result.sender_avatar
  const initial = senderName.charAt(0).toUpperCase()

  const timeAgo = formatDistanceToNowStrict(new Date(result.created_at), {
    addSuffix: true,
  })

  // Truncate content for display, keeping area around first match
  const maxLen = 160
  const content =
    result.content.length > maxLen
      ? truncateAroundMatch(result.content, query, maxLen)
      : result.content

  const segments = highlightMatches(content, query)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Message from ${senderName}, ${timeAgo}: ${content.slice(0, 80)}`}
      className="flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-accent group"
    >
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold">{senderName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {segments.map((seg, i) =>
            seg.isMatch ? (
              <mark key={i} className="rounded-sm bg-yellow-200/80 px-0.5 text-foreground dark:bg-yellow-500/30">
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </p>
      </div>

      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
    </button>
  )
}

/**
 * Truncates text around the first occurrence of a search term,
 * keeping context on both sides with ellipsis.
 */
function truncateAroundMatch(text: string, query: string, maxLen: number): string {
  const firstWord = query.trim().split(/\s+/)[0] ?? ''
  const idx = text.toLowerCase().indexOf(firstWord.toLowerCase())

  if (idx === -1 || text.length <= maxLen) return text.slice(0, maxLen)

  const contextBefore = Math.floor((maxLen - firstWord.length) / 2)
  const start = Math.max(0, idx - contextBefore)
  const end = Math.min(text.length, start + maxLen)

  let slice = text.slice(start, end)
  if (start > 0) slice = '...' + slice
  if (end < text.length) slice = slice + '...'

  return slice
}