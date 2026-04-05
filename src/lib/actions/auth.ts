'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { ServerActionResponse, Profile } from '@/types'

/**
 * Get the current BetterAuth session.
 * Returns the session object or null if not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: headers(),
  })
  return session
}

/**
 * Upsert the current user's profile after a successful BetterAuth sign-in.
 *
 * 1. Upserts the profiles row with name, email-derived username, and avatar.
 * 2. Sets is_online = true and updates last_seen.
 * 3. Creates a "General" room (with the user as owner) if they have no rooms.
 *
 * Uses the service-role client to bypass RLS.
 */
export async function ensureProfile(): Promise<ServerActionResponse<Profile>> {
  const session = await auth.api.getSession({
    headers: headers(),
  })

  if (!session) {
    return { data: null, error: 'Unauthorized' }
  }

  const supabase = createServiceRoleClient()
  const user = session.user

  // Derive a stable username from name or email
  const username =
    user.name?.toLowerCase().replace(/\s+/g, '_') ??
    user.email.split('@')[0]

  // Upsert profile — insert on first sign-in, update on subsequent ones
  const { data: profile, error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username,
        full_name: user.name ?? null,
        avatar_url: user.image ?? null,
        is_online: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (upsertError) {
    return { data: null, error: upsertError.message }
  }

  // Create a "General" room if the user has no rooms yet
  const { count } = await supabase
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count === 0) {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name: 'General',
        description: 'Your first room — invite teammates to get started.',
        is_private: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (!roomError && room) {
      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        role: 'owner',
      })
    }
  }

  return { data: profile, error: null }
}
