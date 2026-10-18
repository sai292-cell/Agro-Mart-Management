import { z } from 'zod';
import { PURCHASE_PAYMENT_MODES } from '../models/Purchase.js';

const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  batchNumber: z.string().trim().max(50).optional().default(''),
  manufacturingDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  freeQuantity: z.coerce.number().min(0, 'Free quantity cannot be negative').optional().default(0),
  purchaseRatePaise: z.coerce.number().int().min(0, 'Purchase rate must be non-negative integer paise'),
  discountPaise: z.coerce.number().int().min(0).optional().default(0),
  gstRate: z.coerce.number().min(0).max(28).optional().default(0),
  sellingPricePaise: z.coerce.number().int().min(0).optional().nullable(),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  supplierInvoiceNumber: z.string().trim().min(1, 'Supplier invoice number is required').max(100),
  supplierInvoiceDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  status: z.enum(['DRAFT', 'RECEIVED']).optional().default('RECEIVED'),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one line item is required'),
  additionalChargesPaise: z.coerce.number().int().min(0).optional().default(0),
  paidPaise: z.coerce.number().int().min(0).optional().default(0),
  paymentMode: z.enum(PURCHASE_PAYMENT_MODES).optional().default('CREDIT'),
  paymentReferenceId: z.string().trim().max(100).optional().default(''),
  isInterstate: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().default(''),
  idempotencyKey: z.string().trim().max(100).optional(),
});

export const receivePurchaseSchema = z.object({
  paidPaise: z.coerce.number().int().min(0).optional(),
  paymentMode: z.enum(PURCHASE_PAYMENT_MODES).optional(),
  paymentReferenceId: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const cancelPurchaseSchema = z.object({
  reason: z.string().trim().min(5, 'Cancellation reason must be at least 5 characters').max(255),
});

export const purchaseReturnSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        batchId: z.string().min(1, 'Batch ID is required'),
        quantity: z.coerce.number().positive('Return quantity must be greater than zero'),
        ratePaise: z.coerce.number().int().min(0, 'Return rate must be integer paise'),
      })
    )
    .min(1, 'At least one return item is required'),
  reason: z.string().trim().min(5, 'Return reason must be at least 5 characters').max(255),
  notes: z.string().trim().max(500).optional().default(''),
});
