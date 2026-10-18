# Shivshree Agro Mart OS — Project Progress Tracker

## Current Status Overview
- **Project Name**: Shivshree Agro Mart OS
- **Current Milestone**: Phase 10 — End-to-End Integration, Dual Portal Polish & Launch Readiness Audit (Prompt 10)
- **Phase Status**: Completed & Fully Verified
- **Last Updated**: 2026-10-18

---

## Completed Tasks

### Phase 1: Project Foundation & Architecture Documentation
- [x] Workspace inspection, Git baseline commit (`6a136d3`), exclusions (`.gitignore`), configuration template (`.env.example`), and core project architecture documentation (`PROJECT_PLAN.md`, `ARCHITECTURE.md`).

### Phase 2: Application Foundation & Working Shell
- [x] Monorepo structure setup (`client` + `server`), root orchestration via `concurrently`.
- [x] Express backend shell with Helmet, CORS, JSON limit, and `/api/v1/health` baseline.
- [x] React 19 + Vite + Tailwind CSS v4 frontend shell with dual portal landing page, Marathi/English `i18next` toggle, and live API status badge.
- [x] Git milestone commit (`0bf319d`) pushed to remote repository (`origin/main`).

### Phase 3: MongoDB Atlas Integration & Database Foundation
- [x] Resilient Mongoose Atlas connection layer with connection pooling, DNS fallback, timeouts, and graceful shutdown.
- [x] Liveness (`/health`) vs Readiness (`/health/ready`) endpoints and `requireDbReady` gating middleware.
- [x] Foundational Mongoose schemas: `Shop`, `User`, `Customer`, `Category`, `Product`, `Batch`, `StockMovement`, `Supplier`, `AuditLog`.
- [x] Data integrity: Integer paise currency, agricultural base units, FEFO expiry tracking, and append-only immutability hooks.
- [x] Live Atlas connection verified against `shivshreeagromart.kxglgqb.mongodb.net` (Database: `shivshree_agro_mart`).

### Phase 4: Secure Authentication & Role-Based Access Control
- [x] **Cryptographic & Token Layer**:
  - Secure password hashing using `bcryptjs` with 12 salt rounds.
  - Short-lived JWT access tokens (15m) signed with `HS256`, explicit issuer (`shivshree-agro-mart`), and audience (`shivshree-agro-mart-client`).
  - Longer-lived JWT refresh tokens (7d) transported via HTTP-only, SameSite=lax, Secure-in-production cookies.
  - Refresh token session collection (`RefreshToken`) with SHA-256 hashes, rotation on refresh, instant revocation on logout, and automatic MongoDB TTL index cleanup.
  - `formatSafeUser()` serializer strictly stripping `passwordHash`, token secrets, and internal metadata.
- [x] **Rate Limiting & Brute Force Protection**:
  - `authRateLimiter` middleware enforcing a 10-request ceiling per 15-minute window on all authentication and OTP endpoints.
- [x] **Role-Based Authorization Middlewares**:
  - `requireAuth`: Verifies JWT access token, checks active account status in DB, attaches safe `req.user`.
  - `requireRole('OWNER', 'MANAGER', 'CASHIER')`: Enforces RBAC permissions boundary.
  - `requireSameShop`: Rejects unauthorized cross-shop resource access.
  - `requireCustomerSelf`: Restricts `CUSTOMER` users strictly to their own account records.
- [x] **One-Time Shop Owner Provisioning CLI**:
  - `npm run seed:owner -- --name="..." --email="..." --password="..."`:
  - Enforces strong password complexity (min 10 chars, uppercase, lowercase, digit, special character).
  - Rejects execution if an `OWNER` already exists for the shop (zero duplicate or overwrite vulnerability).
  - Records immutable `AuditLog` entry; never prints or leaks passwords.
- [x] **Staff Account Management (Owner-Protected)**:
  - `POST /api/v1/staff`: Create `MANAGER` or `CASHIER` accounts with audit logging.
  - `GET /api/v1/staff`: List staff accounts for current shop.
  - `PATCH /api/v1/staff/:id/role`: Change staff role (strictly disallows self-promotion or promotion to `OWNER`).
  - `PATCH /api/v1/staff/:id/status`: Activate or deactivate staff accounts.
- [x] **Customer Phone Authentication & Sandboxing**:
  - Short-lived 6-digit OTP verification via `POST /api/v1/auth/customer/login-request` and `/verify-otp`.
  - Links verified phone numbers to existing `Customer` records with sandboxed `CUSTOMER` role.
  - Development test OTP (`123456`) strictly blocked in production via environment validation.
