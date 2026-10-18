import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  village: z.string().trim().max(100).optional(),
  taluka: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  creditLimitPaise: z.number().int().min(0, 'Credit limit cannot be negative').default(0),
  notes: z.string().trim().max(500).optional(),
});

export const customerAccountPaymentSchema = z.object({
  amountPaise: z
    .number()
    .int('Amount must be a whole integer in paise')
    .positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'UPI'], {
    errorMap: () => ({ message: 'Payment method must be CASH or UPI' }),
  }),
  referenceId: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(255).optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
  invoiceAllocations: z
    .array(
      z.object({
        invoiceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid invoice ID format'),
        amountPaise: z.number().int().positive('Allocation amount must be greater than zero'),
      })
    )
    .optional(),
});

export const customerAdjustmentSchema = z.object({
  adjustmentType: z.enum(['DEBIT', 'CREDIT'], {
    errorMap: () => ({ message: 'Adjustment type must be DEBIT or CREDIT' }),
  }),
  amountPaise: z
    .number()
    .int('Adjustment amount must be a whole integer in paise')
    .positive('Amount must be greater than zero'),
  reason: z
    .string()
    .trim()
    .min(5, 'Mandatory reason must be at least 5 characters for statutory audit')
    .max(255),
  notes: z.string().trim().max(500).optional(),
});

export const openingBalanceSchema = z.object({
  balanceType: z.enum(['DEBIT', 'CREDIT'], {
    errorMap: () => ({ message: 'Balance type must be DEBIT (Farmer owes) or CREDIT (Advance)' }),
  }),
  amountPaise: z
    .number()
    .int('Opening balance must be a whole integer in paise')
    .positive('Amount must be greater than zero'),
  asOfDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const reverseEntrySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Mandatory reason must be at least 5 characters for reversal audit')
    .max(255),
});

export const updateCreditLimitSchema = z.object({
  creditLimitPaise: z
    .number()
    .int('Credit limit must be a whole integer in paise')
    .min(0, 'Credit limit cannot be negative'),
  reason: z.string().trim().max(255).optional(),
});
