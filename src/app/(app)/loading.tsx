import { Loader2 } from 'lucide-react'

/**
 * Loading UI for the app root — shown while server redirects to the first room.
 */
export default function AppLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