- [x] **Frontend Authentication Integration**:
  - `AuthContext`: In-memory access token storage (zero localStorage usage), silent session restore on reload.
  - `ProtectedRoute`: Route guard with loading spinner, unauthenticated redirect, and role enforcement.
  - `OwnerLoginPage`: Real credential login form with error alerts, loading states, and redirect to `/admin/dashboard`.
  - `CustomerLoginPage`: Real 2-step OTP verification form with redirect to `/customer/dashboard`.
  - `AdminDashboardPage` and `CustomerDashboardPage`: Branded portal dashboards with functional session Logout.

### Phase 5: Product Catalog and Inventory Management
- [x] **Category Management**:
  - `GET /api/v1/categories`: Lists categories with parent category hierarchy.
  - `POST /api/v1/categories`: Creates bilingual categories with auto-slug generation, unique per shop.
  - `PATCH /api/v1/categories/:id`: Updates category metadata and active status.
- [x] **Product Catalog**:
  - `GET /api/v1/products`: Lists products with pagination, multi-field search (En/Mr names, SKU, barcode, brand), category & productType filters, and active/inactive status.
  - `POST /api/v1/products`: Creates products with SKU uniqueness per shop, optional barcode, agricultural base units, integer paise selling prices, and HSN/GST tax classifications.
  - `GET /api/v1/products/:id`: Detailed view populated with category and FEFO-sorted manufacturer batches (purchase costs masked for Cashier/Customer).
  - `PATCH /api/v1/products/:id`: Edits product details with duplicate SKU guards.
  - `PATCH /api/v1/products/:id/status`: Toggles product active/inactive status.
  - `GET /api/v1/products/reorder/low-stock`: Returns products whose current stock is at or below reorder level.
- [x] **Authoritative Stock Ledger & Transactions**:
  - `POST /api/v1/inventory/receipt`: Inward stock receipt linking or creating manufacturer batches, duplicate invoice protection, and immutable `StockMovement` creation.
  - `POST /api/v1/inventory/adjustment`: Records approved stock adjustments (`ADJUSTMENT_ADD`, `ADJUSTMENT_SUBTRACT`, `SCRAP`) with mandatory reason, user identity, and negative stock policy enforcement.
  - `GET /api/v1/inventory/stock`: Aggregated stock balances derived directly from the immutable `StockMovement` ledger.
  - `GET /api/v1/inventory/batches`: FEFO sorted batch list with expiry tracking (days remaining, 30/60/90 day flags, quarantine status).
  - `PATCH /api/v1/inventory/batches/:id/status`: Updates batch status (`ACTIVE`, `QUARANTINED`, `EXPIRED`) with mandatory reason and audit log.
  - `GET /api/v1/inventory/movements`: Authoritative, immutable ledger history filterable by product, batch, movement type, and date range.
  - `withTransaction`: Database transaction helper with graceful fallback for standalone/unsupported MongoDB environments.
- [x] **Frontend Management Interface (`/admin/inventory`)**:
  - Tabbed interface: Product Catalog, Batches & Expiry (FEFO), Low Stock Alerts, Stock Movement Ledger, Category Management.
  - Accessible tables on desktop, card layouts on mobile.
  - Bilingual Marathi and English localization for all inventory terms.
  - Modals for Product Add/Edit, Product Details & Batches, Stock Receipt, Stock Adjustment, and Category Management.
  - Role-based permissions: Cashier has read-only lookup access; Owner & Manager have full management controls.

### Phase 6: Point-of-Sale Billing & Invoice Generation
- [x] **Financial & Invoice Models**:
  - `Counter`: Shop-scoped atomic sequence generator (`Counter.getNextSequence`) preventing race conditions under concurrent checkouts. Format: `INV-YYYYMM-XXXXX`.
  - `Invoice`: Shop-scoped model with embedded `InvoiceItem` snapshot array preserving immutable point-in-time product/batch details.
  - `Payment`: Real in-store payment collection model capturing `CASH`, `UPI` (with mandatory UTR/ref), integer `amountPaise`, staff tracking (`receivedBy`), and payment dates.
- [x] **Tax Engine & Financial Mathematics**:
  - All currency stored strictly in whole integer paise (₹1.00 = 100 paise).
  - Tax-inclusive Maharashtra retail standard: taxable amount computed via integer-safe arithmetic and split evenly into 50% CGST and 50% SGST.
  - Server-side calculation verification: Never trusts client-supplied subtotals, tax totals, or grand totals.
