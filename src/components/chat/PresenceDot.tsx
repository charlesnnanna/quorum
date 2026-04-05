'use client'

import { cn } from '@/lib/utils'

interface PresenceDotProps {
  isOnline: boolean
  className?: string
}

/**
 * Small colored dot indicating online/offline status.
 * Position this absolutely on an avatar wrapper.
 */
export default function PresenceDot({ isOnline, className }: PresenceDotProps) {
  return (
    <span
      aria-label={isOnline ? 'Online' : 'Offline'}
      className={cn(
        'block h-2.5 w-2.5 rounded-full border-2 border-background',
        isOnline
          ? 'bg-green-500 animate-[presence-pulse_2s_ease-in-out_infinite]'
          : 'bg-muted-foreground/40',
        className
      )}
    />
  )
}