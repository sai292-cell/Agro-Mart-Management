# Shivshree Agro Mart OS

> A production-oriented AgroShop Management System custom-engineered for **Shivshree Agro Mart, Maharashtra, India**.

---

## 🛠️ Technology Stack
- **Frontend**: React 19, Vite 6, Tailwind CSS v4, React Router 7, Lucide Icons, i18next (Marathi + English)
- **Backend**: Node.js, Express, Mongoose, Helmet, CORS, CookieParser, Zod validation, bcryptjs, jsonwebtoken, express-rate-limit
- **Database**: MongoDB Atlas M0 Free Tier (Database: `shivshree_agro_mart`)
- **Testing**: Node.js native test runner (`node --test`)

---

## 🚀 Installation & Local Development

### 1. Install Dependencies
Run the installation command from the repository root:
```bash
npm run install:all
```

### 2. Environment Configuration
Copy the template files:
```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

### 3. One-Time Shop Owner Provisioning
Public owner registration is disallowed. Provision the initial Shop Owner using the CLI setup command:
```bash
# Run from repository root
npm run seed:owner -- --name="Sai Gite" --email="owner@shivshreeagro.com" --password="StrongPassword123!"

# Or from server directory
cd server
node src/scripts/provisionOwner.js --name="Sai Gite" --email="owner@shivshreeagro.com" --password="StrongPassword123!"
```
*Guards*:
- Enforces strong password complexity (min 10 characters, upper, lower, digit, special character).
- Aborts if an `OWNER` account already exists for the shop (cannot overwrite or duplicate).
- Never prints the password.

---

## 🔐 Authentication & Security Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/login` | `POST` | Public | Staff & Owner credential login (Rate-limited, generic error messages). |
| `/api/v1/auth/refresh` | `POST` | Public | Rotates refresh token and issues new short-lived access token. |
| `/api/v1/auth/logout` | `POST` | Authenticated | Revokes refresh session in DB and clears HTTP-only cookie. |
| `/api/v1/auth/me` | `GET` | Authenticated | Returns safe user profile (excludes password hashes and secrets). |
| `/api/v1/auth/customer/login-request` | `POST` | Public | Requests short-lived 6-digit OTP for farmer login. |
| `/api/v1/auth/customer/verify-otp` | `POST` | Public | Verifies customer OTP and issues sandboxed customer tokens. |
| `/api/v1/staff` | `GET` | `OWNER`, `MANAGER` | Lists all staff accounts for current shop. |
| `/api/v1/staff` | `POST` | `OWNER` | Creates a new `MANAGER` or `CASHIER` account. |
| `/api/v1/staff/:id/role` | `PATCH` | `OWNER` | Updates staff role (disallows promoting to `OWNER`). |
| `/api/v1/staff/:id/status` | `PATCH` | `OWNER` | Activates or deactivates a staff member account. |

---

## 📦 Product Catalog & Inventory Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/categories` | `GET` | All | Lists active categories for shop. |
| `/api/v1/categories` | `POST` | `OWNER`, `MANAGER` | Creates category with unique slug. |
| `/api/v1/categories/:id` | `PATCH` | `OWNER`, `MANAGER` | Updates category metadata or active status. |
| `/api/v1/products` | `GET` | All | Lists products with search, pagination, category & stock filters. |
| `/api/v1/products` | `POST` | `OWNER`, `MANAGER` | Creates product with unique SKU, paise pricing, and tax classification. |
| `/api/v1/products/:id` | `GET` | All | Product details with FEFO batches (costs masked for Cashier/Customer). |
| `/api/v1/products/:id` | `PATCH` | `OWNER`, `MANAGER` | Updates product specifications. |
| `/api/v1/products/:id/status` | `PATCH` | `OWNER`, `MANAGER` | Toggles product active/inactive status. |
| `/api/v1/products/reorder/low-stock` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Lists products at or below reorder level. |
| `/api/v1/inventory/stock` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Aggregated stock summary across products. |
| `/api/v1/inventory/batches` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | FEFO batch list with expiry tracking and quarantine flags. |
| `/api/v1/inventory/batches/:id/status` | `PATCH` | `OWNER`, `MANAGER` | Updates batch status (ACTIVE, QUARANTINED, EXPIRED) with mandatory reason. |
| `/api/v1/inventory/receipt` | `POST` | `OWNER`, `MANAGER` | Inward stock receipt with batch creation and duplicate invoice check. |
| `/api/v1/inventory/adjustment` | `POST` | `OWNER`, `MANAGER` | Stock adjustment with mandatory reason and negative-stock guard. |
| `/api/v1/inventory/movements` | `GET` | `OWNER`, `MANAGER` | Authoritative immutable ledger of all physical stock movements. |