- [x] **Atomic Inventory Deduction & FEFO**:
  - Integrated billing with `StockMovement` ledger using `withTransaction({ requireTransaction: true })`.
  - Atomically deducts stock from First-Expired-First-Out (FEFO) eligible batches.
  - Cancellation endpoint (`POST /api/v1/invoices/:id/cancel`) restores stock through traceable `RETURN_INWARD` movements with mandatory audit reason.
- [x] **POS Frontend Billing Workspace (`/admin/pos`)**:
  - Fast product search by name, SKU, or barcode; category filter chips; live stock indicators.
  - Cart with item quantity controls, real-time stock ceiling validation, and line total math.
  - Walk-in vs Registered Farmer with quick-registration modal (`QuickCustomerModal`).
  - Cash, UPI, Farmer Credit, and Split payment modes.
  - Printable receipt modal (`InvoiceReceiptModal`) supporting A4 and 80mm thermal formats.

### Phase 7: Farmer Credit Ledger, Passbook & Outstanding Balances
- [x] **Immutable Ledger Architecture & Schema**:
  - `CustomerLedgerEntry`: Append-only schema capturing `OPENING_BALANCE`, `CREDIT_SALE`, `PAYMENT_RECEIVED`, `SALE_RETURN`, `CREDIT_NOTE`, `ADJUSTMENT`, and `REVERSAL`.
  - Double-entry convention: DEBIT (नावे) increases farmer debt; CREDIT (जमा) decreases debt. Net Balance = $\sum(\text{Debits}) - \sum(\text{Credits})$.
  - Stored strictly in integer paise; floating-point math prevented.
  - Direct balance editing strictly blocked by schema hooks (`pre('save')`, `pre('findOneAndUpdate')`, `pre('deleteOne')`).
  - Traceable reversals: Counter-entries reference `originalEntryId`, mark original entries as `isReversed: true`, and enforce mandatory reason (min 5 characters).
- [x] **Billing & Payment Integration**:
  - POS Credit Sales atomically post `CREDIT_SALE` debits and downpayment credits.
  - Invoice Payments create `PAYMENT_RECEIVED` credits and `PaymentAllocation` records.
  - Invoice Cancellations atomically credit back unpaid balances and flag original ledger entries as reversed.
  - Multi-Invoice Allocations: Auto-FIFO or custom allocations across unpaid invoices with unallocated customer advances.
  - Idempotency guards prevent duplicate payment collections or multiple ledger entries upon network retry.
- [x] **Customer Credit Profiles & Aging**:
  - Real-time customer balance, credit limit, available credit ($\max(0, \text{limit} - \text{balance})$), and last payment date.
  - Aging buckets: Current (0–30d), Past Due (31–60d), Delinquent (61–90d), Highly Delinquent (90+d).
  - Credit limit modification endpoint (`PATCH /api/v1/customers/:id/credit-limit`) restricted to `OWNER`/`MANAGER` with audit logging.
- [x] **Staff Farmer Credit Workspace (`/admin/credit`)**:
  - Searchable farmer list with balance, credit limit, available credit, and overdue status badges.
  - Detailed Farmer Profile drawer with contact details, land/village info, aging breakdown, and full passbook history.
  - Payment Collection modal (`CollectCreditPaymentModal`) supporting FIFO or invoice-by-invoice allocation, cash/UPI reference, and customer advance handling.
  - Manual Adjustment modal (`ManualAdjustmentModal`) with Debit/Credit selector, amount in paise, and mandatory reason.
  - Opening Balance modal (`OpeningBalanceModal`) for paper khata migration.
  - Entry Reversal modal (`ReverseEntryModal`) with audit trail.
  - Credit Limit modification modal (`UpdateCreditLimitModal`).
  - Printable Farmer Statement modal (`CustomerStatementModal`) with bilingual Marathi/English layout.
  - Reconciliation Audit modal (`ReconciliationReportModal`) displaying ledger-invoice-payment consistency.
- [x] **Farmer Self-Service Portal (`/customer/dashboard`)**:
  - Live Credit Balance card with available credit indicator.
  - Digital Passbook tab with running balances, transaction dates, and Marathi labels.
  - Real purchase bills tab with itemized details and payment statuses.
  - Printable Statement modal (`CustomerStatementModal`) sandboxed to authenticated customer.
