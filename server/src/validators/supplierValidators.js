import { z } from 'zod';
import { SUPPLIER_TYPES } from '../models/Supplier.js';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(100),
  contactPerson: z.string().trim().max(100).optional().default(''),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().trim().max(255).optional().default(''),
  villageCity: z.string().trim().max(100).optional().default(''),
  district: z.string().trim().max(100).optional().default('Nashik'),
  state: z.string().trim().max(100).optional().default('Maharashtra'),
  pincode: z.string().trim().max(10).optional().default(''),
  supplierType: z.enum(SUPPLIER_TYPES).optional().default('DISTRIBUTOR'),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)')
    .optional()
    .or(z.literal('')),
  pan: z.string().trim().toUpperCase().max(20).optional().default(''),
  paymentTermsDays: z.coerce.number().int().min(0).optional().default(30),
  creditLimitPaise: z.coerce.number().int().min(0).optional().default(0),
  bankDetails: z
    .object({
      accountName: z.string().trim().optional().default(''),
      accountNumber: z.string().trim().optional().default(''),
      bankName: z.string().trim().optional().default(''),
      ifscCode: z.string().trim().toUpperCase().optional().default(''),
      branch: z.string().trim().optional().default(''),
    })
    .optional(),
  notes: z.string().trim().max(500).optional().default(''),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  active: z.boolean().optional(),
});

export const supplierPaymentSchema = z.object({
  amountPaise: z.coerce.number().int().min(1, 'Payment amount must be at least 1 paise (₹0.01)'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']),
  referenceId: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(255).optional().default(''),
  autoFifo: z.boolean().optional().default(true),
  allocations: z
    .array(
      z.object({
        purchaseId: z.string().min(1, 'Purchase ID is required'),
        amountPaise: z.coerce.number().int().min(1),
      })
    )
    .optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

export const supplierAdjustmentSchema = z.object({
  adjustmentType: z.enum(['CREDIT', 'DEBIT']),
  amountPaise: z.coerce.number().int().min(1, 'Amount must be at least 1 paise'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(255),
  notes: z.string().trim().max(500).optional().default(''),
});

export const supplierOpeningBalanceSchema = z.object({
  balanceType: z.enum(['PAYABLE_CREDIT', 'ADVANCE_DEBIT']),
  amountPaise: z.coerce.number().int().min(1, 'Opening balance amount must be at least 1 paise'),
  asOfDate: z.string().optional(),
  referenceId: z.string().trim().max(100).optional().default('LEGACY_MIGRATION'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(255),
  notes: z.string().trim().max(500).optional().default(''),
});

export const reverseSupplierEntrySchema = z.object({
  reason: z.string().trim().min(5, 'Reversal reason must be at least 5 characters').max(255),
});
