'use client'

import { Hash, Plus, Sparkles, Users } from 'lucide-react'
import { useUIStore } from '@/lib/stores/uiStore'
import { Button } from '@/components/ui/button'

/**
 * Designed empty state shown when the user has no rooms/channels.
 * Displays an illustration and a CTA to create the first channel.
 */
export default function NoRoomsState() {
  const setModal = useUIStore((s) => s.setModal)

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      {/* Illustration: stacked channel cards */}
      <div className="relative mb-6">
        {/* Background cards */}
        <div className="absolute -left-3 -top-2 size-16 rounded-2xl border border-border/60 bg-muted/40 rotate-[-6deg]" />
        <div className="absolute -right-2 -top-1 size-16 rounded-2xl border border-border/60 bg-muted/30 rotate-[4deg]" />
        {/* Main card */}
        <div className="relative flex size-20 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-1">
            <Hash className="size-6 text-muted-foreground" />
            <div className="flex gap-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="size-1.5 rounded-full bg-blue-500" />
              <span className="size-1.5 rounded-full bg-amber-500" />
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold">Create your first channel</h2>
      <p className="mt-1.5 max-w-[280px] text-center text-sm leading-relaxed text-muted-foreground">
        Channels are where your team communicates. Create one to start collaborating.
      </p>

      <Button
        onClick={() => setModal('createRoom')}
        className="mt-5 gap-2"
        size="lg"
      >
        <Plus className="size-4" />
        New Channel
      </Button>

      {/* Feature hints */}
      <div className="mt-8 flex flex-col gap-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 shrink-0" />
          <span>Invite teammates to collaborate in real-time</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 shrink-0" />
          <span>Mention @ai to bring in the AI assistant</span>
        </div>
      </div>
    </div>
  )
}