# Sales CRM

A full-stack, self-hostable Sales CRM built with React, Express, and PostgreSQL. Designed for small-to-medium sales teams managing leads, customers, follow-ups, and internal communications.

---

## Features

- **JWT Authentication** — superadmin / admin / sales-rep roles with scoped access
- **Lead Pipeline** — 9-stage pipeline (New → Qualify → Discovery → Proposal → Negotiate → Close Win/Loss → Maintain → Grow) with colour-coded status pills and inline reassignment
- **Customer Profiles** — full contact details, interaction history, Google Maps links
- **Follow-up Scheduling** — per-lead dates with a "This Week" dashboard view grouped by day (Overdue / Today / weekday)
- **Follow-up Emails** — one-click email via SMTP (configurable in-app or via env vars)
- **Team Portal** — threaded messages, quick updates (Notice / Urgent / Critical), photo gallery, document storage
- **Admin Panel** — user management, reminder scheduling
- **Reports** — printable / PDF-ready lead reports (by rep, overdue activity, last 7 days)
- **Branding Customization** — logo upload, colour themes, company name
- **Data Backup & Restore** — JSON export and superadmin restore from the System Config panel
- **First-run Setup Wizard** — guided wizard for database, SMTP, and initial superadmin account

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter |
| Backend | Express 5, Node.js 24, TypeScript |
| Database | PostgreSQL 16, Drizzle ORM |
| Auth | JWT (jsonwebtoken), bcrypt |
| Email | Nodemailer |
| Monorepo | pnpm workspaces |
| Build | esbuild (API), Vite (frontend) |

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          Express API (port 8080)
│   └── crm/                 React + Vite frontend
├── lib/
│   ├── db/                  Drizzle schema & migrations
│   ├── api-spec/            OpenAPI spec (openapi.yaml)
│   └── api-client-react/    Generated TanStack Query hooks
├── scripts/
│   ├── deploy.sh            VPS build + deploy script
│   └── post-merge.sh        Post-merge hook (pnpm install + db push)
├── .env.example             Environment variable reference
├── nginx.conf.example       Nginx reverse proxy example
└── pnpm-workspace.yaml      Workspace & catalog config
```

---

## Prerequisites

- **Node.js** 20+ (22 or 24 recommended)
- **pnpm** 9+ — `npm install -g pnpm`
- **PostgreSQL** 14+ — a database and user with create-table privileges
- **PM2** (production) — `npm install -g pm2`
- **Nginx** (production) — for reverse proxy and SSL

---

## Quick Start (Local Development)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/sales-crm.git
cd sales-crm

# 2. Copy and fill in environment variables
cp .env.example .env
#  Edit .env — at minimum set DATABASE_URL and SESSION_SECRET

# 3. Install dependencies
pnpm install

# 4. Push the database schema
pnpm --filter @workspace/db run push

# 5. Start the API server (port 8080)
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev

# 6. In a second terminal, start the frontend dev server
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/crm run dev
```

Open `http://localhost:3000` and follow the Setup Wizard to create your superadmin account.

> **macOS / Windows note:** `pnpm-workspace.yaml` contains linux-x64-only overrides for
> `esbuild`, `rollup`, and `lightningcss` to reduce install size on the server.
> On other platforms, remove or comment out the entire `overrides:` section before running
> `pnpm install`.

---

## VPS Deployment

### 1. Server Setup

```bash
# Install Node.js (example using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22

# Install pnpm and PM2
npm install -g pnpm pm2

# Install nginx and certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Create a postgres database and user
sudo -u postgres psql <<SQL
  CREATE USER crm_user WITH PASSWORD 'yourpassword';
  CREATE DATABASE salescrm OWNER crm_user;
SQL
```

### 2. Clone and Configure

```bash
git clone https://github.com/your-org/sales-crm.git /opt/salescrm
cd /opt/salescrm

cp .env.example .env
# Edit .env with your real DATABASE_URL, SESSION_SECRET, etc.
```

### 3. Build and Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script will:
- Install all dependencies
- Push the DB schema
- Build the API (esbuild bundle at `artifacts/api-server/dist/index.mjs`)
- Build the frontend (static files at `artifacts/crm/dist/public`)
- Copy frontend to `/var/www/salescrm`
- Start/restart the API with PM2

### 4. Configure Nginx

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/salescrm
sudo nano /etc/nginx/sites-available/salescrm   # set your domain and paths
sudo ln -s /etc/nginx/sites-available/salescrm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Enable SSL

```bash
sudo certbot --nginx -d yourdomain.com
```

### 6. PM2 Startup on Reboot

```bash
pm2 startup
# Follow the printed command
pm2 save
```

### 7. First-Run Setup Wizard

Open `https://yourdomain.com` in a browser. The app will redirect to the Setup Wizard where you will:
1. Create your superadmin account
2. Enter company branding
3. Configure SMTP for email delivery
4. Set your primary colour theme

---

## Updating

```bash
cd /opt/salescrm
git pull
./scripts/deploy.sh
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret for JWT signing — keep long and random |
| `PORT` | Yes | Port the API server listens on (e.g. `8080`) |
| `NODE_ENV` | Yes | `production` or `development` |
| `BASE_PATH` | Build-time | Vite base path, use `/` for root deployment |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (usually `587` or `465`) |
| `SMTP_USER` | No | SMTP login username |
| `SMTP_PASS` | No | SMTP login password |

SMTP settings can also be configured (and overridden) from the app's **System Config → SMTP Settings** panel without redeploying.

---

## Demo Credentials (development seed only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@crm.com | admin123 |
| Sales Rep | sarah@crm.com | sales123 |
| Sales Rep | mike@crm.com | sales123 |

Remove or change these accounts before going to production.

---

## License

MIT
