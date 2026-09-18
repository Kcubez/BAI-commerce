# BAI-Commerce

An enterprise-grade **Business Operations & AI Integration Dashboard** with a commerce layer — orders, deals, products, and expenses — that consolidates multi-channel data (demands, finance, customer service, project infra) and leverages Google Gemini to generate real-time performance insights and localized action recommendations.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Supabase (PostgreSQL)**, and **Prisma ORM**.

> **BAI-service vs BAI-Commerce:** BAI-Commerce extends the BAI-service foundation (`demand-parser`, Telegram ingest, admin dashboard) with commerce modules — `commerce-parser.ts` / `commerce-import.ts`, sales-order intent parsing, and extra API domains (`commerce`, `deals`, `products`, `expenses`, `business-reports`).

---

## ✨ Core Features

### 🤖 Telegram Bot Data Ingestion
* **Stateful bot:** each sender's `activeReportType` (`qa` | `business_report` | `future_plan`) is toggled via inline keyboards and decides how the next message is handled (`POST /api/telegram/webhook`).
* **Text reports** are parsed with `parseDemandMessageWithGemini`; **file uploads** (PDF / image / xlsx / csv) go through `extractDataFromFile` in `after()` so the webhook returns 200 immediately. Commerce messages additionally go through `commerce-parser` (order / complaint / delivery / price intent).
* **Heuristic regex fallback** (`parseDemandMessage`) — parsing never throws; used when no Gemini key is configured or the API fails.
* Results are stored as `DemandRecord` rows linked to a `Customer` + `CustomerActivity`; extracted file text is also kept as `QADocument` for Q&A context.

### 🧠 Gemini AI Operations Analyst
* **Real-time Insights:** Automatically feeds operational metrics (leads, followups, appointments, sales, cost) to Google Gemini AI.
* **Burmese Recommendations:** Generates contextual action plans (marketing bottlenecks, overdue followups, show-rate analysis) in Myanmar language.
* **Interactive Navigation:** Action cards link directly to relevant workspaces (e.g., clicking a lead recommendation redirects directly to high-priority leads in Sales & Marketing).
* **Heuristic Fallback:** Robust fallback mechanisms to provide core business rules suggestions when API limits are reached.

### 🛒 Commerce Layer
* **Sales orders & deals:** deal funnels (leads -> quoted -> pending -> closed), purchase stats, and report filtering.
* **Products & expenses:** top products/services by revenue/volume, expense tracking, CSV import templates.
* **Finance spreadsheet import** via Telegram (`finance-import`).

### 📈 Operational Workspaces
* **Business Overview:** Tracks pacing of sales, appointments, expenses, and new customers against custom target lines.
* **Finance Hub:** Monitors revenue, expense, profit/loss, ROI, and cost distributions.
* **Sales & Marketing:** Tracks deals through standard funnels with advanced column filtering.
* **Customer Service:** Real-time client messaging records, followup tracking (due today, overdue), and conversion rates.
* **Projects & Infrastructure:** Tracks active projects, hosting expiries, and infrastructure updates.

### 📊 Zero-Dependency Premium SVG Charts
* **Custom Charts:** Custom-built React SVG Line Charts and Bar Charts with tooltips, grid overlays, and curved tension paths.
* **Zero External Bloat:** No external charting libraries (e.g. Recharts) used in core widgets, ensuring fast bundle delivery and perfect style synchronization.

### 📥 Multi-Source Excel Parsing
* **Bulk Imports:** Direct Excel sheet parsing (`xlsx`) for demand sheets, website updates, and project expiry lists.
* **Auto-Validation:** Verifies sheet column shapes before database updates. Burmese column headers are supported via import aliases.

### 🔐 Enterprise Authentication
* **Role-Based Auth:** Secure standard and admin routes using **Better Auth** (roles `user` / `admin`).
* **Route guard:** `src/proxy.ts` (Next.js 16 `proxy`, not middleware) checks the session cookie and redirects to `/login`. Public paths: `/login`, `/admin/login`, `/api/auth`, `/setup`, `/api/setup`, `/api/telegram`.
* **Admin Panel:** Detailed user listing, role promotion, and session tracking.

> **Language note:** UI copy, Telegram bot messages, and AI insights are intentionally bilingual (English + Burmese). Code comments and docs are English-only.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.2 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma ORM 7 |
| **Authentication** | Better Auth |
| **AI Integration** | Google Gen AI SDK (`@google/genai`) |
| **Data Ingestion** | XLSX library + Telegram Bot API |
| **Query Engine** | TanStack Query v5 |
| **State & Forms** | React Hook Form + Zod |
| **Notification** | Sonner toast |

---

## 📁 Project Structure

```text
BAI-commerce/
├── prisma/
│   └── schema.prisma          # DB schema (User, DemandRecord, Customer, BotSettings, ...)
├── src/
│   ├── proxy.ts               # Route guard (session cookie check + PUBLIC_PATHS)
│   ├── app/
│   │   ├── api/               # REST routes (admin, commerce, deals, products, expenses,
│   │   │                      #   telegram/webhook, demand-records, ...)
│   │   ├── setup/             # First-admin bootstrap page (locked after first user)
│   │   ├── (auth)/            # Login routes
│   │   ├── (dashboard)/       # Module dashboards (finance, customers, planning, ...)
│   │   └── layout.tsx         # Global provider bootstrap
│   ├── components/
│   │   ├── ui/                # Shadcn primitives
│   │   └── layout/            # Sidebar layouts and sync pollers
│   ├── hooks/                 # TanStack Query hooks per domain (*Keys factories)
│   └── lib/                   # auth, prisma, email (Brevo), demand-parser,
│                              # commerce-parser, commerce-import, data-import, api client, validations
```

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js 20+
* PostgreSQL database (Supabase pooled + direct URLs)
* Google AI Studio API Key (configured via Settings page, not env — see below)
* Brevo account (for email OTP)

### 2. Setup Env
Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
BETTER_AUTH_SECRET="your-auth-secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="BAI-Commerce"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BREVO_API_KEY=""
BREVO_SENDER_EMAIL=""
BREVO_SENDER_NAME="BAI-Commerce"
```

> **Bot config is DB-backed, not env:** `botToken`, `geminiApiKey`, `geminiModel`, and `webhookSecret` live on the `BotSettings` row where `isActive = true`. Set them via the in-app Settings page after logging in. Telegram must send the secret in the `x-telegram-bot-api-secret-token` header.

### 3. Install & Run
```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (flat config) |

> No test suite is configured yet.

---

## 👨‍💻 Initial Admin Setup
1. On a fresh database, open `/setup` and create the first super-admin account (`POST /api/setup`).
2. Setup locks permanently once a user exists (the page redirects to `/login`; the API returns 403).
3. Log in at `/admin/login` and open `/admin/users` for user management.

---

## 📡 Telegram Webhook Setup
1. Log in, open Settings, and save `botToken` + `webhookSecret` (+ `geminiApiKey`/`geminiModel`).
2. Register the webhook with Telegram so updates hit `POST /api/telegram/webhook`.
3. Webhook auth uses the per-bot `webhookSecret` via the `x-telegram-bot-api-secret-token` header.

---

## ☁️ Deploy (Vercel)
* Renaming the **GitHub repo** is safe — the Vercel Git integration follows the repo ID and auto-deploys keep working.
* Renaming the **Vercel project** changes the `*.vercel.app` URL — if you do, update `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` and re-register the Telegram webhook.
