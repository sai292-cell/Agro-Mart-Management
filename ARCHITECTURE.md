# Shivshree Agro Mart OS — System Architecture & Conventions

## 1. System Overview

**Shivshree Agro Mart OS** is designed as a modular, lightweight, high-reliability web application structured for agricultural retail operations in Maharashtra, India. The application employs a decoupled architecture with a React + Vite frontend and a Node.js + Express REST backend backed by MongoDB Atlas.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT SURFACES                                   |
|                                                                                   |
|   +---------------------------------------+   +-------------------------------+   |
|   |   Owner & Staff Management Portal     |   |   Customer / Farmer Portal    |   |
|   |  (POS, Stock, Ledger, Reports, i18n)  |   | (Passbook, Invoices, Catalog) |   |
|   +---------------------------------------+   +-------------------------------+   |
+-----------------------------------------------------------------------------------+
                                         |
                       HTTPS REST Requests (/api/v1)
                                         |
+-----------------------------------------------------------------------------------+
|                             BACKEND API (Express.js)                              |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Security & Middleware Layer:                                              |   |
|   | - Helmet & CORS Policy       - Rate Limiter (authRateLimiter)             |   |
|   | - requireDbReady Middleware  - Centralized Error Handler                  |   |
|   | - CookieParser               - Audit Logging System                       |   |
|   | - requireAuth                - requireRole('OWNER', 'MANAGER', 'CASHIER') |   |
|   | - requireSameShop            - requireCustomerSelf                        |   |
|   +---------------------------------------------------------------------------+   |
|                                         |                                         |
|   +---------------------------------------------------------------------------+   |
|   | API Endpoints (/api/v1):                                                  |   |
|   | - /health & /health/ready                                                 |   |
|   | - /auth (login, logout, refresh, me, customer OTP)                        |   |
|   | - /staff (list, create staff, role update, status toggle)                 |   |
|   | - /categories (list, create, update)                                      |   |
|   | - /products (list, create, details, update, toggle status, low stock)      |   |
|   | - /inventory (receipt, adjustment, stock overview, batches FEFO, ledger)   |   |
|   +---------------------------------------------------------------------------+   |
|                                         |                                         |
|   +---------------------------------------------------------------------------+   |
|   | Mongoose Connection Layer (src/config/db.js):                             |   |
|   | - Resilient DNS SRV resolution with fallback (8.8.8.8, 1.1.1.1)           |   |
|   | - maxPoolSize: 10 (Optimized for Atlas M0 Free Tier)                      |   |
|   | - serverSelectionTimeoutMS: 15000ms                                       |   |
|   | - Graceful connection closure on SIGTERM / SIGINT                         |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
                                         |
                                Mongoose Connection
                                         |
