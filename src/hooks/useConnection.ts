import { useEffect, useRef, useState, useCallback } from 'react'
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
    const supabase = createClient()

    // Use a lightweight presence channel to monitor connection health
    const channel = supabase.channel('connection-monitor')

    channel
      .on('system', { event: '*' } as any, (payload: any) => {
        // Supabase Realtime system events include connection status
        if (payload?.type === 'close' || payload?.type === 'error') {
          setStatus('disconnected')
          wasDisconnectedRef.current = true
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (wasDisconnectedRef.current) {
            setStatus('connected')
            wasDisconnectedRef.current = false
            onReconnectRef.current?.()
          } else {
            setStatus('connected')
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('disconnected')
          wasDisconnectedRef.current = true
        } else if (status === 'CLOSED') {
          setStatus('disconnected')
          wasDisconnectedRef.current = true
        }
      })

    // Also listen to browser online/offline as a fast signal
    const handleOffline = () => {
      setStatus('disconnected')
      wasDisconnectedRef.current = true
    }

    const handleOnline = () => {
      setStatus('reconnecting')
      // Supabase will auto-reconnect; the channel subscribe callback
      // above will fire 'SUBSCRIBED' and trigger onReconnect
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    if (!navigator.onLine) {
      setStatus('disconnected')
      wasDisconnectedRef.current = true
    }

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return status
}
