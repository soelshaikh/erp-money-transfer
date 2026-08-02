# Pending Items — ERP Money Transfer

**Last verified:** 2026-07-22 — Session 17 completed: opening balance daily snapshots + commission override audit

---

## Status Key

| Symbol | Meaning |
|---|---|
| ✅ | Done — confirmed in code |
| ~ | Partial — some work done, something still missing |
| ❌ | Not done — confirmed absent from codebase |
| ❓ | Needs clarification before work can start |

---

## All 13 Items from 2026-07-10 List

### #1 — Super Admin can add new branches after initialization ❌

**What's needed:** Super admin should be able to create branches for any company, not just head office.

**Current state:** `branch.routes.ts:18` restricts `POST /branches` to `authorize(ROLES.HEAD_OFFICE)` only. Super admin is blocked.

**Work required:**
- Backend: allow `ROLES.SUPER_ADMIN` on `POST /branches`; `CreateBranch.ts` must accept `tenantId` from body (since super admin has no native tenantId)
- Mobile: super admin has no branch creation UI — needs a screen or entry point

---

### #2 — Runtime commission override for permitted users ✅

Confirmed done in Session 14 (2026-07-12).

- `User.model.ts` has `permissions.canOverrideCommission`
- `CreateTransactionScreen.tsx` shows override toggle when user has this permission
- `CreateTransaction.ts` priority: override → branch config → global

---

### #3 — Head office configures branch-wise commission ✅

Confirmed done in Session 14 (2026-07-12).

- `Branch.model.ts` has `commissionConfig: { enabled, type, value }`
- `EditBranchCommissionScreen.tsx` exists — accessible via pricetag icon on BranchListScreen
- `CreateTransaction.ts` resolves branch commission before falling back to global

---

### #4 — Override permission per user (grant/revoke) ✅

Confirmed done in Session 14 (2026-07-12).

- `UserListScreen.tsx` shows "Commission Override: Allowed/Not allowed" per branch user with Grant/Revoke button
- Calls `PATCH /users/:id` with `permissions.canOverrideCommission`

---

### #5 — Commission configuration from super admin level ✅

Completed 2026-07-21.

- Backend: `PATCH /tenants/:id/commission` (super_admin only) — schema `updateTenantCommission`, `TenantController.updateCommission()`
- Mobile: `TenantDetailScreen.tsx` shows current commission as `"Flat ₹X"` / `"X%"` / `"Not set"` in COMPANY DETAILS card; "Edit Commission" button in ACTIONS card opens a modal with type toggle (Flat/Percentage) + value input; pre-fills from existing value

---

### #6 — Payout branch hidden until head office approves ✅

Confirmed done in Session 14 (2026-07-12).

- `MongoTransactionRepository.findAll()` has `approvalStatus: { $ne: 'pending' }` on the payout branch side of `$or`
- `CreateTransaction.ts` no longer writes a `pending_payout` ledger entry
- Payout branch sees zero: no balance change, no transaction in list, no notification — until approval

---

### #7 — Effective balance label → "On Hold" + goes to 0 after payout ✅

Completed 2026-07-21.

- Balance returns to 0 after payout: done in Session 14
- `MainNavigator.tsx:103` — `EFF.` → `ON HOLD`
- `MyStatementScreen.tsx:34` + `BranchLedgerScreen.tsx:29` — `'Payout Committed'` → `'Payout Approved'`

---

### #8 — Rename "Payout Committed" → "Payout Approved" ✅

Completed 2026-07-21 (done as part of #7 — same files, same change).

---

### #9 — Pagination — no way to see beyond first 20 ✅

Completed 2026-07-21 (Session 16).

- `useInfiniteQuery` (TanStack Query v5) replaces `useQuery` — accumulation automatic
- `activeFilters` state drives query key — filter apply/clear resets to page 1
- "X of Y transactions" count in list header
- Load More button in footer (`"Load More (X of Y)"`) with spinner during fetch
- Pull-to-refresh still works correctly

**Also fixed two silent bugs:**
- `tokenNumber` filter was never passed through `TransactionController.list()` — now fixed
- Date params: mobile sent `dateFrom/dateTo`, backend expected `fromDate/toDate` — now fixed

---

### #10 — Day-wise collection calendar view ❌

**Current state:** No calendar screen, no calendar library installed.

**Work required:**
- Decide the exact view: a month grid where each day shows collection total? Or a list grouped by date?
- If grid: install a calendar component compatible with Expo SDK 56
- Backend: `GET /reports?type=daily` already returns `dailyBreakdown` grouped by date — this can be reused

---

### #11 — Token number field (new behavior) ❓

**Current state:** Token number search already exists in `TransactionListScreen` filter bar (exact/prefix match via regex on backend).

**Needs clarification:** What is the "new behavior" that's different from the existing search?

Possible interpretations:
- Auto-generate token number in a different format?
- Show token number more prominently somewhere?
- Token number entry on the CompleteByToken screen needs changes?

**Action required:** Keval to clarify before any work starts.

---

### #12 — Sender & Receiver with mobile number ❓

**Current state:** Entirely removed in Session 9 (2026-07-09) per explicit user request. Customer model, screens, and all sender/receiver fields on Transaction were deleted.

**Needs clarification:** Do you want this back? If yes, confirm:
- Should sender/receiver be a full customer entity (with its own screen) or just two plain text+phone fields on the transaction form?
- Should old transactions without sender/receiver still display correctly?

**Action required:** Keval to confirm whether to restore or keep removed.

---

### #13 — Opening Balance — store and display ✅

Completed 2026-07-22 (Session 17).

- `BranchDailyBalance.model.ts` (NEW) — stores `{ tenantId, branchId, date (YYYY-MM-DD), openingBalance, closingBalance }` with unique compound index
- `MongoBranchLedgerRepository.addEntry()` — auto-upserts daily snapshot on every ledger write (`$setOnInsert` for `openingBalance`, `$set` for `closingBalance`)
- `GetBranchLedger.ts` — returns `openingBalance` in response when `fromDate` filter is set
- `BranchLedgerScreen.tsx` — date filter bar + Opening Balance card (shown when date filter active)
- `BranchDailyBalancesScreen.tsx` (NEW) — head office can see full day-by-day opening/closing history per branch
- Commission override audit also added: `COMMISSION_OVERRIDE` action in `AUDIT_ACTIONS`, second audit log in `CreateTransaction.ts`

---

## Quick Summary

| # | Description | Status |
|---|---|---|
| 1 | Super Admin adds branches | ❌ |
| 2 | Runtime commission override | ✅ |
| 3 | Branch-wise commission (head office) | ✅ |
| 4 | Override permission per user | ✅ |
| 5 | Commission config from super admin | ✅ |
| 6 | Payout branch hidden until approval | ✅ |
| 7 | "Effective" → "On Hold" + 0 after payout | ✅ |
| 8 | "Payout Committed" → "Payout Approved" | ✅ |
| 9 | Pagination (beyond first 20) | ✅ |
| 10 | Day-wise collection calendar | ❌ |
| 11 | Token number new behavior | ❓ needs clarification |
| 12 | Sender & Receiver with phone | ❓ needs clarification |
| 13 | Opening Balance | ✅ |

**9 done · 2 not done · 2 need clarification**