+-----------------------------------------------------------------------------------+
|                     DATABASE (MongoDB Atlas - shivshree_agro_mart)                |
|                                                                                   |
| Models:                                                                           |
| - Shop           - User (RBAC)    - Customer       - Category (Bilingual)         |
| - Product        - Batch (FEFO)   - StockMovement  - Supplier                     |
| - AuditLog (Immutable)            - RefreshToken   - OtpVerification              |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```
Shivshree Agro Mart OS/
├── client/                       # Frontend application (React 19 + Vite 6 + Tailwind v4)
│   ├── public/                   # Favicon
│   ├── src/
│   │   ├── app/                  # App.jsx, router.jsx (/admin/inventory, /admin/pos, /admin/credit, /admin/suppliers, /admin/purchases, /admin/expenses, /admin/cashbook, /admin/daily-closing, /admin/reports)
│   │   ├── components/
│   │   │   ├── auth/             # ProtectedRoute.jsx
│   │   │   ├── common/           # Button, Card, Badge, ApiHealthBadge, LanguageSwitcher
│   │   │   ├── credit/           # CollectCreditPaymentModal, ManualAdjustmentModal, OpeningBalanceModal,
│   │   │   │                     # ReverseEntryModal, UpdateCreditLimitModal, CustomerStatementModal,
│   │   │   │                     # ReconciliationReportModal
│   │   │   ├── inventory/        # ProductFormModal, ProductDetailsModal, StockReceiptModal,
│   │   │   │                     # StockAdjustmentModal, CategoryModal
│   │   │   ├── pos/              # QuickCustomerModal, RecordPaymentModal, CancelInvoiceModal,
│   │   │   │                     # InvoiceReceiptModal
│   │   │   ├── purchase/         # NewPurchaseModal, PurchaseViewModal, CancelPurchaseModal, PurchaseReturnModal
│   │   │   ├── supplier/         # SupplierFormModal, RecordSupplierPaymentModal, SupplierAdjustmentModal,
│   │   │   │                     # SupplierOpeningBalanceModal, ReverseSupplierEntryModal, SupplierStatementModal,
│   │   │   │                     # SupplierReconciliationModal
│   │   │   ├── expense/          # NewExpenseModal, ApproveRejectExpenseModal, ReverseExpenseModal
│   │   │   ├── cashbook/         # OpenDrawerModal, CloseDrawerModal
│   │   │   └── layout/           # RootLayout, Navbar, Footer, PageContainer
│   │   ├── contexts/             # AuthContext.jsx (in-memory access tokens, silent restore)
│   │   ├── i18n/                 # i18next configuration and mr/en translation bundles
│   │   ├── pages/
│   │   │   ├── admin/            # AdminDashboardPage.jsx, InventoryDashboardPage.jsx, PosBillingPage.jsx,
│   │   │   │                     # CreditLedgerPage.jsx, SupplierManagementPage.jsx, PurchaseInwardPage.jsx,
│   │   │   │                     # ExpenseManagementPage.jsx, CashbookPage.jsx, DailyClosingPage.jsx, ReportsPage.jsx
│   │   │   ├── customer/         # CustomerDashboardPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── OwnerLoginPage.jsx
│   │   │   ├── CustomerLoginPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── services/             # api.js (products, categories, batches, stock movements, invoices, credit ledger, suppliers, purchases, expenses, cashbook, closing, reports)
│   │   ├── index.css             # Tailwind CSS v4 entry & brand theme tokens
│   │   └── main.jsx              # React DOM entry
│   ├── package.json
│   └── vite.config.js
├── server/                       # Backend REST API (Node.js + Express + Mongoose)
│   ├── src/
│   │   ├── config/               # db.js (Atlas connection), env.js (Zod validation)
│   │   ├── controllers/          # authController, staffController, categoryController, productController,
│   │   │                         # inventoryController, billingController, customerController,
│   │   │                         # supplierController, purchaseController, expenseController,
│   │   │                         # cashbookController, dailyClosingController, reportController, healthController
│   │   ├── middleware/           # authMiddleware.js, dbReady.js, errorHandler.js, rateLimiter.js
│   │   ├── models/               # Shop, User, Customer, Category, Product, Batch, StockMovement, Supplier,
│   │   │                         # Invoice, Payment, Counter, CustomerLedgerEntry, PaymentAllocation,
│   │   │                         # Purchase, SupplierLedgerEntry, Expense, CashDrawerSession, AuditLog, RefreshToken, OtpVerification
│   │   ├── routes/               # authRoutes, staffRoutes, categoryRoutes, productRoutes,
│   │   │                         # inventoryRoutes, billingRoutes, customerRoutes, supplierRoutes,
│   │   │                         # purchaseRoutes, expenseRoutes, cashbookRoutes, dailyClosingRoutes, reportRoutes, healthRoutes, index.js
│   │   ├── scripts/              # provisionOwner.js (CLI one-time owner setup)
│   │   ├── utils/                # tokenUtils, stockUtils, transactionUtils, ledgerUtils, purchaseUtils, supplierLedgerUtils, cashbookUtils, profitabilityUtils
│   │   ├── validators/           # authValidators, productValidators, billingValidators, customerValidators,
│   │   │                         # supplierValidators, purchaseValidators, expenseValidators, cashbookValidators
│   │   ├── app.js                # Express app setup (Helmet, CORS, JSON, CookieParser, routes)
│   │   └── server.js             # HTTP server bootstrap, Atlas connection & graceful shutdown
│   ├── test/                     # Automated test suite using Node.js native test runner
│   │   ├── auth.test.js          # Password hashing, JWT verification, Zod auth validators
│   │   ├── models.test.js        # Schema validation, units, money precision, immutability
│   │   ├── health.test.js        # Liveness, readiness, secret-masking assertions
│   │   ├── product_inventory.test.js # Product CRUD, duplicate SKU, stock integrity, FEFO, RBAC
│   │   ├── billing.test.js       # POS checkouts, FEFO, integer paise, tax calculations, invoice cancellations
│   │   ├── credit_ledger.test.js # Ledger immutability, payment allocation, aging, adjustments, reconciliation
│   │   ├── supplier_purchase.test.js # Purchase bills, supplier ledger AP, tax math, FIFO, returns, reversals
│   │   └── expenses_cash_reports.test.js # Expenses, cash drawer sessions, daily closing reconciliation, batch COGS, margins
│   ├── package.json
│   └── .env.example
├── .env.example                  # Root safe environment template
├── .gitignore                    # Root git exclusions (strictly ignores .env and credentials)
├── ARCHITECTURE.md               # System design and conventions (this file)
├── PROJECT_PLAN.md               # Detailed feature roadmap and milestones
├── README.md                     # Installation, execution, and Atlas configuration guide
└── PROGRESS.md                   # Live project status and test verification results
```

