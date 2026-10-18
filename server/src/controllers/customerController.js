import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { CustomerLedgerEntry } from '../models/CustomerLedgerEntry.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { AuditLog } from '../models/AuditLog.js';
import { withTransaction } from '../utils/transactionUtils.js';
import {
  recordCustomerLedgerEntry,
  getCustomerLedgerBalance,
  allocatePaymentToInvoices,
  reconcileCustomerAccount,
  calculateCustomerAging,
} from '../utils/ledgerUtils.js';
import {
  createCustomerSchema,
  customerAccountPaymentSchema,
  customerAdjustmentSchema,
  openingBalanceSchema,
  reverseEntrySchema,
  updateCreditLimitSchema,
} from '../validators/customerValidators.js';

/**
 * GET /api/v1/customers
 * Lists customers with calculated outstanding balances, credit limits, and aging indicators.
 * Accessible to OWNER, MANAGER, and CASHIER.
 */
export async function listCustomers(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const {
      search = '',
      page = 1,
      limit = 25,
      active,
      hasBalance,
      overdueOnly,
    } = req.query;

    const query = { shopId };
    if (active !== undefined && active !== '') {
      query.active = active === 'true';
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { village: { $regex: term, $options: 'i' } },
        { taluka: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawCustomers] = await Promise.all([
      Customer.countDocuments(query),
      Customer.find(query).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    ]);

    // Enhance each customer with their latest ledger balance and aging
    const enhancedCustomers = await Promise.all(
      rawCustomers.map(async (c) => {
        const [outstandingBalancePaise, aging] = await Promise.all([
          getCustomerLedgerBalance(shopId, c._id),
          calculateCustomerAging(shopId, c._id),
        ]);

        const availableCreditPaise = Math.max(0, (c.creditLimitPaise || 0) - outstandingBalancePaise);
        const isOverdue = aging.totalOverduePaise > 0;

        return {
          ...c,
          outstandingBalancePaise,
          availableCreditPaise,
          overdueAmountPaise: aging.totalOverduePaise,
          isOverdue,
          agingBuckets: aging,
        };
      })
    );

    // Apply post-aggregation memory filters if requested
    let finalCustomers = enhancedCustomers;
    if (hasBalance === 'true') {
      finalCustomers = finalCustomers.filter((c) => c.outstandingBalancePaise > 0);
    }
    if (overdueOnly === 'true') {
      finalCustomers = finalCustomers.filter((c) => c.isOverdue);
    }

    return res.status(200).json({
      success: true,
      data: {
        customers: finalCustomers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/:id
 * Fetches comprehensive customer profile, outstanding balance, available credit, and active bills.
 */
export async function getCustomerDetails(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid customer ID' },
      });
    }

    // Role Sandboxing: CUSTOMER role can only access their own linked customer record
    if (userRole === 'CUSTOMER') {
      if (!req.user.customerId || req.user.customerId.toString() !== id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to this customer record' },
        });
      }
    }

    const customer = await Customer.findOne({ _id: id, shopId }).lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found in this shop' },
      });
    }

    const [outstandingBalancePaise, aging, unpaidInvoicesCount, latestPayment] = await Promise.all([
      getCustomerLedgerBalance(shopId, customer._id),
      calculateCustomerAging(shopId, customer._id),
      Invoice.countDocuments({ shopId, customerId: customer._id, status: 'FINALIZED', balanceDuePaise: { $gt: 0 } }),
      Payment.findOne({ shopId, customerId: customer._id, status: 'VERIFIED' }).sort({ createdAt: -1 }).lean(),
    ]);

    const availableCreditPaise = Math.max(0, (customer.creditLimitPaise || 0) - outstandingBalancePaise);

    return res.status(200).json({
      success: true,
      data: {
        customer: {
          ...customer,
          outstandingBalancePaise,
          availableCreditPaise,
          overdueAmountPaise: aging.totalOverduePaise,
          agingBuckets: aging,
          unpaidInvoicesCount,
          lastPaymentDate: latestPayment ? latestPayment.createdAt : customer.lastPaymentDate,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/:id/statement
 * Fetches chronological ledger passbook statement with date filtering and running balances.
 * Supports printable HTML if requested via accept header or format=html query.
 */
export async function getCustomerStatement(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;
    const userRole = req.user.role;
    const {
      startDate,
      endDate,
      page = 1,
      limit = 50,
      format,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid customer ID' } });
    }

    if (userRole === 'CUSTOMER') {
      if (!req.user.customerId || req.user.customerId.toString() !== id) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this statement' } });
      }
    }

    const customer = await Customer.findOne({ _id: id, shopId }).lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } });
    }

    const query = { shopId, customerId: id };
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateQuery.$lte = eDate;
    }
    if (Object.keys(dateQuery).length > 0) {
      query.createdAt = dateQuery;
    }

    // Opening balance before startDate
    let openingBalancePaise = 0;
    if (startDate) {
      const priorEntry = await CustomerLedgerEntry.findOne({
        shopId,
        customerId: id,
        createdAt: { $lt: new Date(startDate) },
      }).sort({ createdAt: -1, _id: -1 }).lean();

      if (priorEntry) {
        openingBalancePaise = priorEntry.runningBalancePaise;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, entries] = await Promise.all([
      CustomerLedgerEntry.countDocuments(query),
      CustomerLedgerEntry.find(query)
        .populate('recordedBy', 'name role')
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    let totalPeriodDebits = 0;
    let totalPeriodCredits = 0;
    entries.forEach((e) => {
      if (e.transactionType === 'DEBIT') totalPeriodDebits += e.amountPaise;
      if (e.transactionType === 'CREDIT') totalPeriodCredits += e.amountPaise;
    });

    const latestBalancePaise = await getCustomerLedgerBalance(shopId, id);

    // If HTML format requested, render a clean print-ready passbook statement
    if (format === 'html' || req.headers.accept?.includes('text/html')) {
      const formatCurrency = (paise) => '₹' + ((Number(paise) || 0) / 100).toFixed(2);
      const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Customer Credit Statement - ${customer.name}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 15px; }
    .header { border-bottom: 2px solid #166534; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; }
    .title h1 { margin: 0; color: #166534; font-size: 20px; }
    .title p { margin: 2px 0; color: #555; font-size: 11px; }
    .statement-info { text-align: right; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; }
    .box h3 { margin: 0 0 5px 0; font-size: 12px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    .text-right { text-align: right; }
    .debit { color: #991b1b; font-weight: bold; }
    .credit { color: #166534; font-weight: bold; }
    .totals-box { width: 280px; margin-left: auto; border: 1px solid #e5e7eb; padding: 10px; background: #fafafa; border-radius: 4px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
    .totals-row.grand { border-top: 2px solid #166534; padding-top: 6px; font-weight: bold; font-size: 13px; color: #166534; }
    .footer { margin-top: 25px; text-align: center; color: #6b7280; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: center;">
    <button onclick="window.print()" style="background: #166534; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">
      🖨️ Print Passbook Statement / प्रत छापा
    </button>
  </div>
  <div class="header">
    <div class="title">
      <h1>शिवश्री ॲग्रो मार्ट / SHIVSHREE AGRO MART</h1>
      <p>कृषी उत्पन्न बाजार समिती, राहुरी, जि. अहिल्यानगर (महाराष्ट्र) | मो. ९८७६५४३२१०</p>
      <p style="color: #166534; font-weight: bold;">शेतकरी खातेवही पासबुक / Farmer Credit Ledger Statement</p>
    </div>
    <div class="statement-info">
      <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
      <p><strong>Period:</strong> ${startDate ? formatDate(startDate) : 'Beginning'} to ${endDate ? formatDate(endDate) : 'Today'}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="box">
      <h3>शेतकऱ्याची माहिती / Farmer Details:</h3>
      <p><strong>Name:</strong> ${customer.name}</p>
      <p><strong>Mobile:</strong> ${customer.phone || 'N/A'} | <strong>Village:</strong> ${customer.village || 'N/A'}</p>
      <p><strong>Taluka:</strong> ${customer.taluka || 'राहुरी'} | <strong>Status:</strong> ${customer.active ? 'सक्रिय (Active)' : 'बंद'}</p>
    </div>
    <div class="box">
      <h3>खाते स्थिती / Account Standing:</h3>
      <p><strong>Credit Limit (मर्यादा):</strong> ${formatCurrency(customer.creditLimitPaise)}</p>
      <p><strong>चालू बाकी शिल्लक (Current Outstanding):</strong> <span class="debit">${formatCurrency(latestBalancePaise)}</span></p>
      <p><strong>उपलब्ध उधारी (Available Credit):</strong> ${formatCurrency(Math.max(0, customer.creditLimitPaise - latestBalancePaise))}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Reference</th>
        <th>Description / तपशील</th>
        <th class="text-right">नावे / Debit (₹)</th>
        <th class="text-right">जमा / Credit (₹)</th>
        <th class="text-right">शिल्लक / Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${startDate ? `
        <tr style="background: #fdfdfd; font-style: italic;">
          <td>${formatDate(startDate)}</td>
          <td>OPENING</td>
          <td>-</td>
          <td>आरंभीची शिल्लक (Opening Balance)</td>
          <td class="text-right">-</td>
          <td class="text-right">-</td>
          <td class="text-right font-bold">${formatCurrency(openingBalancePaise)}</td>
        </tr>
      ` : ''}
      ${entries.map((e) => `
        <tr style="${e.isReversed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          <td>${formatDate(e.createdAt)}</td>
          <td><span style="font-size: 10px; padding: 2px 4px; background: #eee; border-radius: 3px;">${e.entryType}</span></td>
          <td style="font-family: monospace;">${e.referenceId || '-'}</td>
          <td>${e.description}${e.notes ? ` (${e.notes})` : ''}</td>
          <td class="text-right ${e.transactionType === 'DEBIT' ? 'debit' : ''}">
            ${e.transactionType === 'DEBIT' ? formatCurrency(e.amountPaise) : '-'}
          </td>
          <td class="text-right ${e.transactionType === 'CREDIT' ? 'credit' : ''}">
            ${e.transactionType === 'CREDIT' ? formatCurrency(e.amountPaise) : '-'}
          </td>
          <td class="text-right" style="font-weight: bold; font-family: monospace;">
            ${formatCurrency(e.runningBalancePaise)}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-box">
    <div class="totals-row">
      <span>Total Debits (एकूण नावे):</span>
      <span class="debit">${formatCurrency(totalPeriodDebits)}</span>
    </div>
    <div class="totals-row">
      <span>Total Credits (एकूण जमा):</span>
      <span class="credit">${formatCurrency(totalPeriodCredits)}</span>
    </div>
    <div class="totals-row grand">
      <span>Net Outstanding Due:</span>
      <span>${formatCurrency(latestBalancePaise)}</span>
    </div>
  </div>

  <div class="footer">
    <p>शिवश्री ॲग्रो मार्ट, राहुरी — शेतकऱ्यांच्या विश्वासाचे प्रतीक! | सर्व हिशोब संगणकीकृत व प्रमाणित आहेत.</p>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    return res.status(200).json({
      success: true,
      data: {
        customer,
        openingBalancePaise,
        latestBalancePaise,
        totalPeriodDebits,
        totalPeriodCredits,
        entries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customers/:id/payments
 * Records a customer account payment / advance and allocates across unpaid invoices (FIFO or explicit list).
 * Atomically updates Payment, PaymentAllocation, Invoices, and CustomerLedgerEntry.
 */
export async function recordCustomerAccountPayment(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = customerAccountPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const {
      amountPaise,
      paymentMethod,
      referenceId = '',
      notes = '',
      idempotencyKey = null,
      invoiceAllocations = null,
    } = parseResult.data;

    const customer = await Customer.findOne({ _id: id, shopId });
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } });
    }

    // Idempotency check
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ shopId, idempotencyKey });
      if (existingPayment) {
        const existingAllocations = await PaymentAllocation.find({ shopId, paymentId: existingPayment._id });
        return res.status(200).json({
          success: true,
          data: {
            payment: existingPayment,
            allocations: existingAllocations,
            isDuplicate: true,
          },
        });
      }
    }

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Create Payment record for customer account
      const [payment] = await Payment.create(
        [
          {
            shopId,
            customerId: customer._id,
            invoiceId: null, // Account-level deposit/advance
            paymentType: 'ACCOUNT_PAYMENT',
            amountPaise,
            paymentMethod,
            referenceId: referenceId.trim(),
            receivedBy: req.userId,
            status: 'VERIFIED',
            idempotencyKey: idempotencyKey || undefined,
            notes: notes.trim(),
          },
        ],
        queryOptions
      );

      // 2. Allocate payment across outstanding invoices
      const allocationResult = await allocatePaymentToInvoices({
        shopId,
        customerId: customer._id,
        paymentId: payment._id,
        amountPaise,
        allocatedBy: req.userId,
        invoiceAllocations,
        options: queryOptions,
      });

      // 3. Post Credit entry in CustomerLedgerEntry
      const ledgerEntry = await recordCustomerLedgerEntry(
        {
          shopId,
          customerId: customer._id,
          entryType: 'PAYMENT_RECEIVED',
          transactionType: 'CREDIT',
          amountPaise,
          referenceType: 'PAYMENT',
          referenceId: referenceId.trim() || payment._id.toString(),
          paymentId: payment._id,
          description: `Account payment received via ${paymentMethod} (Allocated: ₹${(allocationResult.allocatedPaise / 100).toFixed(2)}${allocationResult.unallocatedAdvancePaise > 0 ? `, Advance: ₹${(allocationResult.unallocatedAdvancePaise / 100).toFixed(2)}` : ''})`,
          recordedBy: req.userId,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}_ledger` : null,
          notes: notes.trim(),
        },
        queryOptions
      );

      // 4. Audit Log
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'CUSTOMER_PAYMENT_COLLECTED',
            entityType: 'CUSTOMER',
            entityId: customer._id.toString(),
            reason: `Collected ₹${(amountPaise / 100).toFixed(2)} via ${paymentMethod} for farmer ${customer.name}`,
            metadata: {
              customerId: customer._id.toString(),
              paymentId: payment._id.toString(),
              amountPaise,
              allocatedPaise: allocationResult.allocatedPaise,
              advancePaise: allocationResult.unallocatedAdvancePaise,
              newBalancePaise: ledgerEntry.runningBalancePaise,
            },
          },
        ],
        queryOptions
      );

      return {
        payment,
        allocations: allocationResult.allocations,
        allocatedPaise: allocationResult.allocatedPaise,
        advancePaise: allocationResult.unallocatedAdvancePaise,
        ledgerEntry,
        newBalancePaise: ledgerEntry.runningBalancePaise,
      };
    }, { requireTransaction: true });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customers/:id/adjustments
 * Authorized manual debit or credit adjustment with mandatory reason.
 * Strictly restricted to OWNER and MANAGER.
 */
export async function recordCustomerAdjustment(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = customerAdjustmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { adjustmentType, amountPaise, reason, notes = '' } = parseResult.data;

    const customer = await Customer.findOne({ _id: id, shopId });
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } });
    }

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      const ledgerEntry = await recordCustomerLedgerEntry(
        {
          shopId,
          customerId: customer._id,
          entryType: 'ADJUSTMENT',
          transactionType: adjustmentType,
          amountPaise,
          referenceType: 'ADJUSTMENT',
          referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
          description: `Authorized ${adjustmentType} adjustment: ${reason.trim()}`,
          recordedBy: req.userId,
          approvedBy: req.userId,
          notes: notes.trim(),
        },
        queryOptions
      );

      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'CUSTOMER_LEDGER_ADJUSTMENT',
            entityType: 'CUSTOMER',
            entityId: customer._id.toString(),
            reason: `Manual ${adjustmentType} adjustment of ₹${(amountPaise / 100).toFixed(2)}: ${reason.trim()}`,
            metadata: {
              adjustmentType,
              amountPaise,
              reason: reason.trim(),
              newBalancePaise: ledgerEntry.runningBalancePaise,
            },
          },
        ],
        queryOptions
      );

      return ledgerEntry;
    }, { requireTransaction: true });

    return res.status(201).json({
      success: true,
      data: {
        adjustment: result,
        newBalancePaise: result.runningBalancePaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customers/:id/opening-balance
 * Sets opening balance for a farmer when migrating historical paper records.
 * Strictly restricted to OWNER and MANAGER.
 */
export async function recordOpeningBalance(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = openingBalanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { balanceType, amountPaise, asOfDate, notes = '' } = parseResult.data;

    const customer = await Customer.findOne({ _id: id, shopId });
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } });
    }

    // Check if customer already has an opening balance entry
    const existingOpening = await CustomerLedgerEntry.findOne({
      shopId,
      customerId: customer._id,
      entryType: 'OPENING_BALANCE',
    });

    if (existingOpening) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OPENING_BALANCE_ALREADY_EXISTS',
          message: 'An opening balance has already been recorded for this farmer. Use adjustments for further changes.',
        },
      });
    }

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      const ledgerEntry = await recordCustomerLedgerEntry(
        {
          shopId,
          customerId: customer._id,
          entryType: 'OPENING_BALANCE',
          transactionType: balanceType,
          amountPaise,
          referenceType: 'OPENING_BALANCE',
          referenceId: 'OPENING',
          description: `Opening balance migration: ${balanceType === 'DEBIT' ? 'Prior debt owed by farmer' : 'Prior advance credit'}`,
          recordedBy: req.userId,
          approvedBy: req.userId,
          notes: notes.trim(),
        },
        queryOptions
      );

      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'CUSTOMER_OPENING_BALANCE_RECORDED',
            entityType: 'CUSTOMER',
            entityId: customer._id.toString(),
            reason: `Recorded opening balance of ₹${(amountPaise / 100).toFixed(2)} (${balanceType}) for ${customer.name}`,
            metadata: {
              balanceType,
              amountPaise,
              asOfDate,
              newBalancePaise: ledgerEntry.runningBalancePaise,
            },
          },
        ],
        queryOptions
      );

      return ledgerEntry;
    }, { requireTransaction: true });

    return res.status(201).json({
      success: true,
      data: {
        entry: result,
        newBalancePaise: result.runningBalancePaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customers/ledger/:entryId/reversal
 * Authorized reversal of an erroneous ledger entry.
 * Strictly restricted to OWNER and MANAGER.
 */
export async function reverseLedgerEntry(req, res, next) {
  try {
    const { entryId } = req.params;
    const shopId = req.user.shopId;

    const parseResult = reverseEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { reason } = parseResult.data;

    const entryToReverse = await CustomerLedgerEntry.findOne({ _id: entryId, shopId });
    if (!entryToReverse) {
      return res.status(404).json({ success: false, error: { code: 'ENTRY_NOT_FOUND', message: 'Ledger entry not found' } });
    }

    if (entryToReverse.isReversed) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REVERSED', message: 'This ledger entry has already been reversed' },
      });
    }

    // Counter transaction type
    const counterTransactionType = entryToReverse.transactionType === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    const result = await withTransaction(async (session) => {
      const queryOptions = session ? { session } : {};

      // 1. Mark original entry as reversed
      entryToReverse.isReversed = true;
      entryToReverse.reversalReason = reason.trim();
      await entryToReverse.save(queryOptions);

      // 2. Create opposite counter-entry
      const reversalEntry = await recordCustomerLedgerEntry(
        {
          shopId,
          customerId: entryToReverse.customerId,
          entryType: 'REVERSAL',
          transactionType: counterTransactionType,
          amountPaise: entryToReverse.amountPaise,
          referenceType: 'REVERSAL',
          referenceId: entryToReverse._id.toString(),
          originalEntryId: entryToReverse._id,
          description: `Reversal of ${entryToReverse.entryType} (#${entryToReverse._id.toString().slice(-6)}): ${reason.trim()}`,
          recordedBy: req.userId,
          approvedBy: req.userId,
          notes: `Reversal reason: ${reason.trim()}`,
        },
        queryOptions
      );

      // 3. Audit Log
      await AuditLog.create(
        [
          {
            shopId,
            actorUserId: req.userId,
            action: 'CUSTOMER_LEDGER_REVERSAL',
            entityType: 'CUSTOMER',
            entityId: entryToReverse.customerId.toString(),
            reason: `Reversed ledger entry ${entryToReverse._id}. Reason: ${reason.trim()}`,
            metadata: {
              reversedEntryId: entryToReverse._id.toString(),
              amountPaise: entryToReverse.amountPaise,
              originalType: entryToReverse.entryType,
              newBalancePaise: reversalEntry.runningBalancePaise,
            },
          },
        ],
        queryOptions
      );

      return reversalEntry;
    }, { requireTransaction: true });

    return res.status(200).json({
      success: true,
      data: {
        reversalEntry: result,
        newBalancePaise: result.runningBalancePaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/customers/:id/credit-limit
 * Updates farmer credit limit. Restricted to OWNER and MANAGER.
 */
export async function updateCustomerCreditLimit(req, res, next) {
  try {
    const { id } = req.params;
    const shopId = req.user.shopId;

    const parseResult = updateCreditLimitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { creditLimitPaise, reason = '' } = parseResult.data;

    const customer = await Customer.findOne({ _id: id, shopId });
    if (!customer) {
      return res.status(404).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' } });
    }

    const previousLimitPaise = customer.creditLimitPaise;
    customer.creditLimitPaise = creditLimitPaise;
    await customer.save();

    await AuditLog.create({
      shopId,
      actorUserId: req.userId,
      action: 'CUSTOMER_CREDIT_LIMIT_UPDATED',
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      reason: reason.trim() || `Credit limit changed from ₹${(previousLimitPaise / 100).toFixed(0)} to ₹${(creditLimitPaise / 100).toFixed(0)}`,
      metadata: {
        previousLimitPaise,
        newLimitPaise: creditLimitPaise,
        authorizedByRole: req.user.role,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        customer,
        previousLimitPaise,
        newLimitPaise: creditLimitPaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/reconciliation/report
 * Audits customer ledger integrity against invoice debt and payment receipts.
 * Strictly restricted to OWNER and MANAGER.
 */
export async function getCustomerReconciliationReport(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const { customerId } = req.query;

    if (customerId) {
      const report = await reconcileCustomerAccount(shopId, customerId);
      return res.status(200).json({ success: true, data: { report } });
    }

    // Shop-wide credit reconciliation
    const creditCustomers = await Customer.find({ shopId, active: true }).lean();
    const reports = await Promise.all(
      creditCustomers.map(async (c) => {
        try {
          return await reconcileCustomerAccount(shopId, c._id);
        } catch (err) {
          return { customerId: c._id, customerName: c.name, isConsistent: false, error: err.message };
        }
      })
    );

    const discrepanciesFound = reports.filter((r) => !r.isConsistent);

    return res.status(200).json({
      success: true,
      data: {
        totalCustomersAudited: creditCustomers.length,
        discrepanciesCount: discrepanciesFound.length,
        isFullyReconciled: discrepanciesFound.length === 0,
        reports,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/my/profile
 * Customer self-service: Returns logged-in farmer's credit standing and balance.
 */
export async function getMyCreditProfile(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.userId;

    const customer = await Customer.findOne({ shopId, linkedUserId: userId }).lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_ACCOUNT_NOT_LINKED', message: 'No registered farmer record linked to this account.' },
      });
    }

    const [outstandingBalancePaise, aging, unpaidInvoicesCount] = await Promise.all([
      getCustomerLedgerBalance(shopId, customer._id),
      calculateCustomerAging(shopId, customer._id),
      Invoice.countDocuments({ shopId, customerId: customer._id, status: 'FINALIZED', balanceDuePaise: { $gt: 0 } }),
    ]);

    const availableCreditPaise = Math.max(0, (customer.creditLimitPaise || 0) - outstandingBalancePaise);

    return res.status(200).json({
      success: true,
      data: {
        customer: {
          ...customer,
          outstandingBalancePaise,
          availableCreditPaise,
          overdueAmountPaise: aging.totalOverduePaise,
          unpaidInvoicesCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/my/passbook
 * Customer self-service: Returns logged-in farmer's passbook statement.
 */
export async function getMyPassbook(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.userId;

    const customer = await Customer.findOne({ shopId, linkedUserId: userId }).lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_ACCOUNT_NOT_LINKED', message: 'No registered farmer record linked.' },
      });
    }

    req.params.id = customer._id.toString();
    return getCustomerStatement(req, res, next);
  } catch (err) {
    next(err);
  }
}
