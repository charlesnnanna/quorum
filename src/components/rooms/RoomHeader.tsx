'use client'

import { useState } from 'react'
import {
  Menu,
  Hash,
  Lock,
  Users,
  UserPlus,
  MoreVertical,
  Search,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores/uiStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import InviteUserModal from './InviteUserModal'
import type { Profile } from '@/types'
import type { PresenceUser } from '@/hooks/usePresence'

interface RoomHeaderProps {
  roomId: string
  roomName: string
  roomDescription?: string | null | undefined
  isPrivate: boolean
  memberCount: number
  currentUser: Profile
  onlineUsers: PresenceUser[]
}

/**
 * Room title bar with hamburger menu (mobile), room info,
 * online member count, and action buttons.
 */
export default function RoomHeader({
  roomId,
  roomName,
  roomDescription,
  isPrivate,
  memberCount,
  currentUser: _currentUser,
  onlineUsers,
}: RoomHeaderProps) {
  const {
    isSearchOpen,
    setSearchOpen,
    setDrawerOpen,
    isMemberPanelOpen,
    setMemberPanelOpen,
  } = useUIStore()
  const [showInvite, setShowInvite] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-border bg-background px-2 safe-top md:gap-2 md:px-4">
        {/* Hamburger menu — mobile only, opens sidebar drawer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="size-11 shrink-0 md:hidden"
        >
          <Menu className="size-5" />
        </Button>

        {/* Room icon + info */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {isPrivate ? (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Private channel" />
          ) : (
            <Hash className="size-4 shrink-0 text-muted-foreground" aria-label="Public channel" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{roomName}</h1>
            {roomDescription && (
              <p className="hidden truncate text-xs text-muted-foreground md:block">
                {roomDescription}
              </p>
            )}
          </div>
        </div>

        {/* Online / member count — tablet+ */}
        <button
          type="button"
          onClick={() => setMemberPanelOpen(!isMemberPanelOpen)}
          className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
          aria-label={`${onlineUsers.length} online, ${memberCount} members. Toggle member list.`}
        >
          <Users className="size-3.5" />
          <span>
            {onlineUsers.length}/{memberCount}
          </span>
        </button>

        {/* Search toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(!isSearchOpen)}
          aria-label={isSearchOpen ? 'Close search' : 'Search messages'}
          className="size-11 shrink-0"
        >
          <Search className="size-4" />
        </Button>

        {/* Member panel toggle — desktop only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMemberPanelOpen(!isMemberPanelOpen)}
          aria-label={isMemberPanelOpen ? 'Close member list' : 'Show member list'}
          className="hidden size-11 shrink-0 lg:inline-flex"
        >
          {isMemberPanelOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>

        {/* More menu — collapses less-used actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Room options"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSearchOpen(true)}>
              <Search className="size-4" />
              Search messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowInvite(true)}>
              <UserPlus className="size-4" />
              Invite members
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <InviteUserModal
        open={showInvite}
        onOpenChange={setShowInvite}
        roomId={roomId}
        roomName={roomName}
      />
    </>
  )
}