---

## 3. Authentication & Session Architecture

### 3.1 Token Management & Storage Guidelines
- **Access Tokens**: Short-lived JWTs (15 minutes).
  - Stored strictly **in memory** within React `AuthContext` on the client side.
  - **Never stored in `localStorage` or `sessionStorage`** to prevent XSS credential theft.
  - Signed with `HS256`, explicit `issuer: 'shivshree-agro-mart'`, and `audience: 'shivshree-agro-mart-client'`.
- **Refresh Tokens**: Longer-lived cryptographically signed tokens (7 days).
  - Transported strictly via **HTTP-only, SameSite=lax, Secure in production** cookies scoped to `/api/v1/auth`.
  - Stored as SHA-256 hashes in MongoDB `RefreshToken` collection with TTL index for automatic expiry.
  - **Token Rotation**: Each call to `POST /api/v1/auth/refresh` revokes the old refresh token and issues a new one.
  - **Revocation on Logout**: `POST /api/v1/auth/logout` revokes the refresh session in MongoDB and clears the browser cookie.

### 3.2 Password Hashing & Security
- Passwords hashed using **bcrypt** with **12 salt rounds**.
- Schema configuration marks `passwordHash` with `select: false` so hashes are never returned in standard queries.
- `formatSafeUser()` utility strips `passwordHash`, token secrets, and internal fields before sending JSON responses.
- Generic error messages (`INVALID_CREDENTIALS`) prevent account enumeration.

### 3.3 Rate Limiting
- `authRateLimiter` enforces a ceiling of **10 requests per 15-minute window** per IP address on all login and OTP endpoints.
- Exceeding the rate limit returns `HTTP 429 Too Many Requests`.

---

## 4. Role-Based Access Control (RBAC) & Scoping

Four roles are recognized and enforced on the backend:

| Role | Permitted Actions | Permission Boundary |
| :--- | :--- | :--- |
| **`OWNER`** | Provision staff (Manager/Cashier), manage pricing, supplier costs, P&L analytics, view audit logs. | Primary shop super-admin. Cannot be created or promoted via public APIs. |
| **`MANAGER`** | Manage inventory, receive stock from suppliers, view customer ledgers, daily sales summary. | Cannot create or promote accounts to `OWNER`. Cannot access owner profit margins. |
| **`CASHIER`** | POS counter billing, stock lookup, collection receipts. | Counter operations only. Cannot view supplier purchase prices or net profits. |
| **`CUSTOMER`** | Self-service passbook (bills, credit balance, payment receipts). | Strictly sandboxed to own customer record. Zero access to store financials. |

### Authorization Middlewares:
1. `requireAuth`: Validates JWT access token, checks active user status in DB, attaches `req.user`.
2. `requireRole(...roles)`: Verifies role membership.
3. `requireSameShop`: Rejects cross-shop data modification.
4. `requireCustomerSelf`: Restricts `CUSTOMER` users to queries where `customerId === req.user.customerId`.

---

## 5. Account Provisioning Strategy

### 5.1 Initial Owner Provisioning (CLI)
- **Zero Public Owner Registration**: There is no public registration endpoint for owners.
- **One-Time CLI Setup**: Run `npm run seed:owner` with parameters:
  ```bash
  node src/scripts/provisionOwner.js --name="Owner Name" --email="owner@example.com" --password="StrongPassword123!"
  ```
- **Guards**:
  - Rejects weak passwords (requires min 10 chars, uppercase, lowercase, number, special char).
  - Checks if an `OWNER` already exists for the shop. If present, **strictly aborts** to prevent account overwrite or duplication.
  - Emits immutable `AuditLog` entry.
  - Never prints or exposes the password.

### 5.2 Staff Account Provisioning
- Handled via `POST /api/v1/staff` by an authenticated `OWNER`.
- Only allows assigning `MANAGER` or `CASHIER` roles.
- Emits immutable `AuditLog` entry for every staff created, role changed, or status toggled.

### 5.3 Customer Account Linking
- Customers are identified by their mobile number registered during retail purchases at the mart.
- Authenticated via short-lived 6-digit OTP (`POST /api/v1/auth/customer/login-request` and `/verify-otp`).
- Once verified, the customer's phone links to their `Customer` document.
- Development mode provides a test OTP (`123456`) which is **strictly forbidden and blocked in production** via `env.js` validation.

---

