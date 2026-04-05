import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import RoomShell from '@/components/rooms/RoomShell'
import type { Profile, Message } from '@/types'

interface RoomPageProps {
  params: { roomId: string }
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params

  // 1. Auth check
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  const supabase = createServiceRoleClient()

  // 2. Verify room exists
  const { data: room } = await supabase
    .from('rooms')
    .select()
    .eq('id', roomId)
    .single()

  if (!room) notFound()

  // 3. Verify user is a member
  const { data: membership } = await supabase
    .from('room_members')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', session.user.id)
    .single()

  if (!membership) redirect('/')

  // 4. Fetch current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select()
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  // 5. Fetch room members as a map
  const { data: memberRows } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)

  const memberIds = (memberRows ?? []).map((m) => m.user_id)

  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select()
    .in('id', memberIds.length > 0 ? memberIds : ['__none__'])

  const members: Record<string, Profile> = {}
  for (const p of memberProfiles ?? []) {
    members[p.id] = p as Profile
  }

  // 6. Fetch initial messages (last 50, with sender profiles)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(50)

  const initialMessages = ((messages ?? []) as Message[]).reverse()

  // 7. Render
  return (
    <RoomShell
      roomId={roomId}
      room={room}
      profile={profile as Profile}
      members={members}
      memberCount={memberIds.length}
      initialMessages={initialMessages}
    />
  )
}