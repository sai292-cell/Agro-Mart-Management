# Shivshree Agro Mart OS — Project Progress Tracker

## Current Status Overview
- **Project Name**: Shivshree Agro Mart OS
- **Current Milestone**: Phase 4 — Secure Authentication & Role-Based Access Control
- **Phase Status**: Completed & Fully Verified
- **Last Updated**: 2026-10-17

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

### Phase 4: Secure Authentication & Role-Based Access Control (Current Milestone)
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

---

## Milestone Checklist & Roadmap Status

| Phase | Description | Status | Target Delivery |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Project Foundation & Architecture Documentation** | **COMPLETED** | Milestone 1 |
| **Phase 2** | **Application Foundation & Working Shell (`client` + `server`)** | **COMPLETED** | Milestone 2 |
| **Phase 3** | **MongoDB Atlas Integration & Database Foundation** | **COMPLETED** | Milestone 3 |
| **Phase 4** | **Secure Authentication & Role-Based Access Control** | **COMPLETED** | Current |
| **Phase 5** | Product Catalog & Batch/Expiry Inventory Management | Planned | Next Milestone |
| **Phase 6** | Customer Management & Credit Ledger (Udhaari/Khaata) | Planned | Upcoming |
| **Phase 7** | Point-of-Sale Billing & Invoice Generation Engine | Planned | Upcoming |
| **Phase 8** | Supplier Management & Stock Inward Purchases | Planned | Upcoming |
| **Phase 9** | Financial Accounting, Expense Tracking & Profit/Loss | Planned | Upcoming |
| **Phase 10** | Bilingual Marathi/English UI & Dual Portal Polish | Planned | Upcoming |
| **Phase 11** | Production Hardening, Audit Logs & Backup Procedures | Planned | Upcoming |

---

## Tests Run & Verification Results

1. **Automated Backend Test Suite** (`npm test` in `server/`):
   - **40 tests across 18 suites passed with 0 failures** in 2.36s.
   - Tested: Password hashing, token signing and validation, tampered token rejection, safe user serialization, HTTP-only cookie options, Zod staff creation/role schemas, login input schemas, customer sandboxing, owner password complexity, and duplicate owner rejection.
2. **Client Production Build** (`npm run build` in `client/`):
   - **Passed: 1,987 modules transformed in 6.71s**, zero errors.
3. **Live Endpoint Security Verification**:
   - `POST /api/v1/auth/login` (Invalid credentials) &rarr; `HTTP 401 Unauthorized` with generic message `INVALID_CREDENTIALS` and `RateLimit-Limit: 10`, `RateLimit-Remaining: 9`.
   - `GET /api/v1/auth/me` (No token) &rarr; `HTTP 401 Unauthorized` with `UNAUTHORIZED`.
   - `GET /api/v1/staff` (No token) &rarr; `HTTP 401 Unauthorized` with `UNAUTHORIZED`.
   - `provisionOwner.js` (No args / weak password) &rarr; Rejected with exit code 1 and complexity guidance.

---

## Known Issues & Notes
- For SMS delivery in production, an SMS gateway (e.g. Twilio, MSG91, or Fast2SMS) will be wired into `requestCustomerOtp` to replace the development testing OTP helper. In production, `DEV_ALLOW_TEST_OTP` is strictly forbidden by server environment validation.

---

## Recommended Next Prompt (Phase 5)
**PROMPT 5: Product Catalog & Batch/Expiry Inventory Management**
- Build CRUD APIs for products and categories with bilingual search (Marathi/English) and SKU barcode support.
- Implement batch creation and stock inward receiving linked to suppliers.
- Implement FEFO (First-Expired-First-Out) batch allocation and low-stock threshold alerts.
- Connect staff management portal with inventory management views and filters.
