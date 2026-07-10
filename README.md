# Lumen Library System

A full-stack port of the **Lumen Library System** design into a **React + Express + Postgres** stack.

- **client/** — Vite + React + TypeScript. Faithful port of the design (parchment/sepia/sage themes, four accents, all 11 views).
- **server/** — Express + TypeScript REST API with **Drizzle ORM** over Postgres.
- **shared/** — TypeScript domain types shared by both.

## Features

| Area | What works |
|------|-----------|
| Front Desk | Live catalog search, borrow, recent activity |
| Dashboard | Real stats (titles, copies, loans, overdue, fines), most-borrowed, due-soon |
| Catalog | Search, subject filter, pagination, add/edit/delete books (auto barcode) |
| Borrowers | Members with computed books-out & fines-due, add/edit/delete |
| Circulation | Check-out / check-in by barcode, renew, return with **automatic fine calc** |
| Reservations | Holds queue, fulfill / cancel |
| Fines | Summary tiles, collect payments |
| Reports | 6 report types over a date range, printable letterhead sheet |
| Labels | Spine + QR label preview per title |
| Settings | Fine rules + editable shelf / subject / grade / section lists |
| User Management | Staff accounts, roles & permissions |
| Appearance | Theme + accent picker, persisted server-side |

## Prerequisites

- Node 18+
- A running local PostgreSQL (a database named `library_system`)

## Setup

```bash
# 1. install all workspaces
npm install

# 2. point the server at your database (edit if your credentials differ)
#    server/.env  ->  DATABASE_URL=postgres://postgres@localhost:5432/library_system

# 3. create the schema and seed sample data
npm run setup      # = db:push + db:seed

# 4. run both server (:4000) and client (:5173)
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the Express server on `:4000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run API + client together |
| `npm run db:push` | Sync Drizzle schema to Postgres |
| `npm run db:seed` | Reset & seed sample data |
| `npm run setup` | push + seed |
| `npm run build` | Type-check + build the client |

## API

Base URL `http://localhost:4000/api`

`/health` · `/dashboard` · `/books` · `/members` · `/loans` (`/checkout`, `/checkin`, `/:id/return`, `/:id/renew`) · `/reservations` · `/fines` (`/summary`, `/:id/collect`) · `/users` · `/settings` (`/lookups/:kind`) · `/reports/:type`
# library-management
