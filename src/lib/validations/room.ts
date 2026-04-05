import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  isPrivate: z.boolean().default(false),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const inviteUserSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  userId: z.string().uuid('Invalid user ID'),
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>