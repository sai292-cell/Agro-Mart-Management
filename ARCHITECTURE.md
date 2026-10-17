# Shivshree Agro Mart OS — System Architecture & Conventions

## 1. System Overview

**Shivshree Agro Mart OS** is designed as a modular, lightweight, high-reliability web application structured for agricultural retail operations in Maharashtra, India. The application employs a decoupled architecture with a React + Vite frontend and a Node.js + Express REST backend backed by MongoDB.

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
|   | - Helmet & CORS Policy       - Rate Limiter                               |   |
|   | - JWT Authentication         - Role-Based Access Control (RBAC)           |   |
|   | - Zod Input Validation       - Centralized Error Handling & Audit Logger  |   |
|   +---------------------------------------------------------------------------+   |
|                                         |                                         |
|   +---------------------------------------------------------------------------+   |
|   | API Modules (/api/v1):                                                    |   |
|   | /auth       /products     /batches      /inventory    /customers          |   |
|   | /invoices   /payments     /suppliers    /purchases    /expenses  /reports |   |
|   +---------------------------------------------------------------------------+   |
|                                         |                                         |
|   +---------------------------------------------------------------------------+   |
|   | Service & Data Access Layer (Mongoose ODM with ACID Sessions)             |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
                                         |
                                Mongoose Connection
                                         |
+-----------------------------------------------------------------------------------+
|                        DATABASE (MongoDB Atlas M0 Free)                           |
|                                                                                   |
| Collections:                                                                      |
| - users         - products        - batches       - customers    - ledgers        |
| - invoices      - invoice_items   - payments      - suppliers    - purchases      |
| - expenses      - audit_logs      - counters                                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```
Shivshree Agro Mart OS/
├── .github/                      # CI/CD and repository workflows
├── client/                       # Frontend application (React + Vite + Tailwind)
│   ├── public/                   # Static assets, logos, favicon
│   ├── src/
│   │   ├── assets/               # Brand images, icons
│   │   ├── components/           # Reusable UI elements (Buttons, Tables, Modals)
│   │   │   ├── common/           # Shared components (Alerts, Badges, Loaders)
│   │   │   ├── forms/            # Form controls with validation bindings
│   │   │   └── layout/           # Sidebars, Headers, Portal containers
│   │   ├── contexts/             # AuthContext, LanguageContext, CartContext
│   │   ├── hooks/                # Custom React hooks (useAuth, useDebounce)
│   │   ├── locales/              # i18next translation resource bundles
│   │   │   ├── en/               # English translation dictionary
│   │   │   └── mr/               # Marathi (मराठी) translation dictionary
│   │   ├── pages/                # Page route components
│   │   │   ├── admin/            # Owner & Staff pages (POS, Inventory, Reports)
│   │   │   ├── customer/         # Farmer self-service pages (Khaata passbook)
│   │   │   └── auth/             # Login, Forgot Password, Reset
│   │   ├── services/             # Axios/Fetch API client wrappers
│   │   ├── utils/                # Currency formatters, Date formatters (IST)
│   │   ├── App.jsx               # Route provider and portal boundary router
│   │   ├── index.css             # Tailwind CSS entry & base theme tokens
│   │   └── main.jsx              # React DOM bootstrap
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                       # Backend REST API (Node.js + Express)
│   ├── src/
│   │   ├── config/               # DB connection, environment schema, constants
│   │   ├── controllers/          # Request handling & HTTP response mapping
│   │   ├── middlewares/          # Auth, RBAC, Request validator, Error handler
│   │   ├── models/               # Mongoose schema definitions & indexes
│   │   ├── routes/               # Express router modules (/api/v1/*)
│   │   ├── services/             # Core business logic & database transactions
│   │   ├── utils/                # Logger, ID generator, Math/Currency helpers
│   │   ├── validations/          # Zod schema definitions for request bodies
│   │   ├── app.js                # Express app setup and middleware configuration
│   │   └── server.js             # HTTP server bootstrap and graceful shutdown
│   ├── package.json
│   └── .env.example
├── .env.example                  # Root safe environment template
├── .gitignore                    # Root git exclusions
├── ARCHITECTURE.md               # System design and conventions (this file)
├── PROJECT_PLAN.md               # Detailed feature roadmap and milestones
└── PROGRESS.md                   # Live project status and next tasks
```

---

## 3. Data Integrity & Domain Conventions

### 3.1 Money & Currency Handling
- **Golden Rule**: **Never use standard JavaScript floating-point numbers (`0.1 + 0.2 !== 0.3`) for financial arithmetic.**
- **Storage**: All monetary values (cost price, sale price, discounts, taxes, ledger balances, partial payments) are stored as **integers in Paise** (1 INR = 100 Paise) or using Mongoose `Decimal128`.
  - Example: `₹1,450.50` is stored as `145050` paise.
- **Display**: Converted to INR format on the frontend using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **Invoices**: Line item rounding is calculated using standard banker's rounding or explicit round-to-nearest-paise before summing totals.

