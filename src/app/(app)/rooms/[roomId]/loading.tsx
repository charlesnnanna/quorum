import MessageListSkeleton from '@/components/chat/MessageListSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading UI for the room page.
 * Shown by Next.js while the server component fetches room data + messages.
 */
export default function RoomLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* Message list skeleton */}
      <MessageListSkeleton />

      {/* Input skeleton */}
      <div className="border-t border-border px-4 py-3">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}
