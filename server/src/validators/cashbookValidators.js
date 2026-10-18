import { z } from 'zod';

export const openDrawerSessionSchema = z.object({
  openingCashPaise: z
    .number({ required_error: 'Opening cash in paise is required' })
    .int('Opening cash must be a whole integer in paise')
    .min(0, 'Opening cash cannot be negative'),
  openingNotes: z.string().trim().max(255).optional().default(''),
});

export const closeDrawerSessionSchema = z.object({
  closingCashCountedPaise: z
    .number({ required_error: 'Closing counted cash in paise is required' })
    .int('Closing counted cash must be a whole integer in paise')
    .min(0, 'Closing counted cash cannot be negative'),
  closingNotes: z.string().trim().max(500).optional().default(''),
});