## 6. Point-of-Sale (POS) Billing & Invoicing Engine

### 6.1 Schema & Data Integrity Design
- **Invoice & Embedded `InvoiceItem` Decision**:
  - An invoice is a point-in-time legal tax document. Once finalized, its items must never mutate if products are later renamed, re-categorized, or re-priced in the catalog.
  - Therefore, `InvoiceItem` is implemented as an **embedded snapshot array** in `Invoice`. It preserves `productId`, `batchId`, `nameSnapshot`, `skuSnapshot`, `unitSnapshot`, `unitSellingPricePaise`, `taxableAmountPaise`, `gstRate`, `cgstPaise`, `sgstPaise`, and `lineTotalPaise`.
- **Payment Collection**:
  - Recorded in the `Payment` collection referencing `invoiceId`, `shopId`, and `customerId`.
  - Captures `paymentMode` (`CASH`, `UPI`), integer `amountPaise`, `transactionReference` (UTR for UPI), and the responsible staff member (`receivedBy`).
  - Outstanding balances are computed derived values (`balancePaise = grandTotalPaise - paidPaise`), preventing unsynchronized balances.
- **Shop-Scoped Concurrent Sequence Counter**:
  - To prevent duplicate bill numbers or race conditions under concurrent counter checkouts, invoice numbers are generated via an atomic MongoDB `Counter.getNextSequence(shopId, 'INVOICE')`. Format: `INV-YYYYMM-XXXXX`.

### 6.2 Financial & Tax Calculation Engine
- **Integer Paise Representation**: All monetary quantities (`unitSellingPricePaise`, `taxableAmountPaise`, `cgstPaise`, `sgstPaise`, `discountPaise`, `grandTotalPaise`, `paidPaise`, `balancePaise`) are stored as whole integers in paise (₹1.00 = 100 paise).
- **Tax-Inclusive Retail Standard**:
  - Retail agro counters in Maharashtra display tax-inclusive MRP/selling prices.
  - Server-side tax engine computes:
    $$\text{taxableAmountPaise} = \text{round}\left(\frac{\text{lineGrossPaise} \times 100}{100 + \text{gstRate}}\right)$$
    $$\text{totalTaxPaise} = \text{lineGrossPaise} - \text{taxableAmountPaise}$$
    $$\text{cgstPaise} = \lfloor\text{totalTaxPaise} / 2\rfloor, \quad \text{sgstPaise} = \text{totalTaxPaise} - \text{cgstPaise}$$
  - Frontend calculations are never trusted; every line item and grand total is re-computed and verified on the server.
  - *Accounting Note*: Statutory tax rates (0%, 5%, 12%, 18%, 28%) and invoice compliance must be reviewed by the mart's certified accountant prior to live filing.

### 6.3 Atomic Stock Deduction & FEFO Allocation
- During checkout, the engine performs atomic First-Expired-First-Out (FEFO) allocation across active, non-expired, and non-quarantined batches.
- Multi-document consistency is guaranteed via MongoDB ACID transactions (`withTransaction` with `{ requireTransaction: true }`).
- If MongoDB transactions are unavailable in the target environment, POS finalization strictly aborts with `HTTP 500 TRANSACTION_REQUIRED` rather than performing unsafe partial writes.
- Deductions create immutable `StockMovement` records of type `SALE_OUTWARD` linked to the `invoiceId`.

### 6.4 Idempotency & Duplicate Prevention
- Both `Invoice` and `Payment` models enforce shop-scoped partial unique indexes on `idempotencyKey`.
- Network retries with the same `Idempotency-Key` return the existing finalized record without re-deducting stock or recording duplicate payments.

### 6.5 Cancellation & Reversal Traceability
- Finalized invoices cannot be destructively edited or deleted.
- Cancellations require `OWNER` or `MANAGER` authority and a mandatory reason (min 5 characters).
- Inventory is safely restored via traceable `StockMovement` entries of type `RETURN_INWARD`.

---

## 7. Customer Credit Ledger (Khaata / Udhaari) & Passbook Engine

