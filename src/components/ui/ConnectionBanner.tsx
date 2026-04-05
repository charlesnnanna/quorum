'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import { useConnection } from '@/hooks/useConnection'

interface ConnectionBannerProps {
  onReconnect?: () => void
}

/**
 * Banner that appears at the top of the app when connectivity is lost.
 * Tracks both browser online/offline and Supabase Realtime channel health.
 * When connectivity is restored, calls `onReconnect` so the parent can
 * reconcile state (flush queued messages, re-fetch latest data).
 */
export default function ConnectionBanner({ onReconnect }: ConnectionBannerProps) {
  const status = useConnection(onReconnect)
  const [showRecovered, setShowRecovered] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    if (status === 'disconnected' || status === 'reconnecting') {
      setWasDisconnected(true)
    }

    if (status === 'connected' && wasDisconnected) {
      setShowRecovered(true)
      setWasDisconnected(false)
      const t = setTimeout(() => setShowRecovered(false), 2500)
      return () => clearTimeout(t)
    }
  }, [status, wasDisconnected])

  const isDisconnected = status === 'disconnected' || status === 'reconnecting'

  if (!isDisconnected && !showRecovered) return null

  return (
    <div
      role="alert"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-colors duration-300 ${
        isDisconnected
          ? 'bg-destructive/10 text-destructive'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      }`}
    >
      {isDisconnected ? (
        <>
          <WifiOff className="size-3.5" />
          <span>Connection lost — messages will be sent when reconnected</span>
          <Loader2 className="size-3 animate-spin" />
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3.5" />
          <span>Back online — syncing messages</span>
        </>
      )}
    </div>
  )
}