- [x] **Reconciliation & Integrity Engine**:
  - `reconcileCustomerAccount` utility cross-checks ledger entries against invoices, payments, allocations, reversals, and credit limits.
  - Never mutates data silently; returns non-destructive audit anomalies for authorized review.

### Phase 8: Supplier Management, Purchase Inward & Accounts Payable Ledger
- [x] **Supplier Directory & Master Profiles**:
  - Extended `Supplier` schema with contact person, phone, email, full address, village/city, district, state, and 6-digit pincode.
  - GSTIN format validation via statutory regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
  - Supplier types (`MANUFACTURER`, `DISTRIBUTOR`, `WHOLESALER`, `OTHER`), payment terms in days, credit limits in paise, and complete bank account details.
  - Soft deactivation toggle (`isActive`) preventing hard deletions if referenced by purchase documents or ledger entries.
  - Sensible phone validation avoiding duplicate supplier cards while permitting shared agency numbers.
- [x] **Inward Purchase Processing Engine (`Purchase`)**:
  - Atomic sequence generation `PUR-YYYYMM-XXXXX` scoped per shop.
  - Embedded `PurchaseItem` snapshots preserving `productId`, `batchNumber`, `manufacturingDate`, `expiryDate`, `quantityReceived`, `freeQuantity`, `unitPurchasePricePaise`, `unitSellingPricePaise` (MRP / Retail rate), `taxableAmountPaise`, `gstRate`, `cgstPaise`, `sgstPaise`, `igstPaise`, and `lineTotalPaise`.
  - Comprehensive tax and cost calculations (`purchaseUtils.js`) supporting intra-state 50/50 CGST/SGST, inter-state IGST, freight/additional charges, and automatic round-off.
  - Two-phase workflow: `DRAFT` status preserves orders for review without altering stock or creating payable liabilities.
  - Receipt action (`status: RECEIVED`): Atomically creates/updates `Batch` records with expiry dates for downstream FEFO sales, posts `StockMovement` records of type `INWARD`, updates `Product.totalStock`, creates `SupplierLedgerEntry` (`PURCHASE_INVOICE`), and logs immediate outflow payments.
- [x] **Accounts Payable (AP) Double-Entry Ledger (`SupplierLedgerEntry`)**:
  - Immutable append-only schema: Mongoose pre-hooks block direct modifications or deletions.
  - Double-entry convention: **CREDIT (जमा)** increases the payable liability owed to the supplier; **DEBIT (नावे)** decreases the payable liability.
  - Net Outstanding Payable = $\sum(\text{CREDITS}) - \sum(\text{DEBITS})$. Positive balance = active liability; negative balance = advance credit held with supplier.
  - Erroneous entries are neutralized strictly via authorized `REVERSAL` counter-entries with reciprocal link tracking and mandatory reason.
- [x] **Payment Allocation, Advances & Aging**:
  - Multi-purchase payment allocation: Auto-FIFO or explicit invoice designation via `PaymentAllocation` referencing `purchaseId` and `supplierId`.
  - Unallocated payments are safely preserved as supplier advances.
  - Dynamic aging buckets: Current (0–30d), Past Due (31–60d), Delinquent (61–90d), Overdue (90+d).
- [x] **Controlled Returns & Cancellations**:
  - Purchase Returns (`PURCHASE_RETURN`): Atomically validates available batch stock via `getProductStock` before allowing return, preventing negative inventory. Deducts batch stock and posts a ledger DEBIT.
  - Purchase Cancellations (`CANCELLED`): Authorized cancellation reverses inward stock via `RETURN_OUTWARD` stock movements and neutralizes the purchase payable balance.
- [x] **Supplier Reconciliation Engine (`reconcileSupplierAccount`)**:
  - Independent reconciliation cross-verifying supplier ledger credits against purchase bills and opening balances, and debits against payments and returns.
  - Returns structured audit reports with `isConsistent: true/false` and explicit discrepancy flags.
- [x] **Staff Supplier & Inward Management Workspaces**:
  - `/admin/suppliers`: Searchable supplier directory, AP summary cards, aging breakdown, detailed supplier passbook drawer, payment collection modal, manual adjustment modal, opening balance modal, reversal modal, and reconciliation audit modal.
  - `/admin/purchases`: Comprehensive purchase bill registry with status filters, detailed new purchase bill modal with multi-item batch entry, receipt confirmation, printable voucher modal (`PurchaseViewModal`), cancellation modal, and stock-guarded return modal.
  - Full bilingual localization in Marathi and English with agricultural green styling.

