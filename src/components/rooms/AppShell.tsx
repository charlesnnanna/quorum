'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores/uiStore'
import ConnectionBanner from '@/components/ui/ConnectionBanner'
import MobileDrawer from './MobileDrawer'
import RoomSidebar from './RoomSidebar'
import type { Profile, RoomWithDetails } from '@/types'

interface AppShellProps {
  currentUser: Profile
  initialRooms: RoomWithDetails[]
  children: React.ReactNode
}

/**
 * Responsive app shell layout with three tiers:
 *
 * - **Mobile (< 768px):** Chat always visible. Sidebar opens as a
 *   slide-in drawer overlay triggered by a hamburger button in the header.
 *
 * - **Tablet (768px–1023px):** Narrow 72px icon sidebar always visible
 *   on the left. Chat takes remaining width.
 *
 * - **Desktop (≥ 1024px):** Full 260px sidebar on the left. Chat area
 *   fills the middle. Optional member list panel on the right (lg+).
 */
export default function AppShell({ currentUser, initialRooms, children }: AppShellProps) {
  const pathname = usePathname()
  const setDrawerOpen = useUIStore((s) => s.setDrawerOpen)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Skip-to-content link — visible only on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>

      <ConnectionBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Mobile drawer overlay (< md) ── */}
        <MobileDrawer>
          <RoomSidebar
            currentUser={currentUser}
            initialRooms={initialRooms}
            onNavigate={() => setDrawerOpen(false)}
          />
        </MobileDrawer>

        {/* ── Tablet: compact icon sidebar (md–lg) ── */}
        <nav
          aria-label="Channels"
          className="hidden h-full w-[72px] shrink-0 md:block lg:hidden"
        >
          <RoomSidebar
            currentUser={currentUser}
            initialRooms={initialRooms}
            compact
          />
        </nav>

        {/* ── Desktop: full sidebar (lg+) ── */}
        <nav
          aria-label="Channels"
          className="hidden h-full w-[260px] shrink-0 lg:block"
        >
          <RoomSidebar
            currentUser={currentUser}
            initialRooms={initialRooms}
          />
        </nav>

        {/* ── Main chat area — always visible ── */}
        <main
          id="main-content"
          className="flex h-full flex-1 flex-col overflow-hidden"
        >
          <div
            key={pathname}
            className="flex h-full flex-col"
            style={{ animation: 'room-fade-in 200ms ease-out' }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
