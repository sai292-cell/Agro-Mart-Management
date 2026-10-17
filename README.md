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

## 🧪 Running Automated Tests
Run the complete test suite (40 tests covering schemas, units, precision, immutability, cryptographic operations, tokens, and RBAC rules):
```bash
# Run tests from root
npm run test

# Or directly in server directory
npm run test --prefix server
```

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
- **Protected Farmer Passbook**: `http://localhost:5173/customer/dashboard`
- **API Liveness Check**: `http://localhost:5000/api/v1/health`
- **API Readiness Check**: `http://localhost:5000/api/v1/health/ready`

---

## 📄 Documentation
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md): Feature roadmap and 11 phased milestones.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System architecture, RBAC boundaries, schema conventions, and immutability rules.
- [`PROGRESS.md`](./PROGRESS.md): Live implementation tracker and test verification logs.
