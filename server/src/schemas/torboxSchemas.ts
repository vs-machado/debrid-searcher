import { z } from 'zod'

export const torboxAddSchema = z.object({
  magnet: z.string().min(1),
  addOnlyIfCached: z.boolean().optional().default(true),
})

export const torboxDownloadSchema = z.object({
  magnet: z.string().min(1),
  infoHash: z.string().trim().min(8).optional(),
  addOnlyIfCached: z.boolean().optional().default(true),
  zipLink: z.boolean().optional().default(true),
})

export const torboxStatusSchema = z.object({
  torrentId: z.coerce.number().int().positive().optional(),
  infoHash: z.string().trim().min(8).optional(),
}).refine((v) => v.torrentId !== undefined || !!v.infoHash, {
  message: 'torrentId or infoHash is required',
})
