import { z } from 'zod';
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_MODES } from '../models/Expense.js';

export const createExpenseSchema = z.object({
  amountPaise: z
    .number({ required_error: 'Expense amount in paise is required' })
    .int('Amount must be a whole integer in paise')
    .positive('Amount must be greater than zero'),
  expenseDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid expense category' }),
  }),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  paymentMode: z.enum(EXPENSE_PAYMENT_MODES, {
    errorMap: () => ({ message: 'Invalid payment mode' }),
  }),
  referenceNumber: z.string().trim().max(100).optional().default(''),
  payee: z
    .string({ required_error: 'Payee is required' })
    .trim()
    .min(2, 'Payee must be at least 2 characters')
    .max(120, 'Payee cannot exceed 120 characters'),
  receiptDocumentRef: z.string().trim().max(255).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  idempotencyKey: z.string().trim().max(100).optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required' })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(255, 'Rejection reason cannot exceed 255 characters'),
});

export const reverseExpenseSchema = z.object({
  reason: z
    .string({ required_error: 'Reversal reason is required' })
    .trim()
    .min(5, 'Reversal reason must be at least 5 characters')
    .max(255, 'Reversal reason cannot exceed 255 characters'),
});