---

## 🧾 Point-of-Sale (POS) Billing & Invoicing Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/invoices` | `GET` | All (Sandboxed) | Lists invoices with pagination, search, and status filters. |
| `/api/v1/invoices` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Finalizes POS sale with atomic stock deduction, FEFO allocation, and payment. |
| `/api/v1/invoices/:id` | `GET` | All (Sandboxed) | Retrieves detailed invoice snapshot with tax calculations and payment audit. |
| `/api/v1/invoices/:id/print` | `GET` | All (Sandboxed) | Renders print-ready semantic HTML tax invoice / receipt with Marathi headers. |
| `/api/v1/invoices/:id/payments` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Records cash/UPI payment against outstanding partial or unpaid invoice. |
| `/api/v1/invoices/:id/cancel` | `POST` | `OWNER`, `MANAGER` | Cancels invoice with mandatory reason and restores stock via `RETURN_INWARD`. |
| `/api/v1/invoices/customers` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | POS customer search by name, phone, or village. |
| `/api/v1/invoices/customers` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Quick-register farmer customer directly from POS counter. |

---

## 📒 Farmer Credit Ledger & Passbook Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/customers` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Lists registered farmers with balances, credit limits, and aging indicators. |
| `/api/v1/customers` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Registers new customer with contact details, land/village info, and credit limit. |
| `/api/v1/customers/:id` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Detailed customer profile with balance, credit limit, available credit, and aging breakdown. |
| `/api/v1/customers/:id/statement` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Customer passbook ledger statement with date filtering and pagination. |
| `/api/v1/customers/:id/payments` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Records account-level payment with FIFO or custom invoice allocation and advance tracking. |
| `/api/v1/customers/:id/adjustments` | `POST` | `OWNER`, `MANAGER` | Records authorized manual DEBIT or CREDIT adjustment with mandatory reason. |
| `/api/v1/customers/:id/opening-balance` | `POST` | `OWNER`, `MANAGER` | Records approved historical paper khata opening balance migration. |
| `/api/v1/customers/:id/entries/:entryId/reverse` | `POST` | `OWNER`, `MANAGER` | Neutralizes an erroneous ledger entry via authorized counter-entry with mandatory audit reason. |
| `/api/v1/customers/:id/credit-limit` | `PATCH` | `OWNER`, `MANAGER` | Modifies customer credit limit with audit logging. |
| `/api/v1/customers/:id/reconciliation` | `GET` | `OWNER`, `MANAGER` | Runs ledger vs invoice/payment reconciliation audit report. |
| `/api/v1/customers/portal/profile` | `GET` | `CUSTOMER` (Sandboxed) | Authenticated farmer self-service credit balance and profile. |
| `/api/v1/customers/portal/passbook` | `GET` | `CUSTOMER` (Sandboxed) | Authenticated farmer self-service passbook statement. |

---

## 🏭 Supplier Management & Accounts Payable Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/suppliers` | `GET` | `OWNER`, `MANAGER` | Lists suppliers with pagination, search, category filters, and AP balances. |
| `/api/v1/suppliers` | `POST` | `OWNER`, `MANAGER` | Creates supplier with GSTIN regex validation, credit terms, and bank details. |
| `/api/v1/suppliers/:id` | `GET` | `OWNER`, `MANAGER` | Detailed supplier profile with AP balance, aging breakdown, and bank details. |
| `/api/v1/suppliers/:id` | `PATCH` | `OWNER`, `MANAGER` | Updates supplier contact, tax, or bank information. |
| `/api/v1/suppliers/:id/status` | `PATCH` | `OWNER`, `MANAGER` | Toggles supplier active/inactive status (soft deactivation). |
| `/api/v1/suppliers/:id/statement` | `GET` | `OWNER`, `MANAGER` | Supplier passbook ledger statement with date filtering and pagination. |
| `/api/v1/suppliers/:id/payments` | `POST` | `OWNER`, `MANAGER` | Records outward supplier payment with FIFO or custom invoice allocation. |
| `/api/v1/suppliers/:id/adjustments` | `POST` | `OWNER`, `MANAGER` | Records authorized manual DEBIT or CREDIT adjustment with mandatory reason. |
| `/api/v1/suppliers/:id/opening-balance` | `POST` | `OWNER`, `MANAGER` | Migrates historical paper opening balance for supplier khata. |
| `/api/v1/suppliers/:id/entries/:entryId/reverse` | `POST` | `OWNER`, `MANAGER` | Neutralizes an erroneous supplier ledger entry with two-way audit link. |
| `/api/v1/suppliers/:id/reconciliation` | `GET` | `OWNER`, `MANAGER` | Cross-verifies supplier ledger entries against purchase bills and payments. |

