'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Hash, Loader2, Users, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getPublicRooms, joinRoom } from '@/lib/actions/rooms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { Room } from '@/types'

interface BrowseRoomsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal for discovering and joining public rooms the user hasn't joined yet.
 */
export default function BrowseRoomsModal({ open, onOpenChange }: BrowseRoomsModalProps) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchRooms = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await getPublicRooms()
    if (error) {
      toast.error(error)
    } else {
      setRooms(data ?? [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      fetchRooms()
      setSearch('')
    }
  }, [open, fetchRooms])

  const handleJoin = async (room: Room) => {
    setJoiningId(room.id)
    const { error } = await joinRoom(room.id)
    setJoiningId(null)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(`Joined #${room.name}`)
    onOpenChange(false)
    router.push(`/rooms/${room.id}`)
  }

  const filtered = search
    ? rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rooms

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Browse public channels</DialogTitle>
          <DialogDescription>
            Discover and join public channels created by your team.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            aria-label="Search public channels"
            className="pl-8 text-base md:text-sm"
          />
        </div>

        {/* Room list */}
        <ScrollArea className="max-h-72 overflow-hidden">
          <div className="space-y-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-8 w-14 rounded-md" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60">
                  <Hash className="size-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? 'No matching channels' : 'No public channels to join'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {search
                    ? `No channels match "${search}"`
                    : 'All public channels have been joined, or none exist yet.'}
                </p>
              </div>
            ) : (
              filtered.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Hash className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{room.name}</p>
                    {room.description && (
                      <p className="truncate text-xs text-muted-foreground">{room.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoin(room)}
                    disabled={joiningId === room.id}
                    className="shrink-0 gap-1.5"
                  >
                    {joiningId === room.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Users className="size-3.5" />
                    )}
                    Join
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}