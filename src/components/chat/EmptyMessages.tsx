'use client'

import { MessageCircle } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

/**
 * Shown when a room has zero messages.
 * Encourages the user to start the conversation.
 */
export default function EmptyMessages() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={<MessageCircle className="size-7 text-muted-foreground/60" />}
        title="No messages yet"
        description="Start the conversation! Send a message or mention @ai to bring in the assistant."
      />
    </div>
  )
}