---

## 📥 Inward Purchase & Stock Receipt Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/purchases` | `GET` | `OWNER`, `MANAGER` | Lists purchase bills with search, status (`DRAFT`, `RECEIVED`, `CANCELLED`), and date filters. |
| `/api/v1/purchases` | `POST` | `OWNER`, `MANAGER` | Creates purchase bill (as `DRAFT` or directly `RECEIVED`) with batch details and GST. |
| `/api/v1/purchases/:id` | `GET` | `OWNER`, `MANAGER` | Detailed purchase voucher snapshot with line items, tax split, and payment allocations. |
| `/api/v1/purchases/:id/print` | `GET` | `OWNER`, `MANAGER` | Semantic HTML inward goods receipt voucher for physical filing. |
| `/api/v1/purchases/:id/receive` | `POST` | `OWNER`, `MANAGER` | Explicitly finalizes draft purchase: atomically updates batches, inward movements, and ledger. |
| `/api/v1/purchases/:id/cancel` | `POST` | `OWNER`, `MANAGER` | Cancels purchase with mandatory reason, reversing stock via `RETURN_OUTWARD`. |
| `/api/v1/purchases/:id/return` | `POST` | `OWNER`, `MANAGER` | Processes purchase return, strictly validating batch available stock before deducting. |

---

## 💸 Operating Expenses Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/expenses` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Lists operating expenses with pagination, search, category, and status filters. |
| `/api/v1/expenses` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Records expense voucher in integer paise (auto-approved for Manager/Owner; pending for Cashier). |
| `/api/v1/expenses/:id` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Detailed view of expense voucher with audit trail and approval metadata. |
| `/api/v1/expenses/:id/approve` | `PATCH` | `OWNER`, `MANAGER` | Approves pending expense voucher. |
| `/api/v1/expenses/:id/reject` | `PATCH` | `OWNER`, `MANAGER` | Rejects pending expense with mandatory reason. |
| `/api/v1/expenses/:id/reverse` | `POST` | `OWNER`, `MANAGER` | Neutralizes approved expense via auditable reversal counter-entry. |
| `/api/v1/expenses/categories/summary` | `GET` | `OWNER`, `MANAGER` | Aggregated expenses grouped by category for date range. |

---

## 💼 Cashbook & Cash Drawer Sessions Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/cashbook/session/current` | `GET` | `OWNER`, `MANAGER`, `CASHIER` | Returns active open cash drawer session with live expected drawer cash. |
| `/api/v1/cashbook/session/open` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Opens cash drawer session with initial physical cash float. |
| `/api/v1/cashbook/session/close` | `POST` | `OWNER`, `MANAGER`, `CASHIER` | Closes session with counted cash, automatic variance detection, and explanation note. |
| `/api/v1/cashbook/sessions` | `GET` | `OWNER`, `MANAGER` | Lists historical drawer sessions with opening, expected, counted, and variance metrics. |
| `/api/v1/cashbook/movements` | `GET` | `OWNER`, `MANAGER` | Aggregates physical cash vs digital non-drawer (UPI/Bank) inflows and outflows. |

---

## 📊 Daily Closing & Management Reports Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/daily-closing/summary` | `GET` | `OWNER`, `MANAGER` | End-of-day reconciliation: opening cash + cash sales - supplier cash - expenses = expected cash vs counted. |
| `/api/v1/daily-closing/history` | `GET` | `OWNER`, `MANAGER` | Historical closed daily sessions and audit records. |
| `/api/v1/reports/sales` | `GET` | `OWNER`, `MANAGER` | Sales report with gross/net totals, tax breakdown, product rankings, and payment modes. |
| `/api/v1/reports/profitability` | `GET` | `OWNER`, `MANAGER` | P&L report with batch-based COGS, gross margin, operating expenses, and net operating profit. |
| `/api/v1/reports/expenses` | `GET` | `OWNER`, `MANAGER` | Operating expense distribution by category and payment mode. |
| `/api/v1/reports/receivables-payables` | `GET` | `OWNER`, `MANAGER` | Customer Khata receivables vs Supplier Accounts Payable debt. |
| `/api/v1/reports/inventory-valuation` | `GET` | `OWNER`, `MANAGER` | Physical stock inventory valuation derived from active batches. |
| `/api/v1/reports/financial-summary` | `GET` | `OWNER`, `MANAGER` | High-level executive dashboard summary. |

