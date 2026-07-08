# Leave Management System (LMS)

A modern, full-stack Leave Management System built with **Next.js**, **Prisma**, and **Supabase (PostgreSQL)**.

## Features

- **Leave Requests & Approval Workflow**: Employees can apply for leaves, and admins/managers can approve or reject them.
- **Leave Rules & Carry Forward**: Dynamic leave rules, policy compliance, and automated ledger syncing.
- **Audit Logs**: Full system logging of all leave balance adjustments, approvals, and status transitions.
- **Supabase Integration**: Robust PostgreSQL storage with RLS policies.

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and your package manager of choice installed.

### Environment Setup

Create a `.env` file in the root directory and configure the following variables:

```env
DATABASE_URL="your-supabase-connection-string"
DIRECT_URL="your-supabase-direct-connection-string"
```

### Database Setup

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Run Migrations**:
   ```bash
   npx prisma migrate dev
   ```

3. **Seed the Database**:
   ```bash
   npx prisma db seed
   ```

### Running the Development Server

Start the Next.js development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## Database Keep-Alive (Supabase Free Tier)

To prevent the Supabase database from pausing due to inactivity on the free tier, a daily GitHub Action is configured under `.github/workflows/supabase-keep-alive.yml`.

To enable this, configure the following repository secrets in your GitHub repository (`Settings -> Secrets and variables -> Actions`):

* `SUPABASE_URL`: Your Supabase project URL (e.g., `https://<project-id>.supabase.co`).
* `SUPABASE_ANON_KEY`: Your Supabase project anonymous/public API key.


