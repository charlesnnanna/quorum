import { z } from 'zod'

export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  roomId: z.string().uuid('Invalid room ID'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type MessageInput = z.infer<typeof messageSchema>