# ERP Money Transfer — Project Context for Claude

## Rules (Read Before Anything)

1. **Before starting any work** — give the user a written plan. Wait for approval. Never start coding without it.
2. **After every session** — update `WORKLOG.md` with what was discussed, what was decided, and why.
3. **When the plan changes** — update this file immediately.
4. **Work in parallel** — spawn agents for independent tasks instead of doing them one by one.
5. **Check WORKLOG.md first** — read it at the start of every new conversation to understand context.

---

## Project Overview

Internal money transfer management system for branch offices across India.

**Flow:** Collection branch creates entry → Head office approves → Payout branch completes payment → All balances and notifications updated automatically.

**Repo structure:**
```
erp-money-transfer/
├── backend/          Node.js + Express + MongoDB (being migrated to TypeScript)
├── mobile/           Expo React Native (being migrated to TypeScript)
├── WORKLOG.md        Session history — always update this
└── CLAUDE.md         This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, MongoDB (Mongoose), Socket.IO, JWT (ES256) |
| Mobile | Expo (SDK 56), React Native, React Navigation, TanStack Query, Zustand, Axios |
| Auth | JWT access token (15m) + refresh token (7d), stored in Expo SecureStore |
| SMS | Msg91 (production), MockSmsService (development) |
| Notifications | Socket.IO (real-time in-app) |

---

## Role Structure (3 roles — final, do not change)

| Role | Value | Who | Can Do |
|---|---|---|---|
| Super Admin | `super_admin` | Product owner (us) | Register companies, create head office accounts, cross-tenant view |
| Head Office | `head_office` | Company head | Approve/reject transactions, manage branches + users + settings, reports |
| Branch | `branch` | Sub-branch staff | Create transactions, complete payments (OTP), own branch only |

**Key rules:**
- `head_office` does NOT have a `branchId` — they oversee all branches
- `branch` MUST have a `branchId` — assigned to one specific branch
- `super_admin` lives in the `system` tenant

---

## API Base

- Backend runs on port `4000`
- Mobile `.env`: `EXPO_PUBLIC_API_URL=http://192.168.31.70:4000/api/v1`
- All routes prefixed: `/api/v1/`

---

## Current Status (as of 2026-07-01)

### Done ✅
- 3-role structure fully implemented (backend + mobile)
- Full transaction flow (create → approve → OTP → complete)
- Branch CRUD, User CRUD, Customer CRUD, Settings
- Super admin: register company, create head office account
- Head office: manage branches, users, settings, approve/reject transactions
- Branch: create transactions, complete payments
- Mobile navigation split by role
- Real-time notifications (Socket.IO)
- Audit logs
- Login time restriction

### Completed ✅ (Session 2 — 2026-07-01)

All 10 phases complete.

**Phase 1: Backend TypeScript Migration** — DONE
All 79 .js files → .ts. import/export syntax. CommonJS output. strict: false.

**Phase 2: Mobile TypeScript Migration** — DONE
All 47 .js files → .tsx/.ts. Screens = .tsx, API/stores/hooks = .ts.

**Phase 3: Reports + Balance Sheet (Backend)** — DONE
GetReports.ts, ExportReport.ts, ReportController.ts, report.routes.ts
GET /api/v1/reports, GET /api/v1/reports/export (Excel)

**Phase 4: Reports + Balance Sheet (Mobile)** — DONE
ReportsScreen.tsx, reportApi.ts, wired into MainNavigator for head_office.

**Phase 5: Small Backend Fixes** — DONE
- CompletePayment notifies head_office after payment
- Transaction filters: tokenNumber, minAmount, maxAmount
- DELETE /branches/:id + DELETE /users/:id (soft delete)
- authenticate.ts captures IP
- notification.routes.ts: list, markRead, markAllRead

**Phase 6: Filter UI (Mobile)** — DONE
TransactionListScreen: token search, date range, status chips (collapsible).
BranchListScreen + UserListScreen: delete buttons with confirmation.

**Phase 7: Notifications Screen** — DONE
NotificationsScreen.tsx, notificationApi.ts, Notifications tab in MainNavigator.

**Phase 8: QR Code** — DONE
react-native-qrcode-svg on TransactionDetailScreen, encodes token number.

**Phase 9: Transaction Search** — DONE (via Phase 6 filter)

**Phase 10: Dashboard Improvements** — DONE
Bell icon → Notifications, branch balance card, branch breakdown section.

### Completed ✅ (Sessions 8–9 — 2026-07-09)

**Mobile UI Overhaul** — all screens fixed for old + new devices. Utilities: `colors.ts` (withAlpha), `BadgeCount`, responsive typography in `TenantThemeProvider`, `AppInput` forwardRef. Rules in `mobile/AGENTS.md`.

**Phone / Sender / Receiver / Customer removal** — all phone fields removed from User, Branch, Tenant. Sender/receiver concept removed from Transaction. Entire Customer feature (model, repo, use-cases, controller, routes, mobile screens + tab) deleted.

**Bug fixes (payout branch):**
- `TransactionController.list()` — branch users now always see only their own branch's transactions
- `GetBranchLedger.ts` — effectiveBalance = balance − committedPayout − pendingPayout (pending was missing)
- `MyStatementScreen.tsx` — `pending_payout` / `pending_payout_reversed` events added to EVENT_META with correct labels, icons, and amber color

### Outstanding / Optional
- PDF export (Excel done; PDF not implemented)
- WhatsApp notifications
- Multi-language support
- Image/ID proof upload
- Gradual TypeScript strictness improvements

---

## Key Architecture Rules

- **Dependency flow:** Domain → Application → Infrastructure → Interfaces (never reverse)
- **tenantId is NEVER optional** in any repository method
- **All compound MongoDB indexes MUST start with `{ tenantId: 1, ... }`**
- **Money in paisa (integers)** — no floating point arithmetic
- **Audit log every state-changing operation**
- **Repository pattern** — no direct Mongoose imports in use-cases

---

## Environment

- Backend `.env` is at `backend/.env`
- Mobile `.env` is at `mobile/.env`
- Seed script: `node backend/scripts/seed-super-admin.js`
- Default super admin: username `superadmin`, password `Admin@1234`, tenant slug `system`