### 7.1 Ledger Architecture & Accounting Convention
- **Single Source of Truth**: The customer ledger integrates directly with `Invoice` and `Payment` documents rather than operating as an isolated or competing record.
- **Double-Entry Convention for Farmer Accounts**:
  - **DEBIT (नावे)**: Increases the amount owed by the farmer to the mart.
    - Used for: Credit purchases (`CREDIT_SALE`), approved debit adjustments (`ADJUSTMENT` with `DEBIT`), and historical paper khata debit opening balances (`OPENING_BALANCE` with `DEBIT`).
  - **CREDIT (जमा)**: Reduces the amount owed by the farmer to the mart.
    - Used for: Inward payments (`PAYMENT_RECEIVED`), sales returns/credit notes (`SALE_RETURN`, `CREDIT_NOTE`), authorized credit adjustments/waivers (`ADJUSTMENT` with `CREDIT`), reversals (`REVERSAL`), and customer advance credits (`OPENING_BALANCE` with `CREDIT`).
  - **Net Outstanding Balance**:
    $$\text{BalancePaise} = \sum(\text{DEBITS}) - \sum(\text{CREDITS})$$
    - A positive balance ($\text{BalancePaise} > 0$) represents debt owed by the farmer.
    - A negative balance ($\text{BalancePaise} < 0$) represents an advance credit balance held by the customer at the shop.
- **Integer Paise Standard**: Every monetary amount (`amountPaise`, `runningBalancePaise`, `allocatedPaise`, `creditLimitPaise`) is strictly stored as a whole integer in paise (₹1.00 = 100 paise). Floating-point arithmetic is strictly forbidden.

### 7.2 Immutability & Reversal Traceability
- **Immutable Records**: Mongoose middleware hooks (`pre('save')`, `pre('findOneAndUpdate')`, `pre('deleteOne')`) strictly prevent direct modifications or deletion of finalized `CustomerLedgerEntry` records.
- **Balance Editing Forbidden**: Staff can never directly edit a calculated customer balance field.
- **Reversals with Audit Trail**:
  - Erroneous entries are neutralized strictly via authorized `REVERSAL` counter-entries.
  - The counter-entry records the opposite transaction type (a DEBIT is reversed by a CREDIT, and vice versa), references the `originalEntryId`, and requires a mandatory reason (min 5 characters).
  - The original entry is flagged with `isReversed: true` and `reversedByEntryId` for transparent two-way auditing.

### 7.3 Payment Allocation & Advances
- **Multi-Invoice FIFO Allocation**:
  - When a farmer makes an account-level payment, funds are automatically applied FIFO (First-In-First-Out) to their oldest unpaid/partial invoices.
- **Custom Invoice Allocations**:
  - Staff can explicitly designate allocations to specific invoices.
- **Unallocated Advance Credit**:
  - If a payment exceeds total outstanding invoice debt, the surplus is preserved as unallocated advance credit on the customer's account rather than rejected or lost.
  - Future credit purchases consume advance credits automatically.
- **Traceable `PaymentAllocation` Records**:
  - Every application of money to an invoice creates a `PaymentAllocation` document referencing `paymentId`, `invoiceId`, `customerId`, and integer `allocatedAmountPaise`.

### 7.4 Customer Credit Profiles & Aging Analysis
- **Credit Policy & Limits**:
  - `creditLimitPaise`: Maximum credit ceiling allowed for the farmer. Editable only by `OWNER` or `MANAGER` with mandatory audit reasoning.
  - `availableCreditPaise`: Dynamically calculated as $\max(0, \text{creditLimitPaise} - \text{balancePaise})$.
  - Cashier checkouts automatically check available credit and block credit sales exceeding limits unless approved.
- **Aging Analysis Buckets**:
  - Invoices with unpaid balances are segmented into aging buckets based on invoice issue date:
    - Current (0–30 days)
    - Past Due (31–60 days)
    - Delinquent (61–90 days)
    - Highly Delinquent (90+ days)
- **Status Indicators**: `ACTIVE`, `CREDIT_BLOCKED`, or `INACTIVE` determined by payment delinquency and administrative policy.

### 7.5 Reconciliation & Integrity Engine
- **Independent Reconciliation Service** (`reconcileCustomerAccount`):
  - Computes raw sums from the immutable `CustomerLedgerEntry` collection and cross-references them against all `Invoice` documents and `Payment` documents.
  - Verifies:
    1. Ledger total debits equal total invoice gross amounts.
    2. Ledger total credits match verified customer payments and valid reversals.
    3. Invoice remaining balances equal invoice total minus all recorded `PaymentAllocation` items.
    4. Reversal entries maintain reciprocal links to original entries.
    5. Balances adhere to configured credit limits.
  - Returns structured audit reports with `isConsistent: true/false` and explicit anomaly flags.
  - Discrepancies are reported for manual authorized review; the system never performs destructive silent database mutations.

### 7.6 Customer Portal Sandboxing
- **Phone OTP Verification**: Customers access their personal portal using short-lived 6-digit OTP verification.
- **Strict Tenant & Self Isolation**:
  - Endpoints (`/api/v1/customers/portal/profile`, `/api/v1/customers/portal/passbook`) derive customer identity strictly from `req.user.customerId`.
  - Customer IDs provided via URL query or request body are ignored, preventing horizontal privilege escalation or cross-farmer data leaks.

