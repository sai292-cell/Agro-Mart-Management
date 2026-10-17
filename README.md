# Shivshree Agro Mart OS

> A production-oriented AgroShop Management System custom-engineered for **Shivshree Agro Mart, Maharashtra, India**.

---

## 🛠️ Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router 7, Lucide Icons, i18next (Marathi + English)
- **Backend**: Node.js, Express, Helmet, CORS, Zod environment validation
- **Database**: MongoDB Atlas (Phase 3+)

---

## 🚀 Installation & Local Development

### 1. Install Dependencies
Run the installation command from the repository root:
```bash
# Install root, server, and client dependencies
npm run install:all
```
*(Or install each folder manually: `npm install`, `cd server && npm install`, `cd ../client && npm install`)*

### 2. Environment Configuration
Copy example files and set your local variables:
```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

### 3. Start Development Servers
From the root directory, start both the client and server concurrently:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Start backend API (Port 5000)
npm run dev:server

# Start Vite frontend (Port 5173)
npm run dev:client
```

---

## 🔗 Key Endpoints & Routes
- **Frontend Landing Page**: `http://localhost:5173/`
- **Owner Login Placeholder**: `http://localhost:5173/owner/login`
- **Customer Login Placeholder**: `http://localhost:5173/customer/login`
- **Backend API Health Check**: `http://localhost:5000/api/v1/health`

---

## 📄 Documentation
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md): Complete feature roadmap and phased milestones.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System architecture, RBAC matrix, and data precision conventions.
- [`PROGRESS.md`](./PROGRESS.md): Live implementation tracker and verification results.
