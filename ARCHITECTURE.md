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
│   ├── public/                   # Favicon and static SVGs
│   ├── src/
│   │   ├── app/                  # App.jsx (AuthProvider wrapped), router.jsx (protected routes)
│   │   ├── components/
│   │   │   ├── auth/             # ProtectedRoute.jsx
│   │   │   ├── common/           # Button, Card, Badge, ApiHealthBadge, LanguageSwitcher
│   │   │   └── layout/           # RootLayout, Navbar, Footer, PageContainer
│   │   ├── contexts/             # AuthContext.jsx (in-memory access tokens, silent restore)
│   │   ├── i18n/                 # i18next configuration and mr/en translation bundles
│   │   ├── pages/
│   │   │   ├── admin/            # AdminDashboardPage.jsx
│   │   │   ├── customer/         # CustomerDashboardPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── OwnerLoginPage.jsx
│   │   │   ├── CustomerLoginPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── services/             # api.js (credentials: 'include', in-memory bearer injection)
│   │   ├── index.css             # Tailwind CSS v4 entry & brand theme tokens
│   │   └── main.jsx              # React DOM entry
│   ├── package.json
│   └── vite.config.js
├── server/                       # Backend REST API (Node.js + Express + Mongoose)
│   ├── src/
│   │   ├── config/               # db.js (Atlas connection), env.js (Zod validation)
│   │   ├── controllers/          # authController.js, staffController.js, healthController.js
│   │   ├── middleware/           # authMiddleware.js, dbReady.js, errorHandler.js, rateLimiter.js
│   │   ├── models/               # Shop, User, Customer, Category, Product, Batch,
│   │   │                         # StockMovement, Supplier, AuditLog, RefreshToken, OtpVerification
│   │   ├── routes/               # authRoutes.js, staffRoutes.js, healthRoutes.js, index.js
│   │   ├── scripts/              # provisionOwner.js (CLI one-time owner setup)
│   │   ├── utils/                # tokenUtils.js (bcrypt, jwt, safe serializers, cookie options)
│   │   ├── validators/           # authValidators.js (Zod schemas for login and staff)
│   │   ├── app.js                # Express app setup (Helmet, CORS, JSON, CookieParser, routes)
│   │   └── server.js             # HTTP server bootstrap, Atlas connection & graceful shutdown
│   ├── test/                     # Automated test suite using Node.js native test runner
│   │   ├── auth.test.js          # Password hashing, JWT verification, Zod auth validators, invariants
│   │   ├── models.test.js        # Schema validation, units, money precision, and immutability tests
│   │   └── health.test.js        # Liveness, readiness, and secret-masking assertions
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