---

## 🧪 Running Automated Tests
Run the complete test suite (166 tests across 54 test suites covering schemas, precision, immutability, cryptographic operations, tokens, duplicate SKU, stock integrity, FEFO batches, atomic billing, tax math, customer credit ledger, supplier management, inward purchase bills, AP double-entry arithmetic, operating expenses, cash drawer sessions, daily closing reconciliation, batch-based COGS, profit margins, RBAC rules, customer refresh token integrity, and end-to-end integration audit):
```bash
# Run tests from root
npm run test

# Or directly in server directory
npm run test --prefix server
```

---

## 📋 Shop Owner Pre-Launch Operational Checklist

Before going live with real customers and suppliers at Shivshree Agro Mart:

1. **Owner Account Provisioning**:
   - Run `npm run seed:owner -- --name="<Owner Name>" --email="<Owner Email>" --password="<StrongPassword>"` via secure console.
   - Never share or commit owner credentials.
2. **Production Environment Configuration**:
   - Ensure `NODE_ENV=production` is set in the server environment.
   - Configure high-entropy random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 random characters).
   - Verify `CORS_ORIGIN` is locked to the production domain (e.g. `https://mart.shivshreeagro.com`).
   - Confirm `DEV_ALLOW_TEST_OTP=false` (enforced automatically in production mode).
3. **MongoDB Replica Set Verification**:
   - Confirm your MongoDB cluster supports multi-document ACID transactions (MongoDB Atlas replica sets support transactions natively; standalone local instances do not).
4. **Live SMS Gateway Integration**:
   - To send live OTPs to farmers' mobile numbers, integrate an approved telecom SMS gateway (e.g., Fast2SMS, Twilio, or Gupshup) with DLT registration in India.
5. **Periodic Database Backup & Disaster Recovery**:
   - Schedule automated `mongodump` cron jobs or enable automated Atlas snapshots.
   - Test restoration procedure to a staging cluster at least once every quarter.
6. **Statutory Tax Consultation**:
   - Have the shop's chartered accountant / tax consultant review GST rates, HSN codes, and sales/purchase tax registers before filing quarterly GSTR-1 and GSTR-3B.
7. **Offline Operational Policy**:
   - Inform billing staff that financial mutations (invoicing, payments, drawer closing) require an active internet connection to ensure atomic ACID guarantees and avoid khata balance desync.

---

## 🏃 Running Development Servers
Start both the client and server concurrently:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Start backend API (Port 5000 with Atlas auto-connect)
npm run dev:server

# Start Vite frontend (Port 5173)
npm run dev:client
```

---

## 🔗 Key Endpoints & Routes
- **Frontend Landing Page**: `http://localhost:5173/`
- **Owner & Staff Login**: `http://localhost:5173/owner/login`
- **Farmer Portal Login**: `http://localhost:5173/customer/login`
- **Protected Staff Dashboard**: `http://localhost:5173/admin/dashboard`
- **Protected Inventory Hub**: `http://localhost:5173/admin/inventory`
- **Protected POS Billing Counter**: `http://localhost:5173/admin/pos`
- **Protected Farmer Credit Workspace**: `http://localhost:5173/admin/credit`
- **Protected Supplier Management & AP**: `http://localhost:5173/admin/suppliers`
- **Protected Purchase Inward Registry**: `http://localhost:5173/admin/purchases`
- **Protected Operating Expenses**: `http://localhost:5173/admin/expenses`
- **Protected Cashbook & Drawer**: `http://localhost:5173/admin/cashbook`
- **Protected Daily Closing**: `http://localhost:5173/admin/daily-closing`
- **Protected Financial Reports**: `http://localhost:5173/admin/reports`
- **Protected Farmer Passbook**: `http://localhost:5173/customer/dashboard`
- **API Liveness Check**: `http://localhost:5000/api/v1/health`
- **API Readiness Check**: `http://localhost:5000/api/v1/health/ready`

---

## 📄 Documentation
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md): Feature roadmap and 11 phased milestones.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System architecture, RBAC boundaries, schema conventions, and immutability rules.
- [`PROGRESS.md`](./PROGRESS.md): Live implementation tracker and test verification logs.



