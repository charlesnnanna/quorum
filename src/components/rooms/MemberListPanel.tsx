'use client'

import { X } from 'lucide-react'
import { useUIStore } from '@/lib/stores/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Profile } from '@/types'
import type { PresenceUser } from '@/hooks/usePresence'

interface MemberListPanelProps {
  members: Record<string, Profile>
  onlineUsers: PresenceUser[]
}

/**
 * Right-side panel showing room members with online/offline status.
 * Only rendered on lg+ screens when toggled open.
 */
export default function MemberListPanel({
  members,
  onlineUsers,
}: MemberListPanelProps) {
  const isMemberPanelOpen = useUIStore((s) => s.isMemberPanelOpen)
  const setMemberPanelOpen = useUIStore((s) => s.setMemberPanelOpen)

  if (!isMemberPanelOpen) return null

  const onlineIds = new Set(onlineUsers.map((u) => u.userId))
  const memberList = Object.values(members)
  const online = memberList.filter((m) => onlineIds.has(m.id))
  const offline = memberList.filter((m) => !onlineIds.has(m.id))

  return (
    <aside
      aria-label="Room members"
      className="hidden h-full w-[240px] shrink-0 flex-col border-l border-border bg-background lg:flex"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">
          Members ({memberList.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMemberPanelOpen(false)}
          aria-label="Close member list"
          className="size-8"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          {/* Online members */}
          {online.length > 0 && (
            <>
              <p className="mb-1.5 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Online — {online.length}
              </p>
              {online.map((member) => (
                <MemberRow key={member.id} member={member} isOnline />
              ))}
            </>
          )}

          {/* Offline members */}
          {offline.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Offline — {offline.length}
              </p>
              {offline.map((member) => (
                <MemberRow key={member.id} member={member} isOnline={false} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function MemberRow({ member, isOnline }: { member: Profile; isOnline: boolean }) {
  const initials = (member.full_name ?? member.username)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <div className="relative">
        <Avatar className="size-7">
          {member.avatar_url && <AvatarImage src={member.avatar_url} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${
            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`}
          aria-hidden="true"
        />
      </div>
      <span className={`truncate text-sm ${isOnline ? 'text-foreground' : 'text-muted-foreground'}`}>
        {member.full_name ?? member.username}
      </span>
    </div>
  )
}
