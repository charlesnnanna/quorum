'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Hash,
  Lock,
  Plus,
  Search,
  LogOut,
  MessageSquare,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth/auth-client'
import { useRooms } from '@/hooks/useRooms'
import { useUIStore } from '@/lib/stores/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import CreateRoomModal from './CreateRoomModal'
import type { Profile, RoomWithDetails } from '@/types'

interface RoomSidebarProps {
  currentUser: Profile
  initialRooms?: RoomWithDetails[]
  /** Compact mode for tablet — icon-only with tooltips. */
  compact?: boolean
  /** Called when a room is selected (e.g. to close mobile drawer). */
  onNavigate?: () => void
}

/**
 * Sidebar listing the user's rooms with search, online member counts,
 * last message previews, and a user profile section at the bottom.
 * Supports a `compact` mode for tablet layouts with icon + truncated name.
 */
export default function RoomSidebar({
  currentUser,
  initialRooms,
  compact = false,
  onNavigate,
}: RoomSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { rooms, isLoading } = useRooms(initialRooms)
  const { modal, setModal, setMobileScreen } = useUIStore()
  const [search, setSearch] = useState('')

  const activeRoomId = pathname.match(/\/rooms\/([^/]+)/)?.[1] ?? null

  const filtered = search
    ? rooms.filter((r) =>
        r.room_name.toLowerCase().includes(search.toLowerCase())
      )
    : rooms

  const handleRoomClick = (roomId: string) => {
    setMobileScreen('chat')
    onNavigate?.()
    router.push(`/rooms/${roomId}`)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // ── Compact (tablet) layout ────────────────────────────────────────

  if (compact) {
    return (
      <>
        <aside
          aria-label="Channels sidebar"
          className="flex h-full w-full flex-col items-center border-r border-border bg-sidebar py-3"
        >
          {/* Create button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setModal('createRoom')}
            aria-label="Create new channel"
            title="New channel"
            className="mb-2 size-11"
          >
            <Plus className="size-5" />
          </Button>

          {/* Room list — icons only */}
          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col items-center gap-1 px-1.5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="size-11 rounded-lg" />
                ))
              ) : (
                filtered.map((room) => (
                  <button
                    key={room.room_id}
                    type="button"
                    onClick={() => handleRoomClick(room.room_id)}
                    aria-current={room.room_id === activeRoomId ? 'page' : undefined}
                    aria-label={`${room.is_private ? 'Private' : ''} ${room.room_name}`}
                    title={room.room_name}
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors',
                      'hover:bg-sidebar-accent',
                      room.room_id === activeRoomId
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-accent-foreground'
                    )}
                  >
                    {room.is_private ? (
                      <Lock className="size-4" />
                    ) : (
                      <Hash className="size-4" />
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* User section — avatar only */}
          <div className="mt-2 flex flex-col items-center gap-2 border-t border-sidebar-border pt-3">
            <div className="relative" title={currentUser.full_name ?? currentUser.username}>
              <Avatar className="size-9">
                <AvatarImage src={currentUser.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(currentUser.full_name ?? currentUser.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span aria-label="Online" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-emerald-500 animate-[presence-pulse_2s_ease-in-out_infinite]" />
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="size-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </aside>

        {/* Create room modal */}
        <CreateRoomModal
          open={modal === 'createRoom'}
          onOpenChange={(open) => setModal(open ? 'createRoom' : null)}
        />
      </>
    )
  }

  // ── Full (desktop / mobile-drawer) layout ──────────────────────────

  return (
    <>
      <aside aria-label="Channels sidebar" className="flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <h2 className="text-lg font-semibold">Channels</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setModal('createRoom')}
            aria-label="Create new channel"
            className="size-11"
          >
            <Plus className="size-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              aria-label="Search channels"
              className="pl-8 text-base md:text-sm"
            />
          </div>
        </div>

        {/* Room list */}
        <ScrollArea className="flex-1">
          <div className="px-2 py-1">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className={`h-3.5 ${i % 3 === 0 ? 'w-20' : i % 3 === 1 ? 'w-28' : 'w-16'}`} />
                      <Skeleton className="h-2.5 w-8 shrink-0" />
                    </div>
                    <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-36' : 'w-28'}`} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                {search ? (
                  <>
                    <Search className="size-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No channels found</p>
                    <p className="text-xs text-muted-foreground">
                      No channels match &ldquo;{search}&rdquo;
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60">
                      <Hash className="size-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No channels yet</p>
                    <p className="text-xs text-muted-foreground">
                      Create your first channel to get started
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModal('createRoom')}
                      className="mt-1 gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      New Channel
                    </Button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((room) => (
                <RoomItem
                  key={room.room_id}
                  room={room}
                  isActive={room.room_id === activeRoomId}
                  onClick={() => handleRoomClick(room.room_id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* User profile section */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-9">
                <AvatarImage src={currentUser.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(currentUser.full_name ?? currentUser.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span aria-label="Online" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-emerald-500 animate-[presence-pulse_2s_ease-in-out_infinite]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">
                {currentUser.full_name ?? currentUser.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">Online</p>
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Create room modal */}
      <CreateRoomModal
        open={modal === 'createRoom'}
        onOpenChange={(open) => setModal(open ? 'createRoom' : null)}
      />
    </>
  )
}

// ── Room list item ──────────────────────────────────────────────────

function RoomItem({
  room,
  isActive,
  onClick,
}: {
  room: RoomWithDetails
  isActive: boolean
  onClick: () => void
}) {
  const timeAgo = room.last_message_at
    ? formatDistanceToNowStrict(new Date(room.last_message_at), { addSuffix: false })
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={`${room.is_private ? 'Private channel' : 'Channel'}: ${room.room_name}, ${room.member_count} members`}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-sidebar-accent',
        isActive && 'bg-sidebar-accent'
      )}
    >
      {/* Room icon */}
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        {room.is_private ? (
          <Lock className="size-4" />
        ) : (
          <Hash className="size-4" />
        )}
      </div>

      {/* Room info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{room.room_name}</span>
          {timeAgo && (
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {room.last_message_content ? (
            <p className="truncate text-xs text-muted-foreground">
              {room.last_message_sender && (
                <span className="font-medium">{room.last_message_sender}: </span>
              )}
              {room.last_message_content}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No messages yet</p>
          )}
        </div>
      </div>

      {/* Member count badge */}
      {room.member_count > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3" />
          {room.member_count}
        </span>
      )}
    </button>
  )
}