### 3.2 Product Quantities & Units
Agricultural products are sold in diverse measurement units. Every inventory entry and line item enforces a normalized measurement structure:
- **Base Units**:
  - Weight: `KG`, `GRAM`, `QUINTAL`
  - Volume: `LITER`, `ML`
  - Packaged Items: `BAG`, `BOTTLE`, `PACKET`, `PIECE`, `BOX`
- **Conversion Factor**: Each packaging unit specifies its base equivalent (e.g., 1 Bag of Urea = 45 KG; 1 Bottle of Chlorpyrifos = 500 ML).
- **Quantities**: Stored as high-precision decimals (`Decimal128` or number with 3 decimal precision) to accurately support fractional purchases (e.g., 2.5 KG seeds).

### 3.3 Timestamps & Timezone
- All timestamps in MongoDB are strictly stored in **UTC (ISO-8601 format)** via Mongoose `{ timestamps: true }`.
- Business operations, daily cash drawer closures, and reporting group by days in the Indian Standard Timezone: **`Asia/Kolkata` (UTC+05:30)**.

### 3.4 Business Identifiers (Human-Readable Serial Numbers)
For physical bills, tax compliance, and customer reference, auto-incremented formatted identifiers are generated using an atomic counter collection:
- Invoices: `SAM-INV-YYYY-XXXX` (e.g., `SAM-INV-2026-0001`)
- Payments / Receipts: `SAM-REC-YYYY-XXXX`
- Supplier Purchase Inward: `SAM-PUR-YYYY-XXXX`
- Customer ID: `SAM-CUST-XXXX`

---

## 4. Role-Based Access Control (RBAC) & Security Boundaries

Three distinct user roles are enforced at the backend middleware level:

| Capability | Shop Owner (`owner`) | Staff Member (`staff`) | Farmer / Customer (`customer`) |
| :--- | :---: | :---: | :---: |
| POS Counter Billing | Yes | Yes | No |
| View Retail Product Catalog & Prices | Yes | Yes | Yes (Stock quantity masked) |
| View Wholesale / Supplier Purchase Costs | Yes | **No** | **No** |
| Customer Credit Ledger Management | Yes | Read & Receive Payments Only | **No** |
| Customer Ledger Self-Access (Passbook) | Yes | Yes | **Own records only** |
| Create / Edit Products & Pricing | Yes | No (Lookup only) | No |
| Record Operating Expenses | Yes | No | No |
| View Financial Profit & Loss Reports | Yes | **No** | **No** |
| View Audit Logs | Yes | **No** | **No** |
| Modify Closed Invoices or Ledger Entries | Owner Authorization Only | **No** | **No** |

### Security Middleware Pipeline:
1. `authenticateToken`: Validates JWT from Authorization Bearer header.
2. `requireRole(allowedRoles)`: Rejects with `403 Forbidden` if role is unauthorized.
3. `requireSelfOrAdmin(resourceOwnerLookup)`: Guarantees customers can only query or stream records where `customer_id === req.user.customerId`.

---

## 5. Bilingual Architecture (Marathi & English)

To ensure high usability for Maharashtra agricultural retail:
- The system defaults to **Marathi (`mr`)** with instant switching to **English (`en`)**.
- Implemented using **`i18next`** and **`react-i18next`**.
- Translation keys are organized by module:
  - `common.*` (actions, statuses, dates)
  - `pos.*` (counter billing, items, total, change)
  - `products.*` (categories, batch, expiry, unit)
  - `customer.*` (credit, balance, payment, village)
  - `reports.*` (sales, profit, expenses)
- Printed receipts and thermal invoices include dual-language headings (English + Marathi) for clear legal validity and farmer comprehension.

---

## 6. Audit Logging & Transaction Integrity

1. **Transactional Invariant**:
   - Bill generation involves: (a) Invoice record creation, (b) Inventory batch deduction, and (c) Customer credit balance increment (for credit sales).
   - These operations execute inside a **MongoDB Transaction Session** (`session.withTransaction`) to guarantee ACID atomicity. If inventory deduction fails, the entire bill is aborted.
2. **Audit Trails**:
   - Every sensitive event (product price change, manual stock adjustment, bad-debt credit waiver, user permission change) creates an append-only document in `audit_logs`:
     ```json
     {
       "timestamp": "2026-10-17T18:50:00.000Z",
       "actorId": "userId",
       "actorRole": "owner",
       "action": "STOCK_ADJUSTMENT",
       "resource": "batches/batch123",
       "changes": {
         "previousStock": 50,
         "newStock": 45,
         "reason": "Damaged bag reported"
       },
       "ipAddress": "192.168.1.10"
     }
     ```
3. **Backup Strategy (Zero Budget)**:
   - Automated export script utilizing `mongodump` with gzip compression.
   - Script can be triggered via scheduled cron on the local server or uploaded to free cloud tier backup buckets.
