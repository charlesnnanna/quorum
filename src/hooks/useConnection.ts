import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

/**
 * Tracks the Supabase Realtime connection status.
 *
 * Listens to both browser online/offline events and a dedicated Supabase
 * heartbeat channel. When connectivity is restored, fires the `onReconnect`
 * callback so consumers can reconcile state.
 */
export function useConnection(onReconnect?: () => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connected')
  const wasDisconnectedRef = useRef(false)
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const channel = supabase.channel(`connection-monitor-${Date.now()}`)

    channel
      .on('broadcast', { event: 'heartbeat' }, () => {
        // No-op — listener exists so the channel subscribes successfully
      })
      .subscribe((subscribeStatus) => {
        if (cancelled) return
        if (subscribeStatus === 'SUBSCRIBED') {
          if (wasDisconnectedRef.current) {
            setStatus('connected')
            wasDisconnectedRef.current = false
            onReconnectRef.current?.()
          } else {
            setStatus('connected')
          }
        } else if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          setStatus('disconnected')
          wasDisconnectedRef.current = true
        }
      })

    const handleOffline = () => {
      setStatus('disconnected')
      wasDisconnectedRef.current = true
    }

    const handleOnline = () => {
      setStatus('reconnecting')
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    if (!navigator.onLine) {
      setStatus('disconnected')
      wasDisconnectedRef.current = true
    }

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return status
}