---

## 8. Supplier Management, Purchase Inward & Accounts Payable Engine

### 8.1 Supplier Directory & Master Profile
- **Shop-Scoped Isolation**: All supplier records are strictly filtered and validated against `req.user.shopId`.
- **Master Profile Fields**:
  - Legal business name, contact person name.
  - Primary contact phone, secondary phone, email.
  - Full address, village/city, district, state, and 6-digit postal pincode.
  - GSTIN format validated via statutory regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
  - Supplier category (`MANUFACTURER`, `DISTRIBUTOR`, `WHOLESALER`, `OTHER`).
  - Credit terms: `paymentTermsDays`, `creditLimitPaise`.
  - Bank details: `accountName`, `accountNumber`, `bankName`, `ifscCode`, `branch`.
  - Audit metadata: `createdBy`, `updatedBy`, `notes`, `isActive`.
- **Referential Integrity & Soft Deactivation**:
  - Suppliers referenced by purchase documents or ledger entries cannot be hard deleted.
  - Activation status can be toggled via `isActive`. Inactive suppliers cannot be selected for new purchases.
  - Sensible phone uniqueness prevents accidental duplicate supplier profiles without rejecting legitimate shared phone numbers across branches.

### 8.2 Inward Purchase Workflow & FEFO Batch Traceability
- **Document Model (`Purchase`)**:
  - Auto-generated sequence number `PUR-YYYYMM-XXXXX` via atomic shop-scoped counter.
  - Supplier invoice number, supplier invoice date, purchase date, entry date, and receiving staff member (`receivedBy`).
  - Line items (`PurchaseItem` embedded snapshots):
    - `productId`, `productName`, `sku`, `categoryName`, `unit`.
    - Batch details: `batchNumber`, `manufacturingDate`, `expiryDate`.
    - Quantities: `quantityReceived`, `freeQuantity`.
    - Pricing in integer paise: `unitPurchasePricePaise`, `unitSellingPricePaise` (MRP / Retail selling price).
    - Discounts & Taxes: `discountPercent`, `discountPaise`, `taxableAmountPaise`, `gstRate`, `cgstPaise`, `sgstPaise`, `igstPaise`, `lineTotalPaise`.
  - Additional freight/loading charges (`additionalChargesPaise`), auto round-off (`roundOffPaise`), grand total (`grandTotalPaise`).
  - Payment details: `paymentMode` (`CREDIT`, `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`), `immediatePaymentPaise`, `creditAmountPaise`.
  - Status lifecycle: `DRAFT` -> `RECEIVED` -> `CANCELLED`.
- **Two-Phase Inward Processing**:
  - **DRAFT**: Created for staging, quotation review, or advance delivery checks. **Strictly zero stock updates and zero payable ledger entries**.
  - **RECEIVED**: Explicit authorized action executed inside an ACID transaction (`withTransaction`):
    1. Iterates over line items and creates or finds corresponding `Batch` documents.
    2. Batch stock is incremented by `quantityReceived + freeQuantity`.
    3. Preserves `manufacturingDate` and `expiryDate` so the downstream FEFO (First-Expired-First-Out) POS billing engine continues to function smoothly.
    4. Records immutable `StockMovement` entries of type `INWARD` linked to `purchaseId` and batch.
    5. Re-computes and syncs `Product.totalStock`.
    6. If `creditAmountPaise > 0`, posts a `CREDIT` entry to `SupplierLedgerEntry` (`PURCHASE_INVOICE`).
    7. If `immediatePaymentPaise > 0`, creates a `Payment` record with direction `OUTFLOW` and creates a `PaymentAllocation` against the purchase.
    8. Enforces idempotency via `idempotencyKey` to prevent concurrent duplicate stock inward.

### 8.3 Accounts Payable (AP) Double-Entry Ledger
- **Single Source of Truth**: Accounts payable balances are derived from the immutable `SupplierLedgerEntry` collection and cross-validated with `Purchase` and `Payment` documents.
- **Double-Entry Sign Convention for Supplier Accounts**:
  - **CREDIT (जमा)**: Increases the liability owed by the mart to the supplier.
    - Used for: Credit purchases (`PURCHASE_INVOICE`), supplier debit notes (`DEBIT_NOTE`), historical paper opening payable balances (`OPENING_BALANCE` with `CREDIT`), and authorized adjustments.
  - **DEBIT (नावे)**: Decreases the liability owed by the mart to the supplier.
    - Used for: Outward payments (`PAYMENT_MADE`), purchase returns (`PURCHASE_RETURN`), supplier credit notes/rebates (`CREDIT_NOTE`), authorized debit adjustments, reversals (`REVERSAL`), and supplier advances (`OPENING_BALANCE` with `DEBIT`).
  - **Net Outstanding Balance**:
    $$\text{BalancePaise} = \sum(\text{CREDITS}) - \sum(\text{DEBITS})$$
    - A positive balance ($\text{BalancePaise} > 0$) represents debt owed by the mart to the supplier (Accounts Payable).
    - A negative balance ($\text{BalancePaise} < 0$) represents an advance credit balance held with the supplier.
