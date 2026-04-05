'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createRoom } from '@/lib/actions/rooms'
import { createRoomSchema } from '@/lib/validations/room'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface CreateRoomModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Modal for creating a new room/channel.
 * Validates with Zod, calls createRoom server action, and navigates to the new room.
 */
export default function CreateRoomModal({ open, onOpenChange }: CreateRoomModalProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setName('')
    setDescription('')
    setIsPrivate(false)
    setErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const parsed = createRoomSchema.safeParse({ name: name.trim(), description: description.trim() || undefined, isPrivate })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]
        if (key) fieldErrors[String(key)] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)

    const { data, error } = await createRoom(parsed.data)

    setIsSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    if (data) {
      toast.success(`#${data.name} created`)
      reset()
      onOpenChange(false)
      router.push(`/rooms/${data.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) reset(); onOpenChange(isOpen) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. Create one for a topic or project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="room-name" className="text-sm font-medium">
              Channel name <span className="text-destructive">*</span>
            </label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. design-team"
              maxLength={100}
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'room-name-error' : undefined}
              className="text-base md:text-sm"
            />
            {errors.name && (
              <p id="room-name-error" role="alert" className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="room-desc" className="text-sm font-medium">
              Description <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="room-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              maxLength={500}
              rows={2}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'room-desc-error' : undefined}
              className="resize-none text-base md:text-sm"
            />
            {errors.description && (
              <p id="room-desc-error" role="alert" className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Private toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-input px-3 py-2.5">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <div>
              <p className="text-sm font-medium">Make private</p>
              <p className="text-xs text-muted-foreground">
                Only invited members can see and join this channel.
              </p>
            </div>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}