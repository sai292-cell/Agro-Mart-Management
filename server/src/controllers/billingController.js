import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Counter } from '../models/Counter.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { withTransaction } from '../utils/transactionUtils.js';
import {
  calculateLineItemFinancials,
  allocateBatchStock,
} from '../utils/billingUtils.js';
import { recordCustomerLedgerEntry } from '../utils/ledgerUtils.js';
import {
  checkoutInvoiceSchema,
  addPaymentSchema,
  cancelInvoiceSchema,
} from '../validators/billingValidators.js';

/**
 * POST /api/v1/invoices
 * Finalizes a POS billing sale with atomic stock deduction and payment verification.
 * Restricted to OWNER, MANAGER, and CASHIER.
 */
export async function checkoutInvoice(req, res, next) {
  try {
    const parseResult = checkoutInvoiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const {
      customerId,
      customerName,
      customerPhone,
      customerVillage,
      saleType,
      items: inputItems,
      discountPaise = 0,
      discountAuthorizedBy,
      payments: inputPayments = [],
      notes,
    } = parseResult.data;

    const shopId = req.user.shopId;
    const actorRole = req.user.role;
    const idempotencyKey =
      req.headers['idempotency-key'] || parseResult.data.idempotencyKey || null;

    // 1. Idempotency Check: Return existing invoice if already processed
    if (idempotencyKey) {
      const existing = await Invoice.findOne({ shopId, idempotencyKey });
      if (existing) {
        const payments = await Payment.find({ shopId, invoiceId: existing._id });
        return res.status(200).json({
          success: true,
          data: {
            invoice: existing,
            payments,
            isDuplicate: true,
          },
        });
      }
    }

    // 2. Validate Customer Reference
    let customerDoc = null;
    let finalCustomerName = customerName || 'Walk-in Customer (रोख ग्राहक)';
    let finalCustomerPhone = customerPhone || '';
    let finalCustomerVillage = customerVillage || '';

    if (customerId) {
      customerDoc = await Customer.findOne({ _id: customerId, shopId });
      if (!customerDoc) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Referenced customer does not exist in this shop.',
          },
        });
      }
      if (!customerDoc.active) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CUSTOMER_INACTIVE',
            message: 'Referenced customer account is currently inactive.',
          },
        });
      }
      finalCustomerName = customerDoc.name;
      finalCustomerPhone = customerDoc.phone || finalCustomerPhone;
      finalCustomerVillage = customerDoc.village || finalCustomerVillage;
    }

    // 3. Atomically execute Sale Finalization, Stock Deduction, and Payment Creation
    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // Prepare Line Items Snapshot & verify stock availability
      const finalItems = [];
      let calculatedItemsSubtotalPaise = 0;
      let calculatedTaxableTotalPaise = 0;
      let calculatedCgstTotalPaise = 0;
      let calculatedSgstTotalPaise = 0;
      let calculatedTaxTotalPaise = 0;

      for (const itemInput of inputItems) {
        const product = await Product.findOne(
          { _id: itemInput.productId, shopId },
          null,
          queryOptions
        );

        if (!product) {
          const err = new Error(`Product not found with ID ${itemInput.productId}`);
          err.statusCode = 404;
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }

        if (!product.active) {
          const err = new Error(`Product ${product.nameEn} is inactive and cannot be sold.`);
          err.statusCode = 400;
          err.code = 'PRODUCT_INACTIVE';
          throw err;
        }

        const unitSellingPricePaise =
          itemInput.unitSellingPricePaise ?? product.defaultSellingPricePaise;

        // Cashier cannot unilaterally discount unit selling price below default without authorization
        if (actorRole === 'CASHIER' && unitSellingPricePaise < product.defaultSellingPricePaise) {
          const err = new Error(
            `Cashier cannot lower selling price below standard rate (₹${(product.defaultSellingPricePaise / 100).toFixed(2)}) without manager authorization.`
          );
          err.statusCode = 403;
          err.code = 'UNAUTHORIZED_PRICE_OVERRIDE';
          throw err;
        }

        // Allocate active batches (FEFO) and verify positive active stock
        const batchAllocations = await allocateBatchStock(
          shopId,
          product,
          itemInput.quantityBase,
          itemInput.batchId,
          session
        );

        for (const alloc of batchAllocations) {
          const financials = calculateLineItemFinancials(
            alloc.quantityBase,
            unitSellingPricePaise,
            itemInput.lineDiscountPaise || 0,
            product.taxClassification
          );

          calculatedItemsSubtotalPaise += financials.lineTotalPaise;
          calculatedTaxableTotalPaise += financials.taxableAmountPaise;
          calculatedCgstTotalPaise += financials.cgstPaise;
          calculatedSgstTotalPaise += financials.sgstPaise;
          calculatedTaxTotalPaise += financials.taxTotalPaise;

          finalItems.push({
            productId: product._id,
            sku: product.sku,
            nameEn: product.nameEn,
            nameMr: product.nameMr,
            brand: product.brand || '',
            batchId: alloc.batch ? alloc.batch._id : null,
            batchNumber: alloc.batch ? alloc.batch.batchNumber : '',
            expiryDate: alloc.batch ? alloc.batch.expiryDate : null,
            baseUnit: product.baseUnit,
            packSize: product.packSize || 1,
            quantityBase: alloc.quantityBase,
            unitSellingPricePaise,
            lineDiscountPaise: itemInput.lineDiscountPaise || 0,
            taxableAmountPaise: financials.taxableAmountPaise,
            hsnCode: financials.hsnCode,
            gstRatePercent: financials.gstRatePercent,
            cgstPaise: financials.cgstPaise,
            sgstPaise: financials.sgstPaise,
            igstPaise: 0,
            taxTotalPaise: financials.taxTotalPaise,
            lineTotalPaise: financials.lineTotalPaise,
          });
        }
      }

      // Check authorization on invoice-level discount
      if (discountPaise > 0) {
        // If discount exceeds 5% of subtotal or ₹50 (5000 paise), require manager/owner authorization
        const maxUnapprovedCashierDiscountPaise = Math.min(
          5000,
          Math.round(calculatedItemsSubtotalPaise * 0.05)
        );
        if (
          actorRole === 'CASHIER' &&
          discountPaise > maxUnapprovedCashierDiscountPaise &&
          !discountAuthorizedBy
        ) {
          const err = new Error(
            `Invoice discount of ₹${(discountPaise / 100).toFixed(2)} exceeds cashier limit and requires manager authorization.`
          );
          err.statusCode = 403;
          err.code = 'UNAUTHORIZED_DISCOUNT';
          throw err;
        }
      }

      const netBeforeRoundOff = Math.max(0, calculatedItemsSubtotalPaise - discountPaise);
      const roundedRupeesPaise = Math.round(netBeforeRoundOff / 100) * 100;
      const roundOffPaise = roundedRupeesPaise - netBeforeRoundOff;
      const grandTotalPaise = netBeforeRoundOff + roundOffPaise;

      // Validate Payments
      let totalPaidPaise = 0;
      const paymentMethodsUsed = [];
      const paymentReferences = [];

      for (const p of inputPayments) {
        totalPaidPaise += p.amountPaise;
        if (!paymentMethodsUsed.includes(p.paymentMethod)) {
          paymentMethodsUsed.push(p.paymentMethod);
        }
        if (p.referenceId) {
          paymentReferences.push(p.referenceId);
        }
      }

      // Enforce: Payments cannot exceed valid amount due
      if (totalPaidPaise > grandTotalPaise) {
        const err = new Error(
          `Total payments (₹${(totalPaidPaise / 100).toFixed(2)}) cannot exceed grand total (₹${(grandTotalPaise / 100).toFixed(2)}).`
        );
        err.statusCode = 400;
        err.code = 'EXCESS_PAYMENT';
        throw err;
      }

      const balanceDuePaise = grandTotalPaise - totalPaidPaise;

      // Enforce: Credit / unpaid balance strictly requires an identified customer
      const isCreditSale =
        balanceDuePaise > 0 || paymentMethodsUsed.includes('CREDIT');
      if (isCreditSale && !customerDoc) {
        const err = new Error(
          'Credit sales or partial payments strictly require selecting an identified customer record (Walk-in credit is not permitted).'
        );
        err.statusCode = 400;
        err.code = 'CUSTOMER_REQUIRED_FOR_CREDIT';
        throw err;
      }

      // Check customer credit limit if configured
      if (customerDoc && customerDoc.creditLimitPaise > 0 && balanceDuePaise > 0) {
        if (balanceDuePaise > customerDoc.creditLimitPaise && actorRole === 'CASHIER') {
          const err = new Error(
            `Credit balance (₹${(balanceDuePaise / 100).toFixed(2)}) exceeds customer credit limit (₹${(customerDoc.creditLimitPaise / 100).toFixed(2)}). Owner or Manager authorization required.`
          );
          err.statusCode = 403;
          err.code = 'CREDIT_LIMIT_EXCEEDED';
          throw err;
        }
      }

      let paymentStatus = 'UNPAID';
      if (balanceDuePaise === 0) {
        paymentStatus = 'PAID';
      } else if (totalPaidPaise > 0) {
        paymentStatus = 'PARTIALLY_PAID';
      }

      // Generate atomic shop-scoped sequential invoice number
      const currentYear = new Date().getFullYear();
      const sequenceSeq = await Counter.getNextSequence(
        shopId,
        `INVOICE_${currentYear}`,
        session
      );
      const invoiceNumber = `INV-${currentYear}-${String(sequenceSeq).padStart(5, '0')}`;

      // Create Invoice Document
      const [invoice] = await Invoice.create(
        [
          {
            shopId,
            invoiceNumber,
            customerId: customerDoc ? customerDoc._id : null,
            customerName: finalCustomerName,
            customerPhone: finalCustomerPhone,
            customerVillage: finalCustomerVillage,
            saleType,
            status: 'FINALIZED',
            paymentStatus,
            items: finalItems,
            itemsSubtotalPaise: calculatedItemsSubtotalPaise,
            discountPaise,
            discountAuthorizedBy: discountAuthorizedBy || null,
            taxableTotalPaise: calculatedTaxableTotalPaise,
            cgstTotalPaise: calculatedCgstTotalPaise,
            sgstTotalPaise: calculatedSgstTotalPaise,
            igstTotalPaise: 0,
            taxTotalPaise: calculatedTaxTotalPaise,
            roundOffPaise,
            grandTotalPaise,
            paidAmountPaise: totalPaidPaise,
            balanceDuePaise,
            paymentMethodsUsed,
            paymentReferences,
            createdBy: req.userId,
            notes: notes ? notes.trim() : '',
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        queryOptions
      );

      // Create Outward Stock Deductions in immutable StockMovement ledger
      for (const item of finalItems) {
        await StockMovement.create(
          [
            {
              shopId,
              productId: item.productId,
              batchId: item.batchId,
              movementType: 'OUTWARD_SALE',
              quantityBase: -Math.abs(item.quantityBase), // Authoritative negative stock reduction
              referenceType: 'INVOICE',
              referenceId: invoice.invoiceNumber,
              createdBy: req.userId,
              reason: `POS retail sale invoice ${invoice.invoiceNumber}`,
            },
          ],
          queryOptions
        );
      }

      // Create Payment records for received amounts
      const createdPayments = [];
      for (const p of inputPayments) {
        const [paymentDoc] = await Payment.create(
          [
            {
              shopId,
              invoiceId: invoice._id,
              customerId: customerDoc ? customerDoc._id : null,
              amountPaise: p.amountPaise,
              paymentMethod: p.paymentMethod,
              referenceId: p.referenceId || '',
              receivedBy: req.userId,
              status: 'VERIFIED',
              notes: p.notes || '',
            },
          ],
          queryOptions
        );
        createdPayments.push(paymentDoc);
      }

      // Record in Customer Credit Ledger & Payment Allocations if linked to customer with credit
      if (customerDoc && (balanceDuePaise > 0 || isCreditSale)) {
        for (const pDoc of createdPayments) {
          await PaymentAllocation.create(
            [
              {
                shopId,
                customerId: customerDoc._id,
                paymentId: pDoc._id,
                invoiceId: invoice._id,
                allocatedAmountPaise: pDoc.amountPaise,
                allocatedBy: req.userId,
                notes: `Allocated at checkout for invoice ${invoice.invoiceNumber}`,
              },
            ],
            queryOptions
          );
        }

        // 1. Debit full invoice amount to customer's ledger
        await recordCustomerLedgerEntry(
          {
            shopId,
            customerId: customerDoc._id,
            entryType: 'CREDIT_SALE',
            transactionType: 'DEBIT',
            amountPaise: grandTotalPaise,
            referenceType: 'INVOICE',
            referenceId: invoice.invoiceNumber,
            invoiceId: invoice._id,
            description: `Credit purchase on invoice ${invoice.invoiceNumber}`,
            recordedBy: req.userId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}_sale_debit` : null,
          },
          queryOptions
        );

        // 2. If downpayment made at counter, record credit entry in ledger
        if (totalPaidPaise > 0) {
          await recordCustomerLedgerEntry(
            {
              shopId,
              customerId: customerDoc._id,
              entryType: 'PAYMENT_RECEIVED',
              transactionType: 'CREDIT',
              amountPaise: totalPaidPaise,
              referenceType: 'INVOICE',
              referenceId: invoice.invoiceNumber,
              invoiceId: invoice._id,
              paymentId: createdPayments[0]?._id || null,
              description: `Counter payment on invoice ${invoice.invoiceNumber}`,
              recordedBy: req.userId,
              idempotencyKey: idempotencyKey ? `${idempotencyKey}_sale_credit` : null,
            },
            queryOptions
          );
        }
      }

      // Audit Log for Finalized Sale
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'INVOICE_FINALIZED',
            entityType: 'INVOICE',
            entityId: invoice._id.toString(),
            reason: `Finalized POS sale ${invoice.invoiceNumber} for ₹${(grandTotalPaise / 100).toFixed(2)}`,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              grandTotalPaise,
              paidAmountPaise: totalPaidPaise,
              balanceDuePaise,
              itemCount: finalItems.length,
              paymentMethodsUsed,
              hasCredit: isCreditSale,
            },
          },
        ],
        queryOptions
      );

      return { invoice, payments: createdPayments };
    }, { requireTransaction: true });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'BILLING_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * GET /api/v1/invoices/:id
 * Fetches complete invoice details, line items, and payment transactions.
 * Accessible to OWNER, MANAGER, CASHIER, and sandboxed CUSTOMER.
 */
export async function getInvoiceDetails(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;
    const userRole = req.user.role;

    const invoice = await Invoice.findOne({ _id: id, shopId })
      .populate('createdBy', 'name role')
      .populate('cancelledBy', 'name role')
      .populate('customerId', 'name phone village taluka creditLimitPaise');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found in this shop.',
        },
      });
    }

    // Customer sandbox check: Customer may ONLY view their own invoices
    if (userRole === 'CUSTOMER') {
      if (
        !req.user.customerId ||
        !invoice.customerId ||
        invoice.customerId._id.toString() !== req.user.customerId.toString()
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CUSTOMER_DATA_SANDBOX_VIOLATION',
            message: 'You are strictly restricted to accessing your own invoices.',
          },
        });
      }
    }

    const payments = await Payment.find({ shopId, invoiceId: invoice._id })
      .populate('receivedBy', 'name role')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: {
        invoice,
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/invoices
 * Lists and searches invoices with pagination, status, and date range filters.
 */
export async function listInvoices(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userRole = req.user.role;
    const {
      page = 1,
      limit = 20,
      search,
      status,
      paymentStatus,
      customerId,
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { shopId };

    // Customers strictly constrained to their own bills
    if (userRole === 'CUSTOMER') {
      if (!req.user.customerId) {
        return res.status(200).json({
          success: true,
          data: {
            invoices: [],
            pagination: { total: 0, page: 1, limit: limitNum, totalPages: 1 },
          },
        });
      }
      query.customerId = req.user.customerId;
    } else if (customerId) {
      query.customerId = customerId;
    }

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
      ];
    }

    const [totalInvoices, invoices] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.find(query)
        .populate('createdBy', 'name role')
        .populate('customerId', 'name phone village')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          total: totalInvoices,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalInvoices / limitNum) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/invoices/:id/payments
 * Records a verified payment against an outstanding balance on an existing invoice.
 * Restricted to OWNER, MANAGER, and CASHIER.
 */
export async function recordPaymentAgainstInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = addPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { amountPaise, paymentMethod, referenceId, notes, idempotencyKey } =
      parseResult.data;

    // Idempotency check
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ shopId, idempotencyKey });
      if (existingPayment) {
        return res.status(200).json({
          success: true,
          data: {
            payment: existingPayment,
            isDuplicate: true,
          },
        });
      }
    }

    const invoice = await Invoice.findOne({ _id: id, shopId });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found in this shop.',
        },
      });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVOICE_CANCELLED',
          message: 'Cannot record payments against a cancelled invoice.',
        },
      });
    }

    if (invoice.balanceDuePaise <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVOICE_ALREADY_PAID',
          message: 'This invoice has already been fully paid.',
        },
      });
    }

    if (amountPaise > invoice.balanceDuePaise) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EXCESS_PAYMENT',
          message: `Payment amount (₹${(amountPaise / 100).toFixed(2)}) exceeds balance due (₹${(invoice.balanceDuePaise / 100).toFixed(2)}).`,
        },
      });
    }

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Create Payment record
      const [payment] = await Payment.create(
        [
          {
            shopId,
            invoiceId: invoice._id,
            customerId: invoice.customerId,
            amountPaise,
            paymentMethod,
            referenceId: referenceId || '',
            receivedBy: req.userId,
            status: 'VERIFIED',
            notes: notes || '',
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        queryOptions
      );

      // 2. Update Invoice balance and payment status
      invoice.paidAmountPaise += amountPaise;
      invoice.balanceDuePaise -= amountPaise;

      if (invoice.balanceDuePaise === 0) {
        invoice.paymentStatus = 'PAID';
      } else {
        invoice.paymentStatus = 'PARTIALLY_PAID';
      }

      if (!invoice.paymentMethodsUsed.includes(paymentMethod)) {
        invoice.paymentMethodsUsed.push(paymentMethod);
      }
      if (referenceId && !invoice.paymentReferences.includes(referenceId)) {
        invoice.paymentReferences.push(referenceId);
      }

      await invoice.save(queryOptions);

      // Create PaymentAllocation record and post to Customer Credit Ledger
      if (invoice.customerId) {
        await PaymentAllocation.create(
          [
            {
              shopId,
              customerId: invoice.customerId,
              paymentId: payment._id,
              invoiceId: invoice._id,
              allocatedAmountPaise: amountPaise,
              allocatedBy: req.userId,
              notes: `Payment collected against invoice ${invoice.invoiceNumber}`,
            },
          ],
          queryOptions
        );

        await recordCustomerLedgerEntry(
          {
            shopId,
            customerId: invoice.customerId,
            entryType: 'PAYMENT_RECEIVED',
            transactionType: 'CREDIT',
            amountPaise,
            referenceType: 'PAYMENT',
            referenceId: referenceId || invoice.invoiceNumber,
            invoiceId: invoice._id,
            paymentId: payment._id,
            description: `Payment received for invoice ${invoice.invoiceNumber} via ${paymentMethod}`,
            recordedBy: req.userId,
            idempotencyKey: idempotencyKey ? `${idempotencyKey}_ledger_credit` : null,
          },
          queryOptions
        );
      }

      // 3. Audit Log
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'PAYMENT_RECEIVED',
            entityType: 'INVOICE',
            entityId: invoice._id.toString(),
            reason: `Received payment of ₹${(amountPaise / 100).toFixed(2)} via ${paymentMethod} for invoice ${invoice.invoiceNumber}`,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              paymentId: payment._id.toString(),
              amountPaise,
              paymentMethod,
              referenceId,
              remainingBalancePaise: invoice.balanceDuePaise,
            },
          },
        ],
        queryOptions
      );

      return { invoice, payment };
    }, { requireTransaction: true });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'PAYMENT_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * POST /api/v1/invoices/:id/cancel
 * Cancels a finalized invoice, creating traceable reversal stock movements.
 * Strictly restricted to OWNER and authorized MANAGER. CASHIER is denied.
 */
export async function cancelInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = cancelInvoiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { reason } = parseResult.data;

    const invoice = await Invoice.findOne({ _id: id, shopId });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found in this shop.',
        },
      });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVOICE_ALREADY_CANCELLED',
          message: 'This invoice has already been cancelled.',
        },
      });
    }

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Reverse stock movements: Create traceable RETURN_INWARD movements for each sold item
      for (const item of invoice.items) {
        await StockMovement.create(
          [
            {
              shopId,
              productId: item.productId,
              batchId: item.batchId,
              movementType: 'RETURN_INWARD',
              quantityBase: Math.abs(item.quantityBase), // Return stock back to inventory
              referenceType: 'INVOICE',
              referenceId: invoice.invoiceNumber,
              createdBy: req.userId,
              reason: `Reversal for cancelled invoice ${invoice.invoiceNumber}: ${reason.trim()}`,
            },
          ],
          queryOptions
        );
      }

      // 2. Mark payments as CANCELLED
      await Payment.updateMany(
        { shopId, invoiceId: invoice._id },
        { status: 'CANCELLED' },
        queryOptions
      );

      // 3. Reversal entry in Customer Credit Ledger if customer had outstanding debt on this invoice
      if (invoice.customerId && invoice.balanceDuePaise > 0) {
        await recordCustomerLedgerEntry(
          {
            shopId,
            customerId: invoice.customerId,
            entryType: 'REVERSAL',
            transactionType: 'CREDIT',
            amountPaise: invoice.balanceDuePaise,
            referenceType: 'INVOICE',
            referenceId: invoice.invoiceNumber,
            invoiceId: invoice._id,
            description: `Reversal of unpaid balance for cancelled invoice ${invoice.invoiceNumber}: ${reason.trim()}`,
            recordedBy: req.userId,
          },
          queryOptions
        );

        // Mark invoice-associated ledger entries as reversed
        await CustomerLedgerEntry.updateMany(
          { shopId, invoiceId: invoice._id, isReversed: false },
          { $set: { isReversed: true, reversalReason: reason.trim() } },
          queryOptions
        );
      }

      // 4. Update Invoice Status
      invoice.status = 'CANCELLED';
      invoice.cancelledAt = new Date();
      invoice.cancelledBy = req.userId;
      invoice.cancellationReason = reason.trim();
      await invoice.save(queryOptions);

      // 4. Audit Log
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'INVOICE_CANCELLED',
            entityType: 'INVOICE',
            entityId: invoice._id.toString(),
            reason: `Cancelled invoice ${invoice.invoiceNumber}. Reason: ${reason.trim()}`,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              grandTotalPaise: invoice.grandTotalPaise,
              stockReversedItemCount: invoice.items.length,
              authorizedByRole: req.user.role,
            },
          },
        ],
        queryOptions
      );

      return invoice;
    }, { requireTransaction: true });

    return res.status(200).json({
      success: true,
      data: {
        invoice: result,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'CANCELLATION_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * GET /api/v1/invoices/customers
 * POS counter customer lookup (OWNER, MANAGER, CASHIER)
 */
export async function listCustomers(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const { search = '', limit = 50 } = req.query;

    const query = { shopId, active: true };
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { village: { $regex: term, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .lean();

    return res.status(200).json({
      success: true,
      data: { customers },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/invoices/customers
 * Quick-register a customer at POS counter (OWNER, MANAGER, CASHIER)
 */
export async function quickCreateCustomer(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const { name, phone, village, taluka, creditLimitPaise = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Customer name is required',
        },
      });
    }

    let validatedCreditLimitPaise = 0;
    if (creditLimitPaise && Number(creditLimitPaise) > 0) {
      if (req.user.role === 'CASHIER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cashiers cannot assign non-zero credit limits. Owner or Manager approval required.',
          },
        });
      }
      validatedCreditLimitPaise = Math.round(Number(creditLimitPaise));
    }

    const customer = await Customer.create({
      shopId,
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      village: village ? village.trim() : '',
      taluka: taluka ? taluka.trim() : '',
      creditLimitPaise: validatedCreditLimitPaise,
      active: true,
    });

    return res.status(201).json({
      success: true,
      data: { customer },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/invoices/:id/print
 * Render print-ready HTML tax invoice / receipt
 */
export async function printInvoiceHtml(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('Invalid invoice ID');
    }

    const invoice = await Invoice.findOne({ _id: id, shopId })
      .populate('createdBy', 'name')
      .populate('shopId', 'name address phone gstin licenseNumbers')
      .lean();

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Role sandboxing: Customer can only view their own invoice
    if (req.user.role === 'CUSTOMER') {
      const customer = await Customer.findOne({ shopId, linkedUserId: req.userId });
      if (!customer || !invoice.customerId || invoice.customerId.toString() !== customer._id.toString()) {
        return res.status(403).send('Forbidden: Access denied to this invoice');
      }
    }

    const payments = await Payment.find({ shopId, invoiceId: invoice._id })
      .populate('receivedBy', 'name')
      .sort({ paymentDate: 1 })
      .lean();

    const shop = invoice.shopId || { name: 'Shivshree Agro Mart' };

    const formatCurrency = (paise) => '₹' + (Number(paise || 0) / 100).toFixed(2);
    const formatDate = (date) => new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 20px; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 24px; border-radius: 6px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #166534; padding-bottom: 12px; margin-bottom: 16px; }
    .brand h1 { margin: 0; color: #166534; font-size: 22px; }
    .brand p { margin: 2px 0; color: #555; }
    .inv-details { text-align: right; }
    .inv-details h2 { margin: 0; color: #333; font-size: 18px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; text-transform: uppercase; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-partial { background: #fef9c3; color: #854d0e; }
    .badge-unpaid { background: #fee2e2; color: #991b1b; }
    .badge-cancelled { background: #f3f4f6; color: #6b7280; text-decoration: line-through; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; font-size: 12px; }
    .party-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; }
    .party-box h3 { margin: 0 0 6px 0; font-size: 13px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f3f4f6; text-align: left; padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals { width: 320px; margin-left: auto; border: 1px solid #e5e7eb; padding: 12px; border-radius: 4px; background: #fafafa; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
    .totals-row.grand { border-top: 2px solid #166534; padding-top: 6px; font-weight: bold; font-size: 14px; color: #166534; }
    .payments-section { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 12px; font-size: 12px; }
    .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .actions { text-align: center; margin-bottom: 20px; }
    .btn-print { background: #166534; color: white; border: none; padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; }
    @media print {
      .actions { display: none; }
      body { padding: 0; }
      .invoice-card { border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div class="brand">
        <h1>${shop.name || 'Shivshree Agro Mart'}</h1>
        <p>${shop.address?.street || 'Shop No. 4, Market Yard'}, ${shop.address?.village || 'Rahuri'}, ${shop.address?.taluka || 'Rahuri'}, ${shop.address?.district || 'Ahilyanagar'}</p>
        <p>GSTIN: ${shop.gstin || '27AAACS1234F1Z5'} | Ph: ${shop.phone || '9876543210'}</p>
        <p style="font-size: 11px; color: #166534;">Authorised Fertilizer, Seeds & Pesticides Dealer (Maharashtra)</p>
      </div>
      <div class="inv-details">
        <h2>TAX INVOICE</h2>
        <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
        <p><span class="badge badge-${(invoice.status || '').toLowerCase()}">${invoice.status}</span></p>
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <h3>Billed To (Customer):</h3>
        <p><strong>Name:</strong> ${invoice.customerSnapshot?.name || 'Walk-in Customer'}</p>
        ${invoice.customerSnapshot?.phone ? `<p><strong>Phone:</strong> ${invoice.customerSnapshot.phone}</p>` : ''}
        ${invoice.customerSnapshot?.village ? `<p><strong>Village:</strong> ${invoice.customerSnapshot.village}</p>` : ''}
        <p><strong>Sale Type:</strong> ${invoice.saleType}</p>
      </div>
      <div class="party-box">
        <h3>Billed By / Counter:</h3>
        <p><strong>Cashier / Staff:</strong> ${invoice.createdBy?.name || 'Authorized Staff'}</p>
        <p><strong>Payment Status:</strong> ${invoice.status === 'PAID' ? 'Fully Paid' : invoice.status === 'PARTIAL' ? 'Partially Paid' : 'Outstanding'}</p>
        <p><strong>Amount Paid:</strong> ${formatCurrency(invoice.paidPaise)}</p>
        <p><strong>Balance Due:</strong> ${formatCurrency(invoice.balancePaise)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product Description</th>
          <th>Batch / Expiry</th>
          <th>HSN</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Rate (Inc. Tax)</th>
          <th class="text-right">Taxable</th>
          <th class="text-right">GST Rate</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.nameSnapshot}</strong><br><small style="color: #666;">SKU: ${item.skuSnapshot}</small></td>
            <td>${item.batchNumberSnapshot || 'N/A'}<br><small style="color: #666;">${item.expiryDateSnapshot ? new Date(item.expiryDateSnapshot).toLocaleDateString() : ''}</small></td>
            <td>${item.hsnCodeSnapshot || '-'}</td>
            <td class="text-right">${item.quantity} ${item.unitSnapshot}</td>
            <td class="text-right">${formatCurrency(item.unitSellingPricePaise)}</td>
            <td class="text-right">${formatCurrency(item.taxableAmountPaise)}</td>
            <td class="text-right">${item.gstRate}%</td>
            <td class="text-right">${formatCurrency(item.lineTotalPaise)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="font-size: 11px; max-width: 400px; color: #555;">
        <p><strong>Terms & Conditions / अटी व शर्ती:</strong></p>
        <p>1. Goods once sold will not be returned or exchanged without valid original bill / विकलेला माल परत घेतला जाणार नाही.</p>
        <p>2. Subject to local taluka jurisdiction only.</p>
        <p>3. Note: Tax calculations verified by software. Certified tax invoice compliance.</p>
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
        ${invoice.status === 'CANCELLED' ? `<p style="color: red;"><strong>Cancellation Reason:</strong> ${invoice.cancellationReason || 'N/A'}</p>` : ''}
      </div>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal (Taxable):</span>
          <span>${formatCurrency(invoice.taxableSubtotalPaise)}</span>
        </div>
        <div class="totals-row">
          <span>CGST Total:</span>
          <span>${formatCurrency(invoice.cgstTotalPaise)}</span>
        </div>
        <div class="totals-row">
          <span>SGST Total:</span>
          <span>${formatCurrency(invoice.sgstTotalPaise)}</span>
        </div>
        ${invoice.discountPaise > 0 ? `
          <div class="totals-row" style="color: #166534;">
            <span>Discount:</span>
            <span>-${formatCurrency(invoice.discountPaise)}</span>
          </div>
        ` : ''}
        ${invoice.roundOffPaise !== 0 ? `
          <div class="totals-row">
            <span>Round-off:</span>
            <span>${(invoice.roundOffPaise > 0 ? '+' : '')}${formatCurrency(invoice.roundOffPaise)}</span>
          </div>
        ` : ''}
        <div class="totals-row grand">
          <span>Grand Total:</span>
          <span>${formatCurrency(invoice.grandTotalPaise)}</span>
        </div>
        <div class="totals-row" style="margin-top: 6px; font-weight: bold; color: #166534;">
          <span>Paid:</span>
          <span>${formatCurrency(invoice.paidPaise)}</span>
        </div>
        <div class="totals-row" style="font-weight: bold; color: ${invoice.balancePaise > 0 ? '#b91c1c' : '#15803d'};">
          <span>Balance Outstanding:</span>
          <span>${formatCurrency(invoice.balancePaise)}</span>
        </div>
      </div>
    </div>

    ${payments.length > 0 ? `
      <div class="payments-section">
        <h4 style="margin: 0 0 6px 0;">Payment Transactions Recorded:</h4>
        <table style="margin-bottom: 0;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Reference / Txn ID</th>
              <th>Staff</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${formatDate(p.paymentDate)}</td>
                <td><strong>${p.paymentMode}</strong></td>
                <td>${p.transactionReference || '-'}</td>
                <td>${p.receivedBy?.name || 'Staff'}</td>
                <td class="text-right">${formatCurrency(p.amountPaise)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for shopping with ${shop.name || 'Shivshree Agro Mart'}! | शेतकरी समृद्धी हेच आमचे ध्येय!</p>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

