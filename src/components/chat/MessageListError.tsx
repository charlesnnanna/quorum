'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessageListErrorProps {
  onRetry: () => void
}

/**
 * Error state shown when messages fail to load.
 * Displays an icon, message, and retry button.
 */
export default function MessageListError({ onRetry }: MessageListErrorProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive/70" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Something went wrong</h3>
          <p className="mt-1 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
            We couldn&apos;t load messages. Check your connection and try again.
          </p>
        </div>
        <Button variant="outline" onClick={onRetry} className="mt-1 gap-2">
          <RefreshCw className="size-3.5" />
          Reload messages
        </Button>
      </div>
    </div>
  )
}