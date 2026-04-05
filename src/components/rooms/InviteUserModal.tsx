'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Search, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { searchUsers, addRoomMember } from '@/lib/actions/rooms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Profile } from '@/types'

interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
  roomName: string
}

/**
 * Modal to search and invite users to a room.
 * Searches by username with debounce, adds via addRoomMember server action.
 */
export default function InviteUserModal({
  open,
  onOpenChange,
  roomId,
  roomName,
}: InviteUserModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingUserId, setAddingUserId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = () => {
    setQuery('')
    setResults([])
    setAddedIds(new Set())
  }

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (value.length < 2) {
        setResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      debounceRef.current = setTimeout(async () => {
        const { data, error } = await searchUsers(value, roomId)
        if (!error && data) {
          setResults(data)
        }
        setIsSearching(false)
      }, 300)
    },
    [roomId]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleInvite = async (userId: string) => {
    setAddingUserId(userId)

    const { error } = await addRoomMember({ roomId, userId })

    setAddingUserId(null)

    if (error) {
      toast.error(error)
      return
    }

    setAddedIds((prev) => new Set(prev).add(userId))
    toast.success('Member added')
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) reset(); onOpenChange(isOpen) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to #{roomName}</DialogTitle>
          <DialogDescription>
            Search by username to add members to this channel.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by username..."
            aria-label="Search users by username"
            autoFocus
            className="pl-8 text-base md:text-sm"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-64">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((user) => {
                const isAdded = addedIds.has(user.id)
                const isAdding = addingUserId === user.id

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent"
                  >
                    <Avatar className="size-9">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(user.full_name ?? user.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.full_name ?? user.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>

                    {isAdded ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Check className="size-3.5" />
                        Added
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInvite(user.id)}
                        disabled={isAdding}
                        aria-label={`Add ${user.full_name ?? user.username} to channel`}
                      >
                        {isAdding ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="size-3.5" />
                        )}
                        Add
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : query.length >= 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users found matching &ldquo;{query}&rdquo;
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}