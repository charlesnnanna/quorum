import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import NoRoomsState from '@/components/rooms/NoRoomsState'

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  // Redirect to the user's most recent room
  const supabase = createServiceRoleClient()
  const { data: rooms } = await supabase.rpc('get_user_rooms', {
    p_user_id: session.user.id,
  })

  if (rooms && rooms.length > 0) {
    // Sort by most recent activity
    const sorted = [...rooms].sort((a, b) => {
      const aTime = a.last_message_at ?? a.room_created_at
      const bTime = b.last_message_at ?? b.room_created_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
    redirect(`/rooms/${sorted[0]!.room_id}`)
  }

  // Empty state — user has no rooms
  return <NoRoomsState />
}
