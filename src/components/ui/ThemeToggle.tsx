'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

/**
 * Sun/moon toggle button that cycles through light → dark → system.
 * Shows sun icon in dark mode, moon icon in light mode.
 *
 * Defers rendering the icon until after mount to avoid a hydration mismatch
 * (server always assumes light; client may resolve to dark from localStorage).
 */
export default function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleToggle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const label =
    theme === 'system'
      ? `System theme (${resolved})`
      : `${theme.charAt(0).toUpperCase() + theme.slice(1)} mode`

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={mounted ? `${label}. Click to change.` : 'Toggle theme'}
      className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
    >
      {/* Render a neutral placeholder on the server / first paint to avoid mismatch */}
      {!mounted ? (
        <span className="size-4" />
      ) : resolved === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  )
}
