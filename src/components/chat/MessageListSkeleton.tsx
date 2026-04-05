'use client'

import { Skeleton } from '@/components/ui/skeleton'

/** A single skeleton message row: avatar circle + text lines. */
function MessageSkeleton({
  align = 'left',
  widths,
}: {
  align?: 'left' | 'right'
  widths: string[]
}) {
  if (align === 'right') {
    return (
      <div className="flex justify-end px-4 pt-3">
        <div className="flex max-w-[70%] flex-col items-end gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-48 rounded-2xl rounded-br-md" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 px-4 pt-3">
      <Skeleton className="size-6 shrink-0 rounded-full" />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-12" />
        </div>
        <div className="space-y-1.5">
          {widths.map((w, i) => (
            <Skeleton key={i} className={`h-3.5 rounded-lg ${w}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton that mimics a date separator line. */
function DateSkeleton() {
  return (
    <div className="flex items-center justify-center py-3">
      <Skeleton className="h-3 w-20 rounded-full" />
    </div>
  )
}

/**
 * Loading skeleton for the message list.
 * Renders a realistic mix of sent/received messages with varying line widths.
 */
export default function MessageListSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end overflow-hidden px-0 pb-2">
      <div className="space-y-0.5">
        <DateSkeleton />
        <MessageSkeleton widths={['w-52', 'w-36']} />
        <MessageSkeleton widths={['w-44']} />
        <MessageSkeleton align="right" widths={[]} />
        <MessageSkeleton widths={['w-60', 'w-48', 'w-28']} />
        <MessageSkeleton align="right" widths={[]} />
        <DateSkeleton />
        <MessageSkeleton widths={['w-40', 'w-56']} />
        <MessageSkeleton widths={['w-32']} />
        <MessageSkeleton align="right" widths={[]} />
        <MessageSkeleton widths={['w-48', 'w-24']} />
      </div>
    </div>
  )
}