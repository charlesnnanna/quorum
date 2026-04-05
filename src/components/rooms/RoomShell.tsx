'use client'

import { usePresence } from '@/hooks/usePresence'
import RoomHeader from '@/components/rooms/RoomHeader'
import MessageList from '@/components/chat/MessageList'
import MessageInput from '@/components/chat/MessageInput'
import SearchPanel from '@/components/chat/SearchPanel'
import MemberListPanel from '@/components/rooms/MemberListPanel'
import type { Profile, Message } from '@/types'

interface RoomShellProps {
  roomId: string
  room: { name: string; description?: string | null; is_private?: boolean | null }
  profile: Profile
  members: Record<string, Profile>
  memberCount: number
  initialMessages: Message[]
}

/**
 * Client wrapper that owns the single Presence subscription for a room
 * and passes onlineUsers / typingUsers down to child components.
 */
export default function RoomShell({
  roomId,
  room,
  profile,
  members,
  memberCount,
  initialMessages,
}: RoomShellProps) {
  const { onlineUsers, startTyping, stopTyping } = usePresence(roomId, {
    userId: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
  })

  return (
    <div className="relative flex h-full">
      {/* Chat column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <RoomHeader
          roomId={roomId}
          roomName={room.name}
          roomDescription={room.description ?? null}
          isPrivate={room.is_private ?? false}
          memberCount={memberCount}
          currentUser={profile}
          onlineUsers={onlineUsers}
        />

        <MessageList
          roomId={roomId}
          initialMessages={initialMessages}
          currentUser={profile}
          members={members}
        />

        <MessageInput
          roomId={roomId}
          currentUser={profile}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
        />

        {/* Search panel slides in from the right */}
        <SearchPanel roomId={roomId} members={members} />
      </div>

      {/* Member list panel — desktop only, toggled via header button */}
      <MemberListPanel
        members={members}
        onlineUsers={onlineUsers}
      />
    </div>
  )
}
