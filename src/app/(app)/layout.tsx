import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/actions/auth'
import AppShell from '@/components/rooms/AppShell'
import type { RoomWithDetails } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  // 2. Ensure profile exists (upserts on every visit)
  const { data: profile, error: profileError } = await ensureProfile()
  if (!profile) {
    console.error('ensureProfile failed:', profileError)
    redirect('/login?error=profile')
  }

  // 3. Fetch rooms for sidebar
  const supabase = createServiceRoleClient()
  const { data: rooms } = await supabase.rpc('get_user_rooms', {
    p_user_id: session.user.id,
  }) as { data: RoomWithDetails[] | null }

  return (
    <AppShell currentUser={profile} initialRooms={rooms ?? []}>
      {children}
    </AppShell>
  )
}