- **Integer Paise Representation**: All financial values are strictly whole integers in paise (₹1.00 = 100 paise).
- **Append-Only Immutability**:
  - Mongoose middleware hooks (`pre('save')`, `pre('findOneAndUpdate')`, `pre('deleteOne')`) block direct edits or deletions of posted ledger records.
  - Erroneous entries are neutralized strictly via authorized `REVERSAL` counter-entries with opposite transaction type, referenced `originalEntryId`, and mandatory audit reasoning.

### 8.4 Multi-Invoice Payment Allocation & Advances
- **Payment Allocation Modes**:
  - **FIFO Allocation**: Automatically distributes payment across the supplier's oldest unpaid or partially paid purchase bills.
  - **Custom Allocation**: Staff can designate explicit amounts to specific purchase bills.
- **Supplier Advances**:
  - Payments exceeding total outstanding purchase debt are stored as unallocated advances on the supplier account.
  - Future purchase bills consume unallocated advance balances.
- **Aging Analysis Buckets**:
  - Unpaid purchase bills are grouped into aging buckets based on purchase date and payment terms:
    - Current (0–30 days)
    - Past Due (31–60 days)
    - Delinquent (61–90 days)
    - Overdue (90+ days)

### 8.5 Controlled Returns & Cancellations
- **Stock-Guarded Purchase Returns (`PURCHASE_RETURN`)**:
  - Returns strictly validate current batch stock via `getProductStock` before processing. If goods have already been sold to farmers, the return is rejected to prevent negative inventory balances.
  - Returns decrease batch stock via `StockMovement` of type `PURCHASE_RETURN` and post a `DEBIT` entry to `SupplierLedgerEntry`.
- **Purchase Cancellation**:
  - Only `DRAFT` or `RECEIVED` purchases can be cancelled by `OWNER` or `MANAGER` with a mandatory reason.
  - Cancelling a received purchase reverses inward stock via `RETURN_OUTWARD` stock movements and neutralizes the purchase payable entry.

### 8.6 Reconciliation Engine (`reconcileSupplierAccount`)
- Validates that supplier ledger credits match purchase invoices and opening balances.
- Validates that supplier ledger debits match payments made and purchase returns.
- Validates that purchase remaining payable balances match grand totals minus allocations.
- Flags any discrepancy for manual authorized review without silent mutations.

---

## 9. Operating Expenses, Cash Management, Daily Closing & Profitability Engine

### 9.1 Operating Expense Management & Approval Workflows
- **Shop-Scoped Operating Expense Model (`Expense`)**:
  - Auto-generated sequential sequence `EXP-YYYYMM-XXXXX` via atomic shop-scoped Counter.
  - Required fields: `amountPaise` (strictly integer paise), `expenseDate`, `category`, `description`, `paymentMode` (`CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`), `payee`, and audit timestamps.
  - Standard categories: Rent, electricity, water, internet/mobile, staff salaries & labor, transport/fuel/freight, shop maintenance, stationery & packaging bags, bank charges, tea & refreshments, and miscellaneous.
  - Document reference: Secure text reference (`receiptDocumentRef`) for physical filing vouchers; no unvalidated public file uploads.
- **Role-Based Approval Workflow**:
  - Cashier submissions automatically enter `PENDING_APPROVAL` status.
  - Owner and Manager submissions are auto-approved upon creation (`APPROVED`).
  - Owner and Manager have dedicated endpoints to approve (`PATCH /api/v1/expenses/:id/approve`) or reject with mandatory reason (`PATCH /api/v1/expenses/:id/reject`).
- **Append-Only Immutability & Reversals**:
  - Mongoose pre-hooks (`pre('save')`, `pre('findOneAndUpdate')`, `pre('deleteOne')`) block direct edits or deletions of approved expenses.
  - Erroneous vouchers are corrected strictly via authorized `REVERSAL` counter-entries (`POST /api/v1/expenses/:id/reverse`) with mandatory audit reasons (min 5 chars) and two-way reciprocal links (`reversedByExpenseId` $\leftrightarrow$ `originalExpenseId`).

