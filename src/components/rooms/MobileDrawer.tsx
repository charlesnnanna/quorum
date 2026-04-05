'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '@/lib/stores/uiStore'

interface MobileDrawerProps {
  children: React.ReactNode
}

/**
 * Slide-in drawer overlay for the sidebar on mobile screens.
 * Renders a backdrop + drawer panel that slides from the left.
 * Closes on backdrop click, Escape key, or swipe-left gesture.
 */
export default function MobileDrawer({ children }: MobileDrawerProps) {
  const isOpen = useUIStore((s) => s.isDrawerOpen)
  const setOpen = useUIStore((s) => s.setDrawerOpen)

  // Track closing animation
  const isClosingRef = useRef(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Touch tracking for swipe-to-close
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const isDragging = useRef(false)

  const close = useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true

    const drawer = drawerRef.current
    const backdrop = backdropRef.current
    if (drawer) drawer.style.animation = 'drawer-slide-out 200ms ease-in forwards'
    if (backdrop) backdrop.style.animation = 'backdrop-fade-out 200ms ease-in forwards'

    setTimeout(() => {
      setOpen(false)
      isClosingRef.current = false
    }, 200)
  }, [setOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX
    touchCurrentX.current = touchStartX.current
    isDragging.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    touchCurrentX.current = e.touches[0]!.clientX

    const diff = touchCurrentX.current - touchStartX.current
    // Only allow dragging left (to close)
    if (diff < 0) {
      const drawer = drawerRef.current
      if (drawer) {
        drawer.style.transform = `translateX(${diff}px)`
        drawer.style.transition = 'none'
      }
      const backdrop = backdropRef.current
      if (backdrop) {
        const progress = Math.max(0, 1 + diff / 280)
        backdrop.style.opacity = String(progress)
      }
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false

    const diff = touchCurrentX.current - touchStartX.current
    const drawer = drawerRef.current

    if (diff < -80) {
      // Swiped far enough — close
      close()
    } else if (drawer) {
      // Snap back
      drawer.style.transition = 'transform 150ms ease-out'
      drawer.style.transform = 'translateX(0)'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={close}
        className="absolute inset-0 bg-black/50"
        style={{ animation: 'backdrop-fade-in 200ms ease-out forwards' }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] safe-left"
        style={{ animation: 'drawer-slide-in 200ms ease-out forwards' }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        {children}
      </div>
    </div>
  )
}