### Phase 9: Operating Expenses, Cash Management, Daily Closing & Profitability Reports (Prompt 9 Milestone)
- [x] **Operating Expense Management (`Expense`)**:
  - Shop-scoped sequential counter `EXP-YYYYMM-XXXXX` with integer paise precision (₹1.00 = 100 paise).
  - Expense categories: `RENT`, `ELECTRICITY`, `WATER`, `INTERNET_PHONE`, `SALARIES_WAGES`, `TRANSPORT_FUEL`, `MAINTENANCE`, `STATIONERY_PACKAGING`, `BANK_CHARGES`, `TEA_REFRESHMENT`, `MISCELLANEOUS`.
  - Payment modes: `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`.
  - Approval workflow: Cashier submissions enter `PENDING_APPROVAL`; Owner/Manager submissions auto-approve (`APPROVED`).
  - Append-only immutability: Mongoose pre-hooks block direct edit/deletion of approved vouchers. Erroneous vouchers are corrected via authorized `REVERSAL` counter-entries with mandatory reason and reciprocal links.
  - Validated document references (`receiptDocumentRef`) for physical vouchers.
- [x] **Physical Cash Drawer Sessions & Variance (`CashDrawerSession`)**:
  - At most one open drawer session per shop at any time.
  - Opening cash float recording (`openingCashPaise`) and live expected cash calculation.
  - Counted closing cash recording (`closingCashCountedPaise`) and automatic variance detection (`variancePaise = counted - expected`).
  - Mandatory explanatory note if variance is non-zero before session close is finalized.
- [x] **Fund Segregation & Zero Double Counting (`cashbookUtils.js`)**:
  - Authoritative cashbook movements derived from existing `Payment`, `Expense`, and `Invoice` documents.
  - Physical cash drawer movements strictly isolated from digital non-drawer funds: UPI and Bank transfers settle directly to bank accounts and are never mixed with physical drawer cash.
- [x] **Daily Closing & Reconciliation Engine (`dailyClosingController.js`)**:
  - Daily closing report matching opening cash + cash sales + credit collections - supplier cash payments - cash expenses = expected closing cash.
  - Evaluates actual counted cash against expected cash and flags variances.
  - Independent summaries for UPI inflows/outflows, bank transfers, and credit sales generated.
  - Printable semantic HTML closing report.
- [x] **Batch-Based COGS & Profitability Engine (`profitabilityUtils.js`)**:
  - Calculates Cost of Goods Sold (COGS) directly from verified batch purchase costs (`purchaseCostPaisePerBaseUnit`) of actual batches sold in each `InvoiceItem`.
  - Excludes cancelled invoices and accounts for line discounts.
  - Computes Gross Profit, Gross Margin %, Total Operating Expenses, Operating Net Profit, and Operating Margin %.
  - Clearly flags items missing linked batch costs as managerial estimates without inventing data.
  - Incorporates customer receivables (Khata), supplier payables (AP), and active physical stock inventory valuation.
- [x] **Staff Management Workspaces**:
  - `/admin/expenses`: Operating expense register, creation modal, approve/reject workflow, and audited reversals.
  - `/admin/cashbook`: Physical cash drawer monitoring, live expected cash, open/close drawer session modals, and historical session logs.
  - `/admin/daily-closing`: End-of-day cash reconciliation report, variance analysis, digital channels summary, and printable closing voucher.
  - `/admin/reports`: Multi-tab financial reporting dashboard (Profitability & COGS, Sales & Revenue, Expenses Breakdown, Receivables & Payables, Inventory Valuation, print, and CSV export).

### Phase 10: End-to-End Integration, Dual Portal Polish & Launch Readiness Audit
- [x] **End-to-End Workflows Audited & Verified**:
  - Workflow A: Product & inward purchase receiving, batch creation, StockMovement, inventory valuation, and AP ledger balances.
  - Workflow B: POS counter sale from active batches, FEFO sorting, tax calculation, single stock deduction, invoice generation.
  - Workflow C: Farmer credit sale, partial payment, full payment, automatic FIFO allocation, and Customer passbook verification.
  - Workflow D: Supplier payment, FIFO allocation to unpaid purchase bills, and AP ledger verification.
  - Workflow E: Sales returns (RETURN_INWARD), purchase returns (RETURN_OUTWARD), invoice cancellation, and reciprocal reversal links.
  - Workflow F: Operating expenses, cash drawer opening float, physical cashbook vs digital payments, expected cash calculation, closing variance.
  - Workflow G: Managerial profitability, COGS from actual batch purchase costs, sales margins, date boundaries, and financial summary.
