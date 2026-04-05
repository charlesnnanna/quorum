'use client'

import { useEffect, useMemo, useTransition } from 'react'
import { usePresence } from '@/hooks/usePresence'
import { useMessages } from '@/hooks/useMessages'
import { useConnection } from '@/hooks/useConnection'
import { markRoomAsRead } from '@/lib/actions/rooms'
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
  const presenceUser = useMemo(() => ({
    userId: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
  }), [profile.id, profile.username, profile.avatar_url])

  const { onlineUsers, startTyping, stopTyping } = usePresence(roomId, presenceUser)

  const {
    messages,
    isLoading: messagesLoading,
    isSending,
    loadMore,
    hasMore,
    sendMessage,
    reconcile,
  } = useMessages(roomId, initialMessages)

  useConnection(reconcile)

  // Mark room as read when the user enters it.
  // Wrapped in startTransition so the server action's RSC refresh does not
  // block or interfere with the current render — this prevents it from
  // serialising with (and delaying) sendMessage calls.
  const [, startTransition] = useTransition()
  useEffect(() => {
    startTransition(() => {
      markRoomAsRead(roomId)
    })
  }, [roomId, startTransition])

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
          messages={messages}
          isLoading={messagesLoading}
          loadMore={loadMore}
          hasMore={hasMore}
          currentUser={profile}
          members={members}
        />

        <MessageInput
          roomId={roomId}
          currentUser={profile}
          onSendMessage={sendMessage}
          isSending={isSending}
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