### 9.2 Physical Cash Drawer Sessions & Variance Reconciliation
- **Drawer Session Lifecycle (`CashDrawerSession`)**:
  - At most **one** active open drawer session is permitted per shop at any time, enforced via partial unique index `{ shopId: 1, status: 1 }` where `status: 'OPEN'`.
  - **Opening Session**: Staff enters verified physical cash float in integer paise (`openingCashPaise`) and opening notes.
  - **Closing Session**: Staff enters actual counted closing cash (`closingCashCountedPaise`).
  - **Live Expected Cash Calculation**:
    $$\text{ExpectedClosingCash} = \text{OpeningCash} + \text{CashInflows} - \text{CashOutflows}$$
  - **Variance Detection**:
    $$\text{VariancePaise} = \text{ClosingCashCountedPaise} - \text{ExpectedCashPaise}$$
    - Variance = 0: Perfect match (तंतोतंत मेळ).
    - Variance > 0: Surplus cash in drawer (अतिरिक्त रोकड).
    - Variance < 0: Cash deficit / shortage (रोकड तूट).
    - If variance is non-zero, an explanatory note (min 3 characters) is strictly mandatory before closing can be finalized.
  - Multi-document transactions ensure atomic session closure and snapshot generation.

### 9.3 Fund Segregation (Physical Drawer vs Digital Channels)
- **Zero Double-Counting & Strict Fund Isolation**:
  - **Physical Cash Drawer**: Includes only physical cash movements:
    - Inflows: Cash POS sales and Cash farmer credit repayments.
    - Outflows: Cash supplier payments and Cash operating expenses.
  - **Digital Non-Drawer Channels**: UPI payments, QR collections, and Bank Transfers are settled directly to the mart's commercial bank accounts.
  - **Strict Principle**: Digital funds (UPI / Bank) are **never added to the physical cash drawer float** or expected closing cash calculation. They are reported in dedicated non-drawer analytical sections.

### 9.4 Daily Closing & Transaction Reconciliation
- **Daily Closing Report (`/api/v1/daily-closing/summary`)**:
  - Aggregates all transactions for the business day without double-counting:
    1. Opening drawer float.
    2. Cash sales from finalized POS invoices.
    3. Cash credit collections from customer ledger payments.
    4. Cash supplier payments from outward settlement payments.
    5. Cash operating expenses from approved expense vouchers.
    6. Expected closing cash vs actual counted closing cash.
    7. Cash variance and discrepancy explanations.
    8. Independent totals for UPI sales, Bank transfers, and credit sales generated.
  - Printable semantic HTML closing voucher for physical cash register filing.

### 9.5 Batch-Based Cost of Goods Sold (COGS) & Profitability Engine
- **Traceable COGS Calculation**:
  - COGS is calculated directly from the verified `purchaseCostPaisePerBaseUnit` of the **actual batch sold** in each `InvoiceItem`:
    $$\text{COGS}_{\text{item}} = \text{round}(\text{QuantitySold}_{\text{base}} \times \text{BatchPurchaseCost}_{\text{base}})$$
  - **Safeguards**:
    - Never uses current catalog selling price as cost.
    - Never assumes total purchases in a period equal COGS for that period (avoids distorting inventory investment as period cost).
    - Cancelled invoices are strictly excluded from sales and COGS.
    - Items missing linked batch purchase costs are transparently flagged with `hasEstimates: true` and reported as cost disclosures rather than fabricating values.
- **Managerial Profitability Metrics**:
  - **Net Sales**: $\text{Gross Sales} - \text{Line Discounts}$.
  - **Gross Profit**: $\text{Net Sales} - \text{COGS}$.
  - **Gross Margin %**: $\frac{\text{Gross Profit}}{\text{Net Sales}} \times 100$.
  - **Operating Profit**: $\text{Gross Profit} - \text{Approved Operating Expenses}$.
  - **Operating Margin %**: $\frac{\text{Operating Profit}}{\text{Net Sales}} \times 100$.
- **Inventory Valuation**:
  - Physical stock value is derived directly from active batches:
    $$\text{Valuation} = \sum_{\text{batches}} (\text{AvailableStock} \times \text{BatchPurchaseCost})$$

### 9.6 Financial Disclosure & Reporting Safeguards
- All reports feature standard managerial accounting disclosure banners:
  > *Managerial estimate based on batch purchase costs recorded at stock inward. This report is for operational management and does not constitute a statutory audit, legal balance sheet, or GST filing.*
- Staff permissions boundary: Reports, daily closing reconciliations, and expense approvals are strictly restricted to `OWNER` and `MANAGER` roles. Cashiers have operational access limited to registering drawer sessions and submitting expense drafts.