- [x] **Security & Authorization Hardening**:
  - Customer JWT token refresh bug fixed: preserved `customerId` in `signAccessToken` and middleware fallback.
  - CORS header configuration updated to allow `Idempotency-Key`, `idempotency-key`, and `X-Idempotency-Key`.
  - Cashier view restrictions enforced in Admin Dashboard: hid Supplier, Purchase, Daily Closing, and Reports modules.
  - `recordSupplierPayment` reinforced with idempotency key deduplication.
  - Production environment guard: rejects weak default JWT secrets on server startup when `NODE_ENV === 'production'`.
- [x] **Offline Resilience & Error Handling**:
  - Client API layer wrapped with clean network error interception (`NETWORK_ERROR`, status 0) avoiding unhandled promise rejections.
  - Documented strict non-offline boundary for financial transactions (requires atomic MongoDB server confirmation).
- [x] **Bundle Optimization**:
  - Configured Rollup `manualChunks` (`vendor-react`, `vendor-icons`, `vendor-i18n`), reducing main client bundle size from 870 kB down to 679 kB (152 kB gzip).

---

## Milestone Checklist & Roadmap Status

| Phase | Description | Status | Target Delivery |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Project Foundation & Architecture Documentation** | **COMPLETED** | Milestone 1 |
| **Phase 2** | **Application Foundation & Working Shell (`client` + `server`)** | **COMPLETED** | Milestone 2 |
| **Phase 3** | **MongoDB Atlas Integration & Database Foundation** | **COMPLETED** | Milestone 3 |
| **Phase 4** | **Secure Authentication & Role-Based Access Control** | **COMPLETED** | Milestone 4 |
| **Phase 5** | **Product Catalog & Batch/Expiry Inventory Management** | **COMPLETED** | Milestone 5 |
| **Phase 6** | **Point-of-Sale Billing & Invoice Generation (Prompt 6)** | **COMPLETED** | Milestone 6 |
| **Phase 7** | **Farmer Credit Ledger, Passbook & Balances (Prompt 7)** | **COMPLETED** | Milestone 7 |
| **Phase 8** | **Supplier Management, Purchase Inward & AP Ledger (Prompt 8)** | **COMPLETED** | Milestone 8 |
| **Phase 9** | **Operating Expenses, Cash Management & Profitability (Prompt 9)** | **COMPLETED** | Milestone 9 |
| **Phase 10** | **End-to-End Integration, Dual Portal Polish & Launch Readiness Audit (Prompt 10)** | **COMPLETED** | Current Milestone |
| **Phase 11** | Production Hardening, Audit Logs & Backup Procedures | Planned | Upcoming |

---

## Tests Run & Verification Results

1. **Automated Backend Test Suite** (`npm test` in `server/`):
   - **166 tests across 54 suites passed with 0 failures** in ~25.0s.
   - Includes **22 End-to-End Integration Audit Tests (`e2e_integration_audit.test.js`)**:
     - Product & inward purchase receiving, batch creation, stock verification, and AP balance.
     - POS counter sale with FEFO selection order, tax calculation, and stock decrement.
     - Farmer credit sale, partial payment, full payment, and ledger balance reconciliation.
     - Supplier payment, FIFO allocation across purchases, and AP balance reconciliation.
     - Sales return (`RETURN_INWARD`), purchase return (`RETURN_OUTWARD`), invoice cancellation, and reciprocal audit links.
     - Expense lifecycle, cash drawer float, physical cash vs digital segregation, closing discrepancy handling.
     - Financial reporting, batch-based COGS, and margin calculations.
     - Security regressions: customer token refresh preservation, cross-shop isolation, cashier privilege restrictions, supplier payment idempotency deduplication.
2. **Client Production Build** (`npm run build` in `client/`):
   - **Passed: 2,029 modules transformed**, all chunks generated cleanly with vendor separation.
3. **Database Transactions**:
   - `withTransaction` verified with `{ requireTransaction: true }` across all financial and inventory mutations.

---

## Known Issues & Notes
- Offline transactions are intentionally rejected without a confirmed server connection; financial operations require atomic ACID guarantees.
- Real SMS delivery requires an external carrier integration; test OTP (`123456`) is blocked in production mode.
- Statutory GST tax filings in Maharashtra require periodic export and verification by the shop's licensed tax consultant.
- Items sold without linked batch records default to cost disclosure estimates rather than fabricating costs.





