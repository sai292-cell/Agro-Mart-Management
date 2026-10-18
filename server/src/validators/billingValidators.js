import { z } from 'zod';
import { PAYMENT_METHODS } from '../models/Payment.js';
import { SALE_TYPES } from '../models/Invoice.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z
  .string({ required_error: 'Valid ID is required' })
  .regex(objectIdRegex, 'Invalid MongoDB ObjectId format');

const invoiceItemInputSchema = z.object({
  productId: objectIdSchema,
  batchId: z.string().regex(objectIdRegex, 'Invalid Batch ObjectId format').optional().nullable(),
  quantityBase: z
    .number({ required_error: 'Quantity in base unit is required' })
    .positive('Quantity must be greater than zero'),
  unitSellingPricePaise: z
    .number()
    .int('Selling price must be an integer in paise')
    .min(0, 'Selling price cannot be negative')
    .optional(),
  lineDiscountPaise: z
    .number()
    .int('Line discount must be an integer in paise')
    .min(0, 'Line discount cannot be negative')
    .optional()
    .default(0),
});

const paymentInputSchema = z
  .object({
    amountPaise: z
      .number({ required_error: 'Payment amount in paise is required' })
      .int('Payment amount must be an integer in paise')
      .positive('Payment amount must be greater than zero'),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` }),
    }),
    referenceId: z.string().trim().max(100).optional().default(''),
    notes: z.string().trim().max(255).optional().default(''),
  })
  .refine(
    (data) => {
      // If method is UPI, require reference ID (UTR / Txn ID)
      if (data.paymentMethod === 'UPI') {
        return data.referenceId && data.referenceId.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Transaction reference ID (UTR / Txn ID) is required for UPI payments',
      path: ['referenceId'],
    }
  );

export const checkoutInvoiceSchema = z
  .object({
    customerId: objectIdSchema.optional().nullable(),
    customerName: z.string().trim().max(100).optional(),
    customerPhone: z.string().trim().max(20).optional(),
    customerVillage: z.string().trim().max(100).optional(),
    saleType: z.enum(SALE_TYPES).optional().default('RETAIL'),
    items: z
      .array(invoiceItemInputSchema)
      .min(1, 'Invoice must contain at least one product item'),
    discountPaise: z
      .number()
      .int('Invoice discount must be an integer in paise')
      .min(0, 'Invoice discount cannot be negative')
      .optional()
      .default(0),
    discountAuthorizedBy: objectIdSchema.optional().nullable(),
    payments: z.array(paymentInputSchema).optional().default([]),
    notes: z.string().trim().max(255).optional().default(''),
    idempotencyKey: z.string().trim().max(100).optional(),
  })
  .refine(
    (data) => {
      // If payment method includes CREDIT or unpaid balance exists, customerId is mandatory!
      const hasCredit = data.payments.some((p) => p.paymentMethod === 'CREDIT');
      if (hasCredit && !data.customerId) {
        return false;
      }
      return true;
    },
    {
      message: 'Identified customer is strictly required for credit sales',
      path: ['customerId'],
    }
  );

export const addPaymentSchema = z
  .object({
    amountPaise: z
      .number({ required_error: 'Payment amount in paise is required' })
      .int('Payment amount must be an integer in paise')
      .positive('Payment amount must be greater than zero'),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` }),
    }),
    referenceId: z.string().trim().max(100).optional().default(''),
    notes: z.string().trim().max(255).optional().default(''),
    idempotencyKey: z.string().trim().max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMethod === 'UPI') {
        return data.referenceId && data.referenceId.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Transaction reference ID (UTR / Txn ID) is required for UPI payments',
      path: ['referenceId'],
    }
  );

export const cancelInvoiceSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is mandatory' })
    .trim()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(255, 'Cancellation reason cannot exceed 255 characters'),
});
