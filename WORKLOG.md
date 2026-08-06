# WORKLOG — ERP Money Transfer

---

## 2026-08-06 — Session 39

### Feature: Credit Commission to Sending Branch — Complete

**Feature overview:** When the `creditCommissionToSendingBranch` tenant flag is ON and a receiver-pays transaction (`payout` or `payout_extra`) is completed, the commission no longer goes to the payout branch immediately. Instead:
- Payout branch: shows `commissionPayable` (liability — money they owe the sending branch)
- Collection/sending branch: shows `commissionReceivable` (asset — money owed to them)
- Head office or branch can initiate a bulk settlement to formally transfer the amount
- Settlement locks payables (`reserveForSettlement`), then `completeSettlement` updates both branch balances and clears the payable/receivable

**All work done across 2 sessions (Sessions 38–39).**

---

### Backend (Session 38 — complete)

**New models:**
- `CommissionPayable.model.ts` — per-transaction debt record (tenantId, fromBranchId, toBranchId, transactionId, amount, status, settlementId)
- `CommissionSettlement.model.ts` — bulk settlement record (fromBranch, toBranch, totalAmount, transactionCount, payableIds, audit trail)

**New repositories:**
- `MongoCommissionPayableRepository.ts` — `getPendingSummary()` groups by branch pair; `reserveForSettlement()` locks payables; `findPending()` filters unreserved only
- `MongoCommissionSettlementRepository.ts` — `complete()` uses status guard against double-complete

**New use-cases:**
- `GetCommissionPayables.ts` — supports `summaryOnly: true` for grouped pending view
- `GetCommissionSettlements.ts` — list with filters
- `CreateCommissionSettlement.ts` — validates branches, gets all unreserved pending payables, creates settlement, reserves payables
- `CompleteCommissionSettlement.ts` — marks settled, writes `commission_settlement_out` (payout branch) + `commission_settlement_in` (collection branch) ledger entries, updates both balances

**New routes:** `GET /api/v1/commission-settlements/payables`, `GET /`, `GET /:id`, `POST /`, `PATCH /:id/complete`

**New tenant route:** `PATCH /api/v1/tenants/:id/credit-commission-flag`

**Modified:**
- `CompletePayment.ts` — flag ON: writes `commission_payable` + `commission_receivable` ledger entries + creates CommissionPayable record; flag OFF: unchanged `commission_earned` flow
- `Branch.model.ts` — added `commissionPayable`, `commissionReceivable` fields
- `BranchLedger.model.ts` — 4 new event types
- `MongoBranchLedgerRepository.ts` — new events in `buildIncrement()`; effective balance formula extended: `balance − committed − pending + payoutCompleted − commPayable + commReceivable`
- `GetBranchLedger.ts`, `GetDashboard.ts`, `BranchController.balanceSummary()` — return new fields
- `Tenant.model.ts` — `featuresSchema.creditCommissionToSendingBranch`
- `container.ts`, `app.ts` — wired up all new components

---

### Mobile (Session 39 — complete)

**New screens:**
- `CommissionPayablesScreen.tsx` — grouped summary of pending payables by branch pair; "Initiate Settlement" button creates settlement and navigates to detail; header right navigates to CommissionSettlementsScreen
- `CommissionSettlementsScreen.tsx` — list with status filter chips (All/Pending/Completed); tap → CommissionSettlementDetailScreen
- `CommissionSettlementDetailScreen.tsx` — shows settlement detail, branch flow, audit trail (initiated/completed by); "Mark Transferred" button for pending settlements

**New API:** `commissionSettlementApi.ts` (listPayables, listSettlements, getSettlement, createSettlement, completeSettlement)

**Navigation:**
- MainNavigator: 3 new screens registered in DashboardStack (both branch + head_office) and BranchStack (head_office)
- BranchLedgerScreen header: `swap-horizontal-outline` button → CommissionPayablesScreen
- CommissionPayablesScreen header: `time-outline` button → CommissionSettlementsScreen
- DashboardScreen: `Comm. Payable` and `Comm. Receivable` pills made tappable → CommissionPayablesScreen

**Modified screens:**
- `DashboardScreen.tsx` — commPayable/commReceivable pills shown when > 0, tappable
- `BranchLedgerScreen.tsx` — 4 new EVENT_META entries; commissionPayable/commissionReceivable indicator rows in summary card; settlements nav button in header
- `TenantDetailScreen.tsx` — "COMMISSION ROUTING" card with toggle for `creditCommissionToSendingBranch` flag (super admin only)

**i18n:** Added `nav.commissionPayables` and `nav.commissionSettlements` in en.ts and gu.ts

---

## 2026-07-31 — Session 37

### Bug Fix: Comprehensive IST timezone + commission side audit

**User reported:** Today's transactions appearing under "yesterday" in daily breakdown, and commission always attributed to collection branch regardless of setting.

**Root cause analysis:**
Two systemic bugs found spread across 12 files:

#### Bug A: IST vs UTC date handling (9 files)
Every date boundary was UTC-based (`toISOString()`, `T00:00:00.000Z`). In India (UTC+5:30), transactions between midnight IST and 5:30 AM IST fell on the previous UTC calendar day.

Additional secondary bug: 5 use-cases were wrapping YYYY-MM-DD strings in `new Date()` before passing to `findAll()`. Since `findAll()` now uses template literals (`${fromDate}T...`), a Date object coerces to a locale string like `"Thu Jul 31 2026..."`, producing an invalid ISO string → Invalid Date → date filter silently ignored → all transactions returned regardless of date.

**Backend fixes:**
- `GetReports.ts` — daily/monthly grouping → IST (`toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'})`)
- `GetDailyReport.ts` — grouping → IST; removed double-conversion (`new Date()` wrapping)
- `GetDailyTally.ts` — default "today" and `isToday` comparison → IST
- `GetDashboard.ts` — replaced `new Date(year,month,date)` default with IST string; no more Date object passed to getDashboardStats
- `getDashboardStats()` in MongoTransactionRepository — added smart `pd()` parser: Date object → pass through; full ISO string (has 'T') → `new Date(v)`; YYYY-MM-DD → append `+05:30` IST offset
- `MongoTransactionRepository.findAll()` — all `T00:00:00.000Z`/`T23:59:59.999Z` → `+05:30`
- `GetBranchCollectionReport.ts` — removed double-conversion
- `GetRejectedTransactions.ts` — removed double-conversion
- `GetPaymentMethodReport.ts` — removed double-conversion
- `ExportReport.ts` — removed double-conversion
- `CreateTransaction.ts` — token number date (`dateStr`) → IST
- `MongoBranchLedgerRepository.ts` — daily snapshot key → IST

**Mobile fixes:**
- `DailyTallyScreen.tsx` — UI default date → IST
- `ShakhaEntryScreen.tsx` — `todayISO()` → IST; queryFn changed from full ISO timestamps to YYYY-MM-DD strings

#### Bug B: Commission side attribution in reports (1 file)
`getCommissionSummary()` always grouped by `collectionBranchId`, so payout-earned commission appeared under collection branch in the Commission by Branch report.

**Fix:** `MongoTransactionRepository.getCommissionSummary()` — added `$addFields: { earningBranchId: { $cond: [commissionSide==='payout', payoutBranchId, collectionBranchId] } }` before `$group`. Balance sheet entries in `CompletePayment.ts` were already correct.

Also fixed `GetBranchCollectionReport.ts` — the per-branch collection report now correctly attributes commission to payout entry when `commissionSide === 'payout'`, and added `totalCommission` to the payout bucket.

**Note:** `GetPeriodComparison.ts` still passes Date objects (computed via `setHours`) to `getDashboardStats`. This is correct on IST server. The `pd()` helper in `getDashboardStats` handles it cleanly.

---

## 2026-07-30 — Session 36

### Feature: Third commission mode — "Receiver Pays (Extra on top)"

**Problem:** When "receiver pays" is selected, there are two distinct business scenarios:
1. Commission deducted from amount — receiver gets ₹4500 from ₹5000 transfer
2. Receiver pays commission separately on top — receiver gets ₹5000 AND pays ₹500 to payout branch

**Backend changes (3 files):**
- `backend/src/config/constants.ts` — Added `PAYOUT_EXTRA: 'payout_extra'` to `COMMISSION_SIDE`
- `backend/src/application/use-cases/transaction/CreateTransaction.ts`
  - `commissionSide` parsing now accepts `payout_extra` as a distinct value (not collapsed to `collection`)
  - `sourceBranch` (commission earner) = payout branch for both `payout` and `payout_extra`
  - `finalAmount = amount` for `payout_extra` (receiver gets full amount)
  - `collectionCredit = amount` for `payout_extra` (sender pays exact amount, no commission at collection)
- `backend/src/application/use-cases/transaction/CompletePayment.ts`
  - Commission credit now applied for both `payout` and `payout_extra`
  - Description differentiates: "collected from receiver" vs "earned"
- `schemas.ts` already uses `...Object.values(COMMISSION_SIDE)` so auto-includes new value

**Mobile changes (7 files):**
- `en.ts` + `gu.ts` — Added keys: `receiverPaysExtra`, `receiverPaysExtraSub`, `receiverExtraDetail`, `collectFromSender`
- `CreateTransactionScreen.tsx` + `ShakhaEntryScreen.tsx`
  - 3-chip commission side selector (was 2): Sender Pays | Receiver Pays | Receiver Pays +
  - Commission preview: for `payout_extra` shows "Receiver gets ₹5000 + pays ₹500 to branch"
- `TransactionDetailScreen.tsx`
  - Header subtitle handles all 3 modes
  - **New "COLLECT FROM SENDER" callout box** for collection-side — shows total to collect (₹5500 = ₹5000 + ₹500 commission) prominently at top of detail card
  - `commissionPaidBy` row shows correct label for all 3 modes
  - Passes `commissionSide`, `commissionAmount`, `amount` to CompletePayment navigate
- `CompletePaymentScreen.tsx`
  - For `payout_extra`: shows "PAY TO RECEIVER ₹5000" + amber "COLLECT FROM RECEIVER ₹500" callout box
  - For other modes: unchanged behaviour

**Decision:** `finalAmount` = `amount` for `payout_extra` (committed payout reflects what the payout branch actually disburses before commission recovery). Net balance effect = `amount − commissionAmount` (same as `payout`) because commission credit is applied at CompletePayment.

### Feature: "Collect from Sender" visible in Transaction Detail

When `commissionSide === 'collection'`, a prominent callout box now appears in the transaction detail header card showing the total the collection branch must collect from the sender (transfer amount + commission).

---

## 2026-07-30 — Session 35

### Feature: Reports drill-down — tap any breakdown row to see full transaction list + EOD per-branch accordion

**New screen — `mobile/src/features/reports/screens/ReportTransactionsScreen.tsx`**
- Generic drill-down screen reused from all three breakdown tables
- Route params: `{ fromDate, toDate, branchId?, title }` — title becomes the nav header
- Fetches `GET /transactions?fromDate&toDate&branchId&page=1&limit=100`
- Each transaction card shows: token number (monospace), collection → payout branch, amount + final amount, commission (amount + who bears it), created-by name, created-at datetime, approved/rejected-by name + time, payment method badge, remarks (if present)
- FlatList with all required perf props; empty state illustration; "showing first 100" note when total > 100
- Tap any card → `TransactionDetail` screen

**`MainNavigator.tsx`**
- Added `ReportTransactionsScreen` import
- Added `ReportTransactions` screen to ReportsStack (dynamic title from `route.params.title`)
- Added `TransactionDetail` screen to ReportsStack so tapping through to detail works

**`ReportsScreen.tsx`**
- Added `useNavigation`, `TouchableOpacity`
- Added `expandedDates: Set<string>` state + `toggleDate()` for EOD accordion
- Added `monthRange()` helper — converts "2026-07" → `{ fromDate: "2026-07-01", toDate: "2026-07-31" }`
- Daily rows: tappable → `ReportTransactions` with `fromDate = toDate = entry.date`; trailing chevron
- Monthly rows: tappable → `ReportTransactions` with full month range; trailing chevron
- Branch rows (HO): tappable → `ReportTransactions` with active date range + `branchId`; trailing chevron
- EOD Balance converted to expandable accordion — tap date row to toggle per-branch sub-rows
  - Per-branch: Branch | Opening | EOD | Change (green/red)
  - Left border line visually groups branch rows under the parent date
  - EOD field tried as `closingBalance ?? eodBalance ?? balance` (defensive naming)

---

## 2026-07-30 — Session 34

### Bug Fix: Force-Logout Not Reaching Other Device via Socket

**Symptom:** Admin suspends a staff member's device session from Login Activity screen. The target device stays logged in.

**Root Cause:** Socket.IO events are ephemeral — if the target device's socket connection was temporarily down (app backgrounded, network switch, OS sleep), the single `force_logout` emission is lost forever. On reconnect, the device re-joins rooms but receives no replay of missed events.

**Fix — Two changes:**

**Mobile `useSocket.ts`:**
- Include `deviceId` (from SecureStore key `app_device_id`) in socket `auth` alongside tenantId/userId/role/branchId
- Fixed cleanup: set `socketRef.current = null` after disconnect (prevents stale reference)
- Updated alert message to accurately say "session ended by administrator"

**Backend `server.ts`:**
- Imported `DeviceSessionModel` and `DEVICE_STATUS`
- On every socket connection (including auto-reconnect): if `deviceId` is in auth, look up `DeviceSession` for `{tenantId, userId, deviceId}` and check status
- If `status === SUSPENDED` → immediately emit `force_logout` to this socket, then disconnect
- DB error in the check is caught and only logged (never blocks socket connection)

**Why this fixes the problem:**
Socket.IO auto-reconnect triggers a NEW `connection` event on the server. So even if the device missed the original `force_logout` event while offline, the server re-fires it on reconnect — which happens within seconds of the app coming to foreground.

**Files changed:** `mobile/src/shared/hooks/useSocket.ts`, `backend/src/server.ts`

---

## 2026-07-30 — Session 33

### Feature: ReportsScreen overhaul — filter UI, period label, table headers, remove broken NavCards

**Context:** Reports screen had raw TextInput date filter, no default date range (so summary showed "0" and user couldn't tell what period the data covered), no column headers on breakdown tables, and a large section of NavCards navigating to non-existent routes (would crash on tap).

**Mobile — `ReportsScreen.tsx` (complete rewrite)**

**Removed:**
- `TextInput`, `TouchableOpacity`, `useNavigation` imports (no longer needed)
- `NavCard` component and all nav card sections (Daily Operations, Branch Reports, Financial, Staff, Trends, Audit) — all routes were non-existent; removed to prevent crashes
- `SectionHeader` component (no more sections)
- Hardcoded spacing/font-size violations throughout

**Added:**
- `fmtDate` import from `../../../utils/fmt` (for period label)
- `toYMD()` and `thisMonthStart()` helpers to compute default dates without using `Date.now()` (which is blocked in workflow scripts)
- `fmtPeriod(startDate, endDate)` — formats a human-readable range label
- `FilterPanel` + `DateRangeFilter` + `FilterChipGroup` now wired up properly; the "Group By" chip (Daily / Monthly / Branch) lives inside the filter panel
- Default date range = **This Month** on first load — `fromDate = thisMonthStart()`, `toDate = toYMD(new Date())`; `activeFilters` pre-populated so the first query always returns real data
- `clearFilters()` resets to "This Month" defaults (not to empty), so clearing always shows a meaningful state
- **Period label** above summary section: calendar icon + "01 Jul – 30 Jul 2026" chip derived from `activeFilters` (shows the period of the *fetched* data, not the pending filter)
- `TableHeader` component — shaded primary-tinted background, bold caption labels, flex columns
- `EmptyRow` component — bar chart icon + message when no data
- Breakdown tables now have proper column headers:
  - Daily: Date | Txns | Amount | Commission (striped rows)
  - Monthly: Month | Txns | Amount | Commission (striped rows)
  - Branch: Branch | Txns | Amount (HO only, type=branch)
  - Commission by Branch: Branch | Commission (HO only, type=branch)
- Daily EOD Balance table (HO + type=daily) preserved with updated styling (uses `rowStyle()` helper)
- Breakdown sections gated on `activeFilters.type` (what was last applied) not pending `type` state
- `refreshControl` now uses `isFetching && !isLoading` (avoids spinner on first load)
- All hardcoded values replaced: `padding: 12` → `theme.spacing.md`, `gap: 8` → `theme.spacing.sm`, `borderRadius: 6/8` → `theme.borderRadius.sm/md`, `fontSize: 12/13` → `theme.typography.caption/label`
- `theme.colors.warning` used directly (previously `theme.colors.warning || '#f59e0b'` workaround removed)

---

## 2026-07-30 — Session 32

### Features: Daily EOD Balance + Export Format Permissions

**Context:** Continued from previous session (context limit). Two features approved and implemented.

---

#### Feature 1 — Daily Report EOD Balance (head office only)

**Mobile — ReportsScreen.tsx**
- Added `settingsApi` import + `useQuery(['settings'])` for export format gating (staleTime 60s)
- Added `useQuery(['allBranchBalances', activeFilters])` — enabled only for head_office when `type === 'daily'`; shares the same `activeFilters` as the main report query so date ranges stay in sync
- Added `balanceDates` from the query result
- Added "Daily Balance (EOD)" section below the existing daily transaction breakdown:
  - 4-column table: Date | Opening | EOD | Change
  - Opening = sum of all branches' `openingBalance` for that date
  - EOD = `entry.netClosing` (backend-computed net across all branches)
  - Change = EOD − Opening, colored green/red
  - `allowFontScaling={false}` on all amount cells
- Visible only to head_office users when type tab is 'daily' and data exists

---

#### Feature 2 — Export Format Permissions (super admin controls per tenant)

**Backend — `Tenant.model.ts`**
- Added `exportFormats: { type: [String], default: ['csv', 'excel', 'pdf'] }` to `featuresSchema`
- All existing tenants get all 3 formats by default

**Backend — `TenantController.ts`**
- Added `updateExportFormats(req, res)` method
- Validates: array required, at least 1 item, only `csv`/`excel`/`pdf` are valid
- Updates `features.exportFormats` via `tenantRepository.update()`
- Bound in constructor

**Backend — `tenant.routes.ts`**
- Added `PATCH /tenants/:id/export-formats` route (super_admin only, no custom validator needed)

**Mobile — `tenantApi.ts`**
- Added `updateExportFormats(id, formats)` → `PATCH /tenants/:id/export-formats`

**Mobile — `TenantDetailScreen.tsx`**
- Added `localExportFormats: string[]` state (default all 3)
- `useEffect` syncs from `tenant.features.exportFormats` when tenant data loads
- Added `exportFormatsMutation` via `useMutation`
- Added `toggleExportFormat(fmt)` — prevents deselecting the last format
- Added inline "Export Formats" AppCard before ACTIONS section:
  - 3 side-by-side chips (CSV / EXCEL / PDF), multi-selectable
  - Active chip = primary filled, inactive = translucent primary
  - Save button with loading state

**Mobile — `ReportsScreen.tsx`**
- Reads `allowedFormats` from `settingsData.features.exportFormats` (defaults to all 3 if not set)
- Each export button (Excel / PDF / CSV) is conditionally rendered based on `allowedFormats.includes(fmt)`
- Also fixed pre-existing bug: `handleExport` now passes `reportType: activeFilters.type || type` to `downloadReport()` (was previously missing the report type entirely)

**Mobile — `SettingsScreen.tsx`**
- Updated Features card to show export formats as read-only pills (CSV/EXCEL/PDF)
- Enabled formats: primary-tinted background; disabled: muted divider background
- Condition updated from `features.reportExport !== undefined` to `features && (...)` to always show the card when features exist

---

## 2026-07-30 — Session 31

### Feature: Notes screen company validation + early deviceId capture

**Context:** Notes screen is a disguise for the ERP app — must never show errors to strangers.

**Backend — new public endpoint `GET /api/v1/auth/validate-company?slug=xyz`**
- No auth required, uses existing `authLimiter`
- Returns `{ valid, name, status }` — if not found returns `{ valid: false }`
- `AuthController.ts` — added `validateCompany()` + `tenantRepository` injected
- `auth.routes.ts` — `GET /validate-company` added before `/login`
- `container.ts` — `tenantRepository` passed to `authController`

**Mobile — NotesScreen.tsx: silent company validation**
- Calls `GET /auth/validate-company?slug=trimmed` before saving
- Company not found or not active → `setSaved(true)` only (fake "✓") → no navigation
- Network error → proceed to login anyway
- `loading` boolean prevents double-taps, zero visual change to user
- No errors, no spinners — Notes screen cover is fully preserved

**Mobile — AppNavigator.tsx: early deviceId capture**
- First `useEffect` now calls `getOrCreateDeviceId()` fire-and-forget on app open
- DeviceId UUID exists before Notes screen, regardless of `isConfigured` state

---

## 2026-07-30 — Session 30

### Fix: ShakhaEntryScreen — 3 missing fields added

**What was found:** Gujarati ShakhaEntryScreen was missing 3 fields that exist in the English CreateTransactionScreen:
1. Payment method selector (was hardcoded to `'cash'`)
2. Collection slip photo upload
3. Customer token number (optional)

**What was changed (`mobile/src/features/transaction/screens/ShakhaEntryScreen.tsx`):**
- Added import: `ImagePickerButton`
- Added `PAYMENT_METHODS` constant (cash/neft/rtgs/bank_transfer→IMPS)
- Added state: `paymentMethod` (default 'cash'), `collectionPhotoUrl`, `customerTokenNo`
- Added ref: `customerTokenNoRef`
- Updated `clearForm()` to reset all 3 new fields
- Updated `transactionApi.create()` call: `paymentMethod` (dynamic), + `collectionPhotoUrl`, + `customerTokenNo` (both spread-if-truthy)
- Added keyboard chain: `mokalnarMobile` → `customerTokenNo` → `commissionValue`
- UI order after mokalnar row: Customer Token field, Payment Method chips (Cash/NEFT/RTGS/IMPS), ImagePickerButton, then commission override

**i18n:** All keys already existed in `gu.ts` (`txn.paymentMethodLabel`, `txn.tokenOptional`, `txn.tokenPlaceholder`, `txn.photoOptional`).

---

## 2026-07-30 — Session 29

### Feature: Full Reporting Module (Backend + Mobile)

**What was built:** Complete reporting system with 13 report types, all with PDF/Excel/CSV export.

**Backend — new use-cases (`backend/src/application/use-cases/reports/`):**
- `GetDailyReport.ts` — day-by-day transaction summary (HO + Branch)
- `GetPendingApprovalQueue.ts` — oldest-first pending transactions (HO + Branch)
- `GetOutstandingPayments.ts` — approved but not completed (HO + Branch)
- `GetRejectedTransactions.ts` — rejected transactions with reason (HO + Branch)
- `GetBranchCollectionReport.ts` — per-branch collection + payout summary (HO only)
- `GetBranchFlowMatrix.ts` — branch-to-branch corridor matrix (HO only)
- `GetDailyTally.ts` — all branches opening/closing/net tally for a date (HO only)
- `GetAllBranchDailyBalances.ts` — date-range view of all branch daily balances (HO only)
- `GetCashPosition.ts` — live cash position snapshot across all branches (HO only)
- `GetStaffReport.ts` — per-staff transaction count/amount/commission (HO + Branch)
- `GetCommissionOverrideReport.ts` — audit log of commission overrides (HO only)
- `GetPeriodComparison.ts` — current vs previous week/month/quarter (HO + Branch)
- `GetPaymentMethodReport.ts` — Cash/NEFT/RTGS/IMPS breakdown (HO + Branch)

**Backend — modified files:**
- `MongoTransactionRepository.ts` — added `getFlowMatrix()` and `getStaffReport()` aggregation methods
- `ITransactionRepository.ts` — added abstract stubs for both new methods
- `ReportController.ts` — replaced with 16 methods (3 existing + 13 new)
- `report.routes.ts` — replaced with 16 GET routes; all new routes before `/export`
- `ExportReport.ts` — replaced; now accepts `?reportType=X` param and exports any report type as PDF/Excel/CSV
- `container.ts` — all 13 use-cases imported, instantiated, wired to ReportController and ExportReport

**New routes added to `/api/v1/reports/`:**
`/daily`, `/pending-queue`, `/outstanding`, `/rejected`, `/branch-collection`, `/branch-flow`, `/daily-tally`, `/all-branch-balances`, `/cash-position`, `/staff`, `/commission-overrides`, `/period-comparison`, `/payment-methods`
Export: `/export?reportType=X&format=pdf|excel|csv`

**Mobile — new screens (`mobile/src/features/reports/screens/`):**
- `DailyReportScreen.tsx` — date range filter, alternating-row table, export
- `PendingQueueScreen.tsx` — infinite scroll, warning banner, oldest-first
- `OutstandingPaymentsScreen.tsx` — infinite scroll, orange left border
- `RejectedTransactionsScreen.tsx` — date filter, infinite scroll, rejection reason block
- `BranchCollectionReportScreen.tsx` — per-branch two-panel cards (collection/payout)
- `BranchFlowMatrixScreen.tsx` — corridor table sorted by amount
- `DailyTallyScreen.tsx` — single date picker, colored net total badge, per-branch table
- `AllBranchBalancesScreen.tsx` — flat list with date header + branch row types
- `CashPositionScreen.tsx` — live snapshot, nav refresh button, per-branch balance cards
- `StaffReportScreen.tsx` — date filter, two-row layout per staff member
- `CommissionOverrideReportScreen.tsx` — date filter, infinite scroll, override diff display
- `PeriodComparisonScreen.tsx` — Week/Month/Quarter chips, comparison table with growth %
- `PaymentMethodReportScreen.tsx` — per-method cards with icon + color

**Mobile — modified files:**
- `reportApi.ts` — 13 new API functions + `downloadReport` extended with `reportType`, `date`, `period` params
- `ReportsScreen.tsx` — replaced; adds 13 NavCard entries grouped under section headers: Daily Operations / Branch Reports / Financial / Staff / Trends / Audit
- `MainNavigator.tsx` — 13 new imports + 13 new screens registered in `ReportsStack`

**Key design decisions:**
- `GetDailyTally` uses models directly (exception: cross-branch aggregate not supported by repository pattern efficiently)
- `GetFlowMatrix` and `GetStaffReport` added as new repository methods (proper clean arch)
- All 13 mobile screens follow every rule in `mobile/AGENTS.md` (useBottomTabBarHeight, withAlpha, FlatList perf props, allowFontScaling={false})
- Every screen has PDF + Excel + CSV export at bottom

---

## 2026-07-30 — Session 28

### Features: Login Activity / Activity Log moved to Settings; Role-based session visibility

**What changed:**

**Backend:**
- `DeviceSessionController.ts`: Added `mine()` method — returns current user's own sessions; added `userId` query param support to `list()` method
- `device-session.routes.ts`: Added `GET /mine` route (authenticated, any role) before parameterised routes; branch users can now fetch their own sessions without admin access

**Mobile:**
- `LoginActivityScreen.tsx`: Role-based filtering
  - **Head office**: sees all staff login history + user picker filter + all active sessions + Sign Out All button
  - **Branch staff**: auto-filtered to own userId only, no user picker, "My Sessions" via `/device-sessions/mine`
- `SettingsScreen.tsx`: Added ACTIVITY section (before Sign Out button)
  - "Login Activity" → visible to both head_office and branch (description differs per role)
  - "Full Audit Log" → head_office only
- `MainNavigator.tsx`: Moved `LoginActivity` and `ActivityLog` screen registrations from `ReportsStack` to `SettingsStack`; `ReportsStack` now only has `ReportsMain`
- `reportApi.ts`: Added `getMyDeviceSessions()` calling `GET /device-sessions/mine`

---

## 2026-07-30 — Session 27

### Feature: Unified Filter System (all filter UI standardised)

**Problem:** Every screen with filters had its own approach — raw TextInput for dates in ReportsScreen, custom TouchableOpacity chips per screen, inconsistent Clear/Apply button styles, no shared components.

**What was built:**

**New shared components (`mobile/src/shared/components/`):**
- `FilterChip.tsx` — single chip: active = filled primary, inactive = translucent primary. `allowFontScaling={false}`.
- `FilterChipGroup.tsx` — row of FilterChips with optional section label, wraps automatically. Props: `options: {label, value}[]`, `selected`, `onSelect`, `label?`.
- `FilterPanel.tsx` — AppCard wrapper with `children` + standardised Clear / Apply (`AppButton`) row. Pass `visible={false}` and it renders nothing. Uses `t('common.clear')` and `t('common.apply')`.

**Upgraded `DateRangeFilter.tsx`:**
- Removed raw TextInput ("type YYYY-MM-DD") — replaced with two tappable date buttons showing `30 Jul 2026` format (via `fmtDate` from `fmt.ts`)
- iOS: tapping a button reveals an inline `DateTimePicker` spinner with a Done button below
- Android: tapping a button opens the native date dialog
- Added "Last 7" preset. All 6 presets: Today · Yesterday · Last 7 · This Week · This Month · Last Month
- Smart auto-correct: if From > To, To is moved to match; if To < From, From is moved to match
- External API unchanged: `fromDate: string, toDate: string, onFromChange, onToChange, theme`

**Screen migrations:**
- `TransactionListScreen` — FilterPanel wraps AppInput (token search) + DateRangeFilter + FilterChipGroup (All/Pending/Approved/Rejected/Completed)
- `ActivityLogScreen` — FilterPanel wraps FilterChipGroup (Module) + DateRangeFilter; `applyFilters()` now closes the panel
- `BranchLedgerScreen` — FilterPanel wraps DateRangeFilter; removed inline AppButton row
- `BranchDailyBalancesScreen` — same as BranchLedger
- `ReportsScreen` — FilterPanel (always visible) wraps DateRangeFilter + FilterChipGroup (Daily/Monthly/Branch); added Clear button; removed raw TextInput and raw type tabs

**Result:** All 5 filter screens now share the same component tree pattern, same chip style, same date display format, same Clear + Apply buttons.

**DashboardScreen** — not changed (its modal date picker is already polished and serves a different UX purpose).

---

## 2026-07-30 — Session 26

### Features: Device Approvals UI, EmployeeId, Disable-with-Transactions, App Install Tracking

**Audit of all 14 items from user's list:**
- Items 7 (IMPS), 8 (mukam), 9 (i18n), 10 (dates), 11 (₹ spacing), 14 (dual commission): **Already done in prior sessions** ✅
- Item 1 (auto logout first device): **Already done** — `suspendAllExcept()` runs on approval ✅
- Item 12 (filter selection): **Already done** — filter UI in TransactionListScreen ✅

**Implemented this session:**

**Item 2 — Device Session Admin UI (mobile)**
- NEW `mobile/src/features/user/api/deviceSessionApi.ts` — `list`, `approve`, `reject`, `suspend` calls
- NEW `mobile/src/features/user/screens/DeviceApprovalsScreen.tsx` — two-tab screen (Pending / All Sessions); Pending tab shows Approve + Reject buttons per session; All tab shows Suspend for approved sessions; confirm Alert before destructive actions; invalidates both query keys on success
- `mobile/src/navigation/MainNavigator.tsx` — `DeviceApprovalsScreen` imported and registered as `DeviceApprovals` in UserStack
- `mobile/src/features/user/screens/UserListScreen.tsx` — shield-checkmark header button navigates to DeviceApprovals

**Item 3 — EmployeeId**
- `backend/src/infrastructure/db/models/User.model.ts` — added `employeeId: { type: String, default: null }`
- `backend/src/application/use-cases/user/CreateUser.ts` — auto-generates on user creation: `{SLUG}-{BRANCH_CODE}-{USERNAME}` (branch), `{SLUG}-HO-{USERNAME}` (head_office), `SA-{USERNAME}` (super_admin)
- `backend/src/application/use-cases/reports/GetLoginReport.ts` — `employeeId` added to populate select + returned in each log entry
- `mobile/src/features/reports/screens/LoginActivityScreen.tsx` — `LoginEvent.employeeId` field added; `LoginEventCard` shows `ID: {employeeId}` when present

**Item 4 — Disable shows active transactions on both sides**
- `mobile/src/features/user/screens/UserListScreen.tsx`:
  - `handleToggle` for disable case now calls `userApi.getActiveTransactions(id)` first
  - Shows a bottom-sheet modal with those transactions (both collection + payout side) before confirming
  - `disablingId` state shows spinner on the ban button while fetching
  - `toggleDisableMutation` handles the actual PATCH on confirmation
  - Enable case remains a simple Alert (no transactions needed)

**Item 5 — Suspend (permanent) vs Disable (temporary) visual distinction**
- `mobile/src/features/user/screens/UserListScreen.tsx` — suspended status badge now uses `theme.colors.error` (red) instead of gray, clearly differentiating from disabled (orange)

**Item 6 — App install / download tracking**
- Backend: `AppInstall.model.ts` (deviceId unique, `$setOnInsert` upsert — only first install per device recorded)
- Backend: `RegisterAppInstall` use-case, `AppInstallController`, `app-install.routes.ts`
- Backend: `POST /api/v1/app-install` — no auth required; records deviceId, name, platform, IP, user-agent
- `container.ts` + `app.ts` — wired and mounted
- `mobile/src/navigation/AppNavigator.tsx` — useEffect fires once after `isConfigured=true`; checks `SecureStore('app_install_tracked')`; if not set, POSTs to `/app-install` then sets the flag

---

## 2026-07-26 — Session 25

### Fix: Gujarati translations — all English strings replaced

**Problem:** gu.ts had ~50 values left in English (Username, Password, Sign In, Staff, Dashboard, Reports, Settings, Loading..., etc.)

**What was changed in `mobile/src/i18n/locales/gu.ts`:**
- `nav`: dashboard→ ડેશબોર્ડ, staff→ કર્મચારી, reports→ અહેવાલ, settings→ વ્યવસ્થા, myStatement→ હિસાબ, branchStatement→ શાખા હિસાબ, addStaff→ + કર્મચારી, devices→ ઉપકરણ, editSettings→ વ્યવસ્થા, createHOAccount→ HO ખાતુ, loginActivity→ પ્રવૃત્તિ
- `auth`: username→ ID, password→ પાસવર્ડ, signIn→ પ્રવેશ, resetConfig/reset→ ફેરી
- `common`: loading→ લોડ..., filter→ ફિલ્ટર, reset→ ફેરી, signOut→ બહાર, signOutConfirm→ બહાર ખાતરી?, suspended→ સ્થગિત
- `pending`: pendingBody/pendingHint→ login replaced with પ્રવેશ; suspendedTitle→ ઉપકરણ સ્થગિત; blockedTitle→ વધુ પ્રયત્નો; blockedBody→ 1 કલાક રાહો.
- `dash`: loading→ લોડ..., lastWeek→ ગયો હફ્તો, lastQuarter→ ગયા 3 મહિના, from→ થી, to→ સુધી, tapToOpen→ ટેપ કરો, onHold→ રોકાયેલ, status→ સ્થિતિ, branchActivity→ શાખા પ્રવૃત્તિ, deficit→ ઘાટો !, balanced→ સંતુલિત ✓
- `txn`: loading (all instances)→ લોડ..., photos→ ફોટો, actions→ ક્રિયા, flatType→ ફ્લેટ (Rs.), percentType→ ટકા (%)
- `branch`: loading (all instances)→ લોડ..., effective→ અસર. બેલેન્સ, limitReached→ મર્યાદા, tapHint→ શાખા → હિસાબ, type→ પ્રકાર, contactPerson→ સંપર્ક, commFlat→ ફ્લેટ (Rs.), commPct→ ટકા (%)
- `ledger`: all loading→ લોડ..., committed→ પ્રતિબદ્ધ, legend→ માહિતી, opening→ આરંભ, closing→ સમાપ્તિ, dailyHint→ આરંભ → સમાપ્તિ, netTotal→ Net કુલ, deficit/booksBalanced → Gujarati
- `user`: all loading→ લોડ..., staffLimitTitle→ કર્મચારી મર્યાદા, staffLimitMsg→ મહત્તમ:, staffUsed→ વપરાશ:, role→ ભૂમિકા, deviceWhitelistTitle→ ઉપકરણ:, addDevice→ + ઉપકરણ, suspendWarning→ Login→ પ્રવેશ
- `settings`: signOut/signOutConfirm→ Gujarati, loading→ લોડ..., settingsSection→ વ્યવસ્થા, flat/percentage→ Gujarati, editSettings→ વ્યવસ્થા ફેરફાર, reportExport→ અહેવાલ Export
- `reports`: all loading→ લોડ..., summary→ સારાંશ, total→ કુલ, daily→ દૈનિક, monthly→ માસિક, loginEvent/loginEvents/noLoginEvents→ Gujarati
- `notifs`: loading→ લોડ...
- `company`: branchLimit/staffLimit→ Gujarati

### Fix: Commission config reads from wrong branch

**Problem:** When `commissionSide === 'payout'`, the commission rate/type/value was always being read from `collectionBranch.commissionConfig` instead of `payoutBranch.commissionConfig`.

**Files changed:**
1. `backend/src/application/use-cases/transaction/CreateTransaction.ts` (lines 60-65): Added `const sourceBranch = commissionSide === COMMISSION_SIDE.PAYOUT ? payoutBranch : collectionBranch` — commission config now reads from the correct branch
2. `backend/src/infrastructure/db/models/BranchLedger.model.ts`: Added `'commission_earned'` to the event enum
3. `backend/src/infrastructure/db/repositories/MongoBranchLedgerRepository.ts`: Added `case 'commission_earned': return { balance: amount }` in `buildIncrement()`

---

## 2026-07-26 — Session 24

### Feature: i18n (English + Gujarati multi-language support)

**What was done:**

**Translation files:**
- `mobile/src/i18n/locales/en.ts` — complete English translation file (all 13 namespaces: nav, common, auth, pending, dash, txn, branch, ledger, user, settings, reports, notifs, company)
- `mobile/src/i18n/locales/gu.ts` — complete Gujarati Unicode file generated via PowerShell `[char]` codepoints to avoid rendering artifacts; all 13 namespaces
- `mobile/src/i18n/index.ts` — i18next init with `lng: 'en'`, `fallbackLng: 'en'`

**Language store:**
- `mobile/src/store/langStore.ts` — Zustand store; persists `lang: 'en' | 'gu'` in AsyncStorage; calls `i18n.changeLanguage()` on load and set

**Navigation updates:**
- `AppNavigator.tsx` — imports `'../i18n'` for side effect; calls `loadLang()` in useEffect on startup
- `MainNavigator.tsx` — `useTranslation` added to all 8 stack functions + tab navigator; all tab labels + stack screen titles use `t()`

**Settings — language toggle:**
- `SettingsScreen.tsx` — two-chip toggle (English / GU) wired to `useLangStore.setLang()`; chips show active/inactive state via primary color fill

**All 34 feature screens updated:**
- All screens have `import { useTranslation } from 'react-i18next'` and `const { t } = useTranslation()`
- Every hardcoded UI string (labels, buttons, placeholders, section headers, empty states, alerts) replaced with `t('namespace.key')` calls
- API status values used in conditionals (=== 'pending', === 'collection', etc.) were not translated
- Special case: ShakhaEntryScreen had hardcoded Gujarati strings; all replaced with t() calls

**Key technical decisions:**
- Gujarati codepoints written with PowerShell `function G { [string]::Join('', ($args | ForEach-Object { [char]$_ })) }` to avoid context-window rendering artifacts (Gujarati Unicode U+0A80–U+0AFF renders as Greek/Cyrillic glyphs in context)
- Language persists across app restarts via AsyncStorage
- `react-i18next` `useTranslation` hook used (pure JS, no native modules)

**New txn keys added for ShakhaEntryScreen:**
`date, receiverName, receiverMobile, senderName, senderMobile, mobilePlaceholder, todayEntries, receiverCol, senderCol, payoutBranchCol, commissionCol, selectPayoutBranch, payoutBranchRequired, amountRequired, commissionValueInvalid, commissionPctMax`

---

## 2026-07-26 — Session 23

### Feature: Dual Commission Side (Collection vs Payout branch earns)

**Problem:** Commission always went to collection branch. Two new flows needed:
- **Sender pays (collection side):** Jay gives ₹10,000 + commission at AHM → JPR pays full ₹10,000 → AHM earns commission
- **Receiver pays (payout side):** Ramesh gives ₹1,00,000 at AHM → Mumbai pays ₹99,500 → Mumbai earns commission

**Key design decisions:**
- `commissionSide: 'collection' | 'payout'` field added to Transaction model (default: `'collection'` — backward compatible)
- `amount` always = principal transfer amount entered by staff
- `finalAmount`: collection side → equals `amount` (receiver gets full); payout side → `amount − commission`
- Collection ledger credit: collection side = `amount + commissionAmount`; payout side = `amount`
- At payout completion: payout side adds `commission_earned` credit entry to payout branch
- Old transactions with no `commissionSide` default to `'collection'` — no migration needed

**Backend — modified files:**
- `constants.ts` — added `COMMISSION_SIDE = { COLLECTION, PAYOUT }`
- `Transaction.model.ts` — added `commissionSide` field (enum, default 'collection')
- `CreateTransaction.ts` — reads `commissionSide`, overrides `finalAmount`, adjusts collection ledger credit amount + description
- `CompletePayment.ts` — adds `commission_earned` credit to payout branch when `commissionSide === 'payout'`

**Mobile — modified files:**
- `CreateTransactionScreen.tsx` — two-chip toggle "Sender Pays / Receiver Pays" with contextual note showing which branch earns; amount label changes per side
- `ShakhaEntryScreen.tsx` — Gujarati toggle "અહીં ખેપ / ત્યાં ખેપ" with subtext "મોકલ. ચૂકવે / લેનાર ભોગવે"
- `TransactionDetailScreen.tsx` — header shows full money flow breakdown; added "Commission Paid By" row in details

---

## 2026-07-26 — Session 22

### Label, Date, and Formatting Fixes (Items #7, #8, #10, #11)

**What was done:**

**#7 — Bank Transfer → IMPS**
- `CreateTransactionScreen.tsx`: `PAYMENT_METHODS` label for `bank_transfer` changed from `'Bank Transfer'` to `'IMPS'`
- `TransactionDetailScreen.tsx`: `PAYMENT_METHOD_LABELS.bank_transfer` changed from `'Bank Transfer'` to `'IMPS'`

**#8 — mukbam → mukam (Gujarati spelling fix)**
- `ShakhaEntryScreen.tsx`: all 4 occurrences of `મુકબમ` replaced with `મુકામ` (placeholder text + label)

**#10 — Date format uniforming**
- Created `mobile/src/utils/fmt.ts` with shared utilities: `fmtAmt`, `fmtAmtSigned`, `fmtDate`, `fmtTime`, `fmtDateTime`
- Removed local `formatDate`/`formatTime`/`fmt` helpers from 11 screens; all now import from `fmt.ts`:
  - `BranchLedgerScreen`, `BranchDailyBalancesScreen`, `MyStatementScreen`, `CommissionDetailScreen`
  - `ActivityLogScreen`, `TenantStaffScreen`, `UserDevicesScreen`, `LoginActivityScreen`
  - `TransactionDetailScreen` (createdAt field)

**#11 — Rupee spacing (₹ space amount, space around arithmetic operators)**
- All `₹{amount.toLocaleString('en-IN')}` patterns and `` `₹${amount}` `` patterns across ALL mobile screens replaced with `fmtAmt(amount)` (returns `₹ amount` with space)
- Signed patterns like `{sign}₹{abs}` replaced with `fmtAmtSigned(n)` (returns `± ₹ amount`)
- Files updated: MainNavigator, BranchListScreen, TransactionListScreen, BalanceSummaryScreen (signed display), DashboardScreen, CompletePaymentScreen, CompleteByTokenScreen, ShakhaEntryScreen, UserListScreen, TenantDetailScreen, SettingsScreen, ReportsScreen

**Key decision:**
- `fmtAmt(n)` → `₹ n` (unsigned, used for amounts where sign is shown separately or not needed)
- `fmtAmtSigned(n)` → `± ₹ n` (used for net/effective amounts where sign conveys credit/debit)

---

## 2026-07-24–26 — Session 21

### Features: UI Fixes + Device Session Approval System (Req 1)

**What was done:**
1. Branch List Screen — redesigned to 3-row compact card with kebab menu (⋯)
2. Audit Log detail — added before/after diff display in ActivityLogScreen
3. Create Transaction — added optional `customerTokenNo` field (English + Gujarati)
4. Reports Screen — fixed gray background on Activity Log and Full Audit Log cards
5. Dashboard — added Recent Transactions table (TOKEN/AMOUNT/STATUS grid, tap to detail)
6. StatusBadge — fixed "APPROVE\nD" wrapping bug (allowFontScaling + numberOfLines)
7. **Device Session Approval (Req 1) — FULLY IMPLEMENTED**

**Device Session — Key Design Decisions:**
- Feature is toggled per company via `tenant.features.deviceApprovalRequired` (set by super admin)
- First login on new device → creates PENDING DeviceSession → login returns `deviceStatus: 'pending'` (no tokens)
- Mobile reads `deviceStatus`: if `approved` → normal login; else → `setPendingDevice()` in store → AppNavigator shows PendingDeviceScreen
- PendingDeviceScreen is a friendly info page (not a blocking error). User taps "Back to Login" to go back.
- Admin approves → `suspendAllExcept()` runs on other sessions → `refreshTokenHash = null` wipes all other sessions
- Rejected device can retry up to 5 times/hour (rate-limited in CreateDeviceSession.ts)
- Old `allowedDevices` whitelist on User model completely replaced

**Backend — new files:**
- `backend/src/infrastructure/db/models/DeviceSession.model.ts` — schema: tenantId, userId, deviceId, deviceName, platform, ip, status, attemptCount, etc.
- `backend/src/infrastructure/db/repositories/MongoDeviceSessionRepository.ts` — findOne, findById, create, update, listByUser, listByTenant, suspendAllExcept
- `backend/src/application/use-cases/device/CreateDeviceSession.ts` — handles first login + rejected retry with rate limit
- `backend/src/application/use-cases/device/ApproveDeviceSession.ts` — approves, suspends others, wipes refreshTokenHash
- `backend/src/application/use-cases/device/RejectDeviceSession.ts` — rejects with audit log
- `backend/src/application/use-cases/device/SuspendDeviceSession.ts` — suspends, wipes refreshTokenHash if was approved
- `backend/src/application/use-cases/device/ListDeviceSessions.ts` — list by tenant or user
- `backend/src/interfaces/http/controllers/DeviceSessionController.ts`
- `backend/src/interfaces/http/routes/device-session.routes.ts` — GET /, GET /user/:userId, PATCH /:id/approve, PATCH /:id/reject, PATCH /:id/suspend

**Backend — modified files:**
- `backend/src/config/constants.ts` — added DEVICE_STATUS, NOTIFICATION_TYPE.DEVICE_PENDING_APPROVAL, AUDIT_ACTIONS.DEVICE_*, MODULES.DEVICE
- `backend/src/infrastructure/db/models/Tenant.model.ts` — added `features.deviceApprovalRequired`
- `backend/src/application/use-cases/auth/Login.ts` — replaced old allowedDevices whitelist with DeviceSession check; returns `deviceStatus` in all responses
- `backend/src/container.ts` — wired all device use-cases + controller + routes
- `backend/src/app.ts` — mounted `/api/v1/device-sessions`

**Mobile — new files:**
- `mobile/src/features/auth/screens/PendingDeviceScreen.tsx` — shows pending/suspended/rejected/blocked states; "Back to Login" calls clearPendingDevice

**Mobile — modified files:**
- `mobile/src/store/authStore.ts` — added `pendingDeviceInfo`, `setPendingDevice()`, `clearPendingDevice()`
- `mobile/src/features/auth/screens/LoginScreen.tsx` — removed old device ID copy UI; routes to setPendingDevice or login() based on deviceStatus
- `mobile/src/navigation/AppNavigator.tsx` — added pendingDeviceInfo check → shows PendingDeviceScreen

**Outstanding (Req 2 + 3 not started):**
- Req 2: Admin device management UI per user (list sessions, approve/reject/suspend per user)
- Req 3: Login session activity view for users and admins

---

## 2026-07-23 — Session 20

### Features: Activity Log Screen + Staff Limit + Transaction Limits → Super Admin Only

**What was requested:**
1. Show audit logs in the mobile app (head office browses all system activity)
2. Super admin sets a staff member limit per company (same enforcement as branch limit)
3. Move transaction limits (max per transaction, daily limit per branch) from head office settings to super admin only

**Backend — new files:**

`GetAuditLogs.ts` — queries `audit_logs` with filters (module, action, userId, dateFrom, dateTo, page, limit), parallel find + countDocuments, returns `{ logs, total, page, pages }`

`AuditLogController.ts` — `list()` scoped to `req.user.tenantId`, passes query params to use-case

`audit-log.routes.ts` — `GET /` protected by `authenticate` + `authorize(ROLES.HEAD_OFFICE)`

`UpdateTenantStaffLimit.ts` — mirror of UpdateTenantBranchLimit; counts active users via `countActiveByTenant`; blocks if new limit < current count

**Backend — modified files:**

`Tenant.model.ts` — added `staffLimit: { type: Number, required: true, default: 99, min: 1 }`

`IUserRepository.ts` — added abstract `countActiveByTenant(tenantId)`

`MongoUserRepository.ts` — implemented `countActiveByTenant`: `countDocuments({ tenantId, status: { $ne: 'inactive' } })`

`CreateUser.ts` — added `tenantRepository` dep; checks staffLimit before creating (guard skipped if tenantRepository absent for backward-compat)

`UpdateSettings.ts` — strips `settings.transactionLimits.*` keys before applying so head office cannot change them

`TenantController.ts` — added `updateStaffLimit()` and `updateTransactionLimits()` methods

`tenant.routes.ts` — added `PATCH /:id/staff-limit` and `PATCH /:id/transaction-limits`

`schemas.ts` — added `updateTenantStaffLimit` and `updateTenantTransactionLimits` schemas

`container.ts` — wires GetAuditLogs, AuditLogController, UpdateTenantStaffLimit; adds tenantRepository to createUser; exports auditLogController + auditLogRoutes

`app.ts` — mounts `/api/v1/audit-logs`

**Mobile — new files:**

`auditLogApi.ts` — `getAuditLogs(params)` → `GET /audit-logs`

`ActivityLogScreen.tsx` — `useInfiniteQuery`; collapsible filter bar (module chips + date range); FlatList with perf props; each row: colored module icon, action badge, actor name/@username, entity ref, timestamp; Load More; empty state

**Mobile — modified files:**

`tenantApi.ts` — added `updateStaffLimit` and `updateTransactionLimits`

`TenantDetailScreen.tsx` — Staff Limit + txn limit InfoRows in COMPANY DETAILS card; "Edit Staff Limit" + "Edit Transaction Limits" buttons + modals

`EditSettingsScreen.tsx` — removed TRANSACTION LIMITS section (both inputs, label, caption, form state)

`MainNavigator.tsx` — imported ActivityLogScreen; added `ActivityLog` to ReportsStack

`ReportsScreen.tsx` — added "Full Audit Log" card (head_office only) linking to ActivityLog

**Key decisions:**
- Activity Log is head_office only (branch has no audit context; super_admin is system tenant)
- staffLimit defaults to 99 so existing companies are unaffected
- Transaction limits stripped silently in UpdateSettings (no error shown to head_office — field just ignored) 

---

## 2026-07-22 — Session 19

### Bug Fix: Export (Excel / CSV / PDF) Not Working

**Root causes found:**

1. **Mobile — auth bypass**: `downloadReport` used `FileSystem.downloadAsync` directly, which bypasses the Axios interceptor entirely. If the 15-minute access token had expired, the export silently failed with a 401 — no retry, no refresh, just "Export failed with status 401". Normal API calls never hit this because Axios auto-refreshes.

2. **Mobile — potential gzip corruption**: `FileSystem.downloadAsync` may save the raw compressed bytes for `text/csv` responses (the `compression()` middleware compresses compressible content types). Depending on the Expo/RN version and HTTP backend used, the saved file could be a gzip archive instead of a CSV.

3. **Backend — Content-Disposition without filename quotes**: `attachment; filename=transactions.xlsx` is technically non-compliant with RFC 6266 (filename must be quoted). Some HTTP clients reject or mis-parse unquoted filenames.

4. **Backend — `res.end(buffer)` without Content-Length**: `res.end()` is the raw Node.js method; using `res.send()` causes Express to automatically set the `Content-Length` header, which allows the client to show download progress and validate the response size.

**Changes made:**

`mobile/src/features/reports/api/reportApi.ts`:
- Removed `SecureStore` and `URLSearchParams` imports (no longer needed)
- `downloadReport` now uses `apiClient.get('/reports/export', { responseType: 'arraybuffer' })` — the Axios interceptor handles token refresh automatically
- Converts `ArrayBuffer → base64` in 1 KB chunks (avoids spread-operator call stack limits)
- Writes the binary to cache using `FileSystem.writeAsStringAsync(..., base64, { encoding: 'base64' })`
- Added `Sharing.isAvailableAsync()` guard before `Sharing.shareAsync`

`backend/src/interfaces/http/controllers/ReportController.ts`:
- `Content-Disposition` now quotes the filename: `attachment; filename="transactions.xlsx"`
- Changed `res.end(buffer)` → `res.send(buffer)` so Express sets `Content-Length` automatically

---

## 2026-07-23 — Session 20

### Feature: Shakha Entry Screen (Gujarati transaction form)

**What was requested:** New Gujarati-language transaction entry screen matching a shared image.
Both old (English) and new (Gujarati) screens accessible from the "+" button in TransactionListScreen.

**Design decisions:**
- Header title = user's own branch code (dynamic via `useLayoutEffect` after branches load)
- Amount field label = branch code (not a static "Amount" label)
- Date = auto-filled today, read-only display
- Lenar name + mobile in one row; Mokalnar name + mobile in one row (image showed two rows by mistake — confirmed one row)
- Vigat (description) → stored in `remarks`
- Lenar/Mokalnar also appended to `remarks` as `L: name mobile | M: name mobile`
- Mukkam = payout branch, bottom-sheet modal showing branch code + name circle avatar
- Khep = commission, sent as `commissionOverride: { type: 'flat', value }` only if user has `canOverrideCommission` permission
- Fluyer button = clear form; Send button = submit transaction
- Today's entries table at bottom: queries `{ fromDate: today, toDate: today, limit: 50 }`, refreshes after each successful submit
- "+" button in TransactionListScreen now shows a bottom-sheet chooser: "Shakha Entry (ગુ)" or "New Transaction (EN)"

**Files changed:**
- `mobile/src/features/transaction/screens/ShakhaEntryScreen.tsx` — CREATED (new screen)
- `mobile/src/features/transaction/screens/TransactionListScreen.tsx` — "+" button → chooser modal
- `mobile/src/navigation/MainNavigator.tsx` — imported ShakhaEntryScreen, registered as `ShakhaEntry` in TransactionStack

---

## 2026-07-22 — Session 18

### Feature: Comprehensive Audit Log Enrichment

**What was requested:** For every operation (create/approve/reject/complete transaction, create/update/delete branch, create/update/delete user, login, password reset), store:
- The actor's **name and username at time of action** (not just their ID) — so the log stays readable even after the person changes their name
- **Branch names** (not just IDs) on transaction audit entries — so Approve/Reject/Complete logs tell you which branches were involved
- **Commission metadata** (type, value, amount) on Create Transaction audit
- Fix two silent enum bugs that caused Delete Branch and Delete User audit writes to fail completely
- Fix security leak: UpdateUser was storing `passwordHash` in the `before` field

**Root causes found:**
1. `DeleteBranch.ts` used `AUDIT_ACTIONS.DELETE_BRANCH || 'DELETE_BRANCH'` — `DELETE_BRANCH` doesn't exist in the enum, so JS fell back to the literal string `'DELETE_BRANCH'`, which Mongoose then rejected via enum validation → audit write silently discarded
2. Same bug in `DeleteUser.ts` with `AUDIT_ACTIONS.DELETE_USER`
3. `UpdateUser.ts` passed full `before` user doc (including `passwordHash`) to `auditService.log()`
4. `req.user` in the authenticate middleware only had `id, tenantId, role, branchId, permissions` — no `name` or `username`

**Backend changes:**

`authenticate.ts` — added `name username` to the UserModel `.select()` so `req.user.name` and `req.user.username` are available in all request handlers

`AuditLog.model.ts` — added two optional fields: `actorName: String` and `actorUsername: String`

`DeleteBranch.ts` — fixed: `AUDIT_ACTIONS.DELETE` (exists), `MODULES.BRANCH`, proper `before/after`, added `actorName`/`actorUsername`

`DeleteUser.ts` — same fix; `before` now stores `{ username, name, role, status: 'active' }`, `after: { status: 'inactive' }`

`Login.ts` — audit now includes `actorName`, `actorUsername`, and `after: { username, name, role }`

`ResetPassword.ts` — audit now includes actor info and `after: { targetUsername, targetName, targetRole }`

`UpdateUser.ts` — strips `passwordHash` and `otpHash` from `before` before logging; passes `actorName`/`actorUsername`

`CreateUser.ts` — passes `actorName`/`actorUsername` to audit

`CreateBranch.ts` — passes `actorName`/`actorUsername`; `after` trimmed to key fields only (not full noisy branch doc)

`UpdateBranch.ts` — passes `actorName`/`actorUsername`

`ApproveTransaction.ts` — added `branchRepository` to constructor; after approval, looks up both collection and payout branches in parallel; audit `after` now includes `{ tokenNumber, amount, commissionAmount, finalAmount, collectionBranchName, collectionBranchCode, payoutBranchName, payoutBranchCode }`

`RejectTransaction.ts` — same enrichment; `after` also includes `remarks`

`CompletePayment.ts` — same enrichment

`CreateTransaction.ts` — audit `after` now includes `{ commissionType, commissionValue, commissionAmount, collectionBranchName, collectionBranchCode, payoutBranchName, payoutBranchCode }`; commission override audit also includes `actorName`/`actorUsername`

`BranchController.ts` — all use-case calls now pass `actorName: req.user.name, actorUsername: req.user.username`; direct `auditService.log()` calls in `toggleStatus` also enriched with actor info and branch name in `before`/`after`

`TransactionController.ts` — all use-case calls pass actor info

`UserController.ts` — all use-case calls pass actor info; direct `auditService.log()` in `toggleStatus` enriched with actor info and user's name in `before`/`after`

`container.ts` — `ApproveTransaction`, `RejectTransaction`, `CompletePayment` now receive `branchRepository` in their deps

---

## 2026-07-22 — Session 17

### Feature: Opening Balance (Daily Snapshots) + Commission Override Audit

**What was requested:**
1. Opening balance — a branch's closing balance at end of each day should become the next day's opening balance, with a stored audit trail per day per branch.
2. Commission override audit — when a branch user overrides the commission on a transaction, log who did it, when, for which transaction, and what the original vs. overridden amounts were.

**Opening Balance — how it works:**
- Every time a ledger entry is written for a branch, `MongoBranchLedgerRepository.addEntry()` now upserts a `BranchDailyBalance` record for today's date (UTC)
- `$setOnInsert` sets `openingBalance = prevBalance` only on the FIRST entry of the day — subsequent entries update only `closingBalance = newBalance`
- This automatically gives a complete daily audit trail of each branch's balance history with zero manual intervention

**Backend changes:**
- `constants.ts` — added `COMMISSION_OVERRIDE: 'COMMISSION_OVERRIDE'` to `AUDIT_ACTIONS`
- `BranchDailyBalance.model.ts` (NEW) — `{ tenantId, branchId, date (YYYY-MM-DD), openingBalance, closingBalance }` with unique compound index `{ tenantId, branchId, date }`
- `IBranchLedgerRepository.ts` — added `getOpeningBalanceForDate()` and `getDailyBalances()` stubs
- `MongoBranchLedgerRepository.ts` — upsert daily snapshot in `addEntry()`; two new methods: `getOpeningBalanceForDate()` (finds most recent record before `fromDate`, returns `closingBalance`) and `getDailyBalances()` (paginated list with date range filter)
- `GetBranchLedger.ts` — when `fromDate` is in filters, fetches `openingBalance` in parallel with ledger entries and includes it in the response's `branch` object
- `GetBranchDailyBalances.ts` (NEW) — use-case that returns branch info + paginated daily balance records
- `BranchController.ts` — added `getBranchDailyBalances` dependency; new `dailyBalances()` method
- `branch.routes.ts` — added `GET /:id/daily-balances` (head_office only)
- `container.ts` — imported and wired `GetBranchDailyBalances`
- `CreateTransaction.ts` — computes `originalType`/`originalValue` before override check; fires a second `COMMISSION_OVERRIDE` audit log entry after transaction creation when override was used

**Mobile changes:**
- `branchApi.ts` — added `getDailyBalances(id, params)`
- `BranchLedgerScreen.tsx` — added date filter bar (From/To inputs + Apply/Clear); added Opening Balance card (shown only when date filter active, reads `data.branch.openingBalance`); added "Daily History" button (bar chart icon) in header right → navigates to `BranchDailyBalances`
- `BranchDailyBalancesScreen.tsx` (NEW) — shows day-by-day opening/closing balance table; date range filter; per-row daily change (+/−) highlighted in green/red; pagination
- `MainNavigator.tsx` — imported `BranchDailyBalancesScreen`; added `BranchDailyBalances` screen to both `BranchStack` and `DashboardStack`

**PENDING_ITEMS.md:** Item #13 (Opening Balance) marked ✅

---

## 2026-07-21 — Session 16

### Feature: Transaction List Pagination + Filter Bug Fixes

**What was requested:** Pagination for transaction list — users could only ever see the first 20 transactions.

**Two silent bugs found and fixed along the way:**
1. `tokenNumber` filter was never passed to the use-case from `TransactionController.list()` — token search UI did nothing
2. Mobile sent `dateFrom`/`dateTo` but backend read `fromDate`/`toDate` — date filter also did nothing

**Approach chosen:** `useInfiniteQuery` (TanStack Query v5, already installed) — proper tool for paginated lists. Accumulation, cache, and reset-on-filter-change handled automatically.

**Backend — `TransactionController.ts`:**
- Added `tokenNumber`, `minAmount`, `maxAmount` to destructured `req.query` params and passed through to `getTransactions.execute()` filters
- No repository or use-case changes needed — both already supported these params

**Mobile — `TransactionListScreen.tsx`:**
- Replaced `useQuery` with `useInfiniteQuery`
- Separated `activeFilters` state (last applied, drives query key) from local editing state (`tokenSearch`, `startDate`, `endDate`, `statusFilter`)
- `applyFilters()` now sets `activeFilters` with correct `fromDate`/`toDate` keys (bug fix) — changing `activeFilters` auto-resets infinite query to page 1
- `clearFilters()` resets `activeFilters` to `{}` — also resets to page 1
- `ListHeaderComponent` shows `"X of Y transactions"` count when total > 0
- `ListFooterComponent` shows Load More button (`"Load More (X of Y)"`) when `hasNextPage`, or a spinner when `isFetchingNextPage`
- Pull-to-refresh still works — `RefreshControl` uses `isFetching && !isFetchingNextPage` to avoid spinner during Load More
- Filter UI (token input, date range, status chips, Apply/Clear) unchanged

---

## 2026-07-21 — Session 15

### Feature: Super Admin — Browse Company Staff & Manage Devices

**What was requested:** Super admin should be able to (1) view all branches and staff of each company, (2) manage device IDs for any user in any company, and (3) manage their own device whitelist.

**Why existing code couldn't be reused:**
- `user.routes.ts` has a global `router.use(authorize(ROLES.HEAD_OFFICE))` that blocks super admin from every user endpoint
- All existing device methods scope to `req.user.tenantId` — super admin's tenant is `system`, which doesn't match company users

**Solution:** All new functionality routed under `/api/v1/tenants/:id/...` which super admin already owns.

**Backend changes:**

- `TenantController.ts` — added `branchRepository` and `userRepository` to constructor; 5 new methods: `listTenantBranches`, `listTenantUsers`, `listUserDevices`, `addUserDevice`, `removeUserDevice`
- `tenant.routes.ts` — 5 new routes (all super_admin only via existing global authorize):
  - `GET /tenants/:id/branches`
  - `GET /tenants/:id/users`
  - `GET /:tenantId/users/:userId/devices`
  - `POST /:tenantId/users/:userId/devices`
  - `DELETE /:tenantId/users/:userId/devices/:deviceId`
- `container.ts` — added `branchRepository` and `userRepository` to `TenantController` constructor

**Mobile changes:**

- `tenantApi.ts` — added `listBranches`, `listTenantUsers`, `listUserDevices`, `addUserDevice`, `removeUserDevice`
- `TenantDetailScreen.tsx` — added "View Staff & Devices" button in ACTIONS card → navigates to `TenantStaffScreen`
- `TenantStaffScreen.tsx` (NEW) — lists all users of a company (head_office first, then branch staff); each row has role badge, username, last login; device icon → navigates to `UserDevices` screen with `crossTenantId`
- `UserDevicesScreen.tsx` — added optional `crossTenantId` route param; when present, calls `tenantApi.*UserDevice*` instead of `userApi.*Device*`; query key includes `crossTenantId` to avoid cache collision between different company's user lists
- `TenantListScreen.tsx` — shield icon in header right → `UserDevices` screen with super admin's own `userId` and `tenantId` (allows super admin to manage their own device whitelist)
- `MainNavigator.tsx` — added `TenantStaffScreen` and `UserDevicesScreen` to `TenantStack`

**Navigation flow:**
```
Super Admin — company staff:
  TenantListScreen → TenantDetailScreen → "View Staff & Devices" → TenantStaffScreen → UserDevicesScreen (crossTenantId = company's tenantId)

Super Admin — own devices:
  TenantListScreen [shield icon in header] → UserDevicesScreen (crossTenantId = system tenantId, own userId)
```

---

### Feature: Commission Configuration from Super Admin Level (also completed this session)

The linter auto-wired this while working on the above feature.

- Backend: `PATCH /tenants/:id/commission` (super_admin only) — `TenantController.updateCommission()` updates `settings.commission` via `tenantRepository.update()`; schema `updateTenantCommission` was already in `schemas.ts`
- Mobile: `tenantApi.updateCommission()` added; `TenantDetailScreen.tsx` now shows current commission in COMPANY DETAILS card and has "Edit Commission" button → modal with Flat/Percentage toggle + value input

This resolves Item #5 from the 2026-07-10 pending list.

---

## 2026-07-12 — Session 14

### Feature: Super Admin — Edit Branch Limit

**What was requested:** After a company pays extra, super admin should be able to increase (or decrease) the branch limit for that company.

**What was built:**

**Backend:**
- New use-case `UpdateTenantBranchLimit.ts` — fetches tenant (404 if not found), counts current non-head-office branches, throws `BusinessRuleError` if new limit < current count, then updates `tenant.branchLimit`
- New Joi schema `updateTenantBranchLimit` in `schemas.ts` — integer, min 1, max 9999, required
- New method `updateBranchLimit()` in `TenantController.ts` + wired to constructor
- New route `PATCH /api/v1/tenants/:id/branch-limit` in `tenant.routes.ts`
- `container.ts` — imports + instantiates `UpdateTenantBranchLimit`, passes to `TenantController`

**Mobile:**
- `tenantApi.ts` — added `updateBranchLimit(id, branchLimit)`
- `TenantDetailScreen.tsx` — branch limit now shown in COMPANY DETAILS card; new "Edit Branch Limit" button in ACTIONS card opens a modal with a numeric input; validation client-side (min 1, must be integer); server-side error (e.g. can't lower below existing count) shown via Alert; invalidates both `['tenant', id]` and `['tenants']` queries on success

**Key decision:** Cannot set limit lower than the current number of existing branches — enforced on the backend with a clear error message.

---

### Fix: Effective Balance Returns to 0 After Payout Completion (Session 14 continued)

**Problem:** After Mumbai completes a payout, their effective balance stayed permanently at −₹9,000 instead of clearing to 0.

**Root cause:** `payout_completed` debited `balance −9000` AND cleared `committedPayout −9000`. Because both changed by the same amount, `effective = balance − committedPayout` stayed at −9000 forever.

**Correct model (confirmed by user):**
- After approval: actual = 0, effective = −9,000 (committed obligation)
- After completion: actual = −9,000 (cash paid out), effective = 0 (obligation settled)

**Solution — new `payoutCompleted` tracker on Branch:**

Formula changed to: `effective = balance − committedPayout − pendingPayout + payoutCompleted`

When `payout_completed` fires, three fields change atomically:
- `balance −9000` (actual cash out recorded)
- `committedPayout −9000` (commitment cleared)
- `payoutCompleted +9000` (offset so effective returns to 0)

Result: effective = −9000 − 0 − 0 + 9000 = **0** ✓
Ahmedabad unchanged: effective = 10000 − 0 − 0 + 0 = **10000** ✓

**Files changed:**
- `Branch.model.ts` — added `payoutCompleted: Number (default 0)`
- `MongoBranchLedgerRepository.ts` — `payout_completed` now increments `payoutCompleted`; `addEntry()` snapshot uses new formula for `effectiveBalanceBefore/After`
- `GetBranchLedger.ts` — effective balance includes `payoutCompleted`
- `GetDashboard.ts` — returns `payoutCompleted` in branch dashboard response
- `BranchController.ts` — `balanceSummary` effective formula updated
- `MainNavigator.tsx` — `BranchWalletChip` reads `payoutCompleted` and adds to effective formula

---

### Feature: Payout Branch Hidden Until Approval (Session 14 continued)

**Problem:** When Ahmedabad created a transaction to Mumbai, Mumbai's balance immediately showed a `pending_payout` deduction and the transaction appeared in Mumbai's list — before head office had approved anything.

**New behaviour:**
- Payout branch (Mumbai) has zero visibility into a transaction until head office approves it
- No ledger entry, no balance change, no transaction in the list — all until approval
- On approval: `payout_committed` ledger entry is written (first time balance changes), Mumbai gets the notification
- On rejection: Mumbai is untouched (collection branch reversal still happens as before)

**Root cause of "Mumbai sees it immediately":**
1. `CreateTransaction.ts` was writing a `pending_payout` ledger entry to Mumbai on creation
2. `findAll()` query used `$or [collectionBranch, payoutBranch]` with no approval-status filter for the payout side

**Changes made:**
- `CreateTransaction.ts` — Removed the `pending_payout` ledger entry for payout branch entirely
- `ApproveTransaction.ts` — Removed the `pending_payout_reversed` entry (nothing to reverse); `payout_committed` entry + Mumbai notification unchanged
- `RejectTransaction.ts` — Removed the `pending_payout_reversed` entry for payout branch; collection reversal unchanged
- `MongoTransactionRepository.findAll()` — Payout side of `$or` now has `approvalStatus: { $ne: 'pending' }` so branch users cannot see pending transactions where they are the payout branch

**No mobile changes needed** — balance displays, notification handling, and transaction list all behave correctly once the backend is fixed.

---

### Feature: Commission Override + Branch-wise Commission + User Permission (Session 14 continued)

**Three-level commission priority system:**
1. **Runtime override** — branch user with `canOverrideCommission` permission sets a custom commission when creating a transaction
2. **Branch-specific commission** — head office configures a fixed rate per branch (overrides global)
3. **Global tenant commission** — existing fallback from Settings (unchanged)

**Backend changes:**
- `User.model.ts` — Added `permissions: { canOverrideCommission: Boolean (default: false) }`
- `Branch.model.ts` — Added `commissionConfig: { enabled: Boolean, type: flat|percentage, value: Number }`
- `authenticate.ts` — Now selects `permissions` from DB user and attaches as `req.user.permissions`
- `CreateTransaction.ts` — Replaced single-source commission lookup with priority resolution: override → branch config → global
- `TransactionController.ts` — Passes `canOverrideCommission: req.user.permissions?.canOverrideCommission` to use-case
- `schemas.ts` — `createTransaction` allows optional `commissionOverride`; `updateBranch` allows optional `commissionConfig`; `updateUser` allows optional `permissions.canOverrideCommission`

No new API routes — flows through existing PATCH `/branches/:id`, PATCH `/users/:id`, POST `/transactions`.

**Mobile changes:**
- `CreateTransactionScreen.tsx` — When logged-in user has `canOverrideCommission`, shows "OVERRIDE COMMISSION" toggle card. When enabled: type selector + value input. Sends `commissionOverride` only when toggled on
- `EditBranchCommissionScreen.tsx` (NEW) — Head office sets per-branch commission; enable toggle, flat/% type, value input
- `BranchListScreen.tsx` — `pricetag-outline` icon on each non-head-office branch → navigates to EditBranchCommission. Active commission shown inline below row
- `UserListScreen.tsx` — Each branch-role user row shows permission footer: "Commission Override: Allowed/Not allowed" with Grant/Revoke. Calls PATCH /users/:id with `permissions.canOverrideCommission`
- `MainNavigator.tsx` — Added `EditBranchCommission` to BranchStack

---

## 2026-07-10 — Session 13 (Bug Sprint: Audit, Notifications, Branch Toggle)

### Features and fixes implemented this session

**1. SuperAdmin — Reset All Data (Dev Only)**
- New use-case `ResetDevData.ts` — deletes all tenants (except `system`), branches, users (except `super_admin`), transactions, branch_ledger, notifications, audit_logs, idempotency
- Production guard: throws `BusinessRuleError` if `NODE_ENV === 'production'`
- `DELETE /api/v1/tenants/reset-dev-data` declared before `GET /:id` to avoid Express route conflict
- Mobile: modal with inline TextInput requiring "RESET" typed exactly (no `Alert.prompt` — iOS only)

**2. New company name defaulting to "Money Transfer" (Bug Fix)**
- Mongoose schema applied `appName: 'Money Transfer'` default when `branding: {}` was passed
- Fixed in `CreateTenant.ts`: `const resolvedBranding = { appName: name, ...(branding || {}) }` — seeds appName from company name

**3. Dashboard stale after account switch (Bug Fix)**
- React Query cache not cleared on logout — stale data from previous user persisted to next login
- Fixed in `authStore.ts`: `logout()` now calls `queryClient.clear()` before resetting state
- Fixed in `client.ts`: refresh token failure now calls `logout()` (previously only deleted tokens, leaving user on broken main screen)

**4. One-click disable/enable toggle for branches and staff**
- `BranchController.toggleStatus()` — toggles `active` ↔ `inactive`, calls `forceLogoutBranch()` on disable, writes audit log with before/after
- `UserController.toggleStatus()` — same pattern; self-disable guard: throws `ForbiddenError` if `req.params.id === req.user.id`
- `PATCH /branches/:id/status` (head_office only), `PATCH /users/:id/status`
- Mobile: `ban-outline` (red = tap to disable), `checkmark-circle-outline` (green = tap to enable) on BranchListScreen and UserListScreen
- Disabled branches show "DISABLED" badge in red

**5. Disabled branch blocks login (Bug Fix)**
- `Login.ts` only checked user status, not branch status
- Fixed: after credential check, fetches branch and throws `ForbiddenError('Your branch is currently disabled. Contact head office.')` for branch-role users

**6. Double notification badge (Bug Fix)**
- `MainNavigator.tsx` had both `tabBarBadge` (native) and custom `BadgeCount` overlay — both showed simultaneously
- Fixed by removing `tabBarBadge` line; custom `BadgeCount` remains

**7. Notification history empty for head_office/branch (Bug Fix)**
- `SocketNotificationService.notifyRole()` and `notifyBranch()` were emitting to socket rooms but never writing to DB
- Fixed: both methods now fan out to all relevant active users via `UserModel.find()` and persist per-user (fire-and-forget)

**8. Branch limit counting only active branches (Bug Fix)**
- `MongoBranchRepository.countNonHeadOffice()` had `status: 'active'` filter — disabled branches didn't count toward limit, allowing over-limit creation
- Fixed: removed status filter; all non-head_office branches count

**9. AllTime stats showing today's numbers for branch users (Bug Fix)**
- `GetDashboard.ts` was spreading today's `{ fromDate: startOfDay }` into allTimeFilters
- Fixed: `const allTimeFilters = role === ROLES.BRANCH && branchId ? { branchId } : {}`

**10. Transaction audit log completeness**
- `CreateTransaction.ts` — added `collectionBranchId`, `payoutBranchId`, `paymentMethod` to `after`
- `ApproveTransaction.ts` — added `before: { approvalStatus: 'pending' }`
- `RejectTransaction.ts` — added `before: { approvalStatus: 'pending' }`
- `CompletePayment.ts` — added `before: { paymentStatus: 'pending' }`

**11. `withAlpha()` fix in CreateTransactionScreen**
- `theme.colors.primary + '15'` replaced with `withAlpha(theme.colors.primary, 0.08)` per AGENTS.md Rule 7

---

## 2026-07-10 — Session 12

### Feature: Report Fixes + Login Activity + Transaction Limits + PDF/CSV Export

#### A1 — ExportReport `/100` bug fixed
`ExportReport.ts` was dividing `amount` and `commissionAmount` by 100, treating rupees as paisa. Removed both divisions — values are now exported directly in rupees.

#### A2 — Report `type` param now works
`GetReports.ts` now produces `dailyBreakdown` (grouped by YYYY-MM-DD) when `type=daily`, and `monthlyBreakdown` (grouped by YYYY-MM) when `type=monthly`. `ReportsScreen.tsx` renders the appropriate breakdown section below the summary card.

#### A3 — Commission by Branch in mobile Reports
`ReportsScreen.tsx` now calls `transactionApi.getCommissionSummary()` (head_office only) and shows a "Commission by Branch" section with per-branch commission totals.

#### Login Activity Report (new feature)
**Backend:**
- New use-case `GetLoginReport.ts` — queries `audit_logs` for `action=LOGIN, module=Auth`, populates user name/role/branchId, supports date range + userId + branchId filters, returns up to 500 records
- Added `loginReport` method to `ReportController.ts`
- Wired into `container.ts`
- New route: `GET /api/v1/reports/login-activity` (head_office + branch)

**Mobile:**
- New screen `LoginActivityScreen.tsx` — date filter, FlatList with user icon, name, role badge, @username, login time, IP address
- Added `getLoginActivity()` to `reportApi.ts`
- Screen added to ReportsStack in `MainNavigator.tsx`
- "Activity Log" card added to bottom of `ReportsScreen.tsx` (head_office only)

#### Transaction Limits (new feature)
**Backend:**
- Added `transactionLimits: { maxAmountPerTransaction, dailyLimitPerBranch }` to `Tenant.model.ts` settings (0 = no limit)
- Updated `schemas.ts` Joi validator to allow the new settings fields
- Added `sumTodayByBranch(tenantId, branchId)` to `ITransactionRepository` port and `MongoTransactionRepository.ts`
- `CreateTransaction.ts` now checks both limits before proceeding; daily check is skipped when limit is 0

**Mobile:**
- Added "TRANSACTION LIMITS" section to `EditSettingsScreen.tsx` with two numeric inputs

#### PDF + CSV Export (new feature)
**Backend:**
- `pdfkit` already installed; added `@types/pdfkit`
- `ExportReport.ts` now accepts `format: 'excel' | 'pdf' | 'csv'` and returns `{ buffer, contentType, filename }`
- CSV: manual RFC 4180 build with UTF-8 BOM; PDF: A4 landscape, 9-column table, page-break at y>520, capped at 500 rows; Excel: existing logic preserved + added Final Amount column
- `ReportController.ts` reads `?format=` param, sets Content-Type/Content-Disposition dynamically

**Mobile:**
- `downloadReport()` in `reportApi.ts` — reads access token from SecureStore, downloads via `expo-file-system`, opens native share sheet via `expo-sharing`
- Three export buttons (Excel, PDF, CSV) added to `ReportsScreen.tsx` with shared loading state

---

## 2026-07-09 — Session 11

### Bug Audit: Comprehensive Backend + Mobile Fixes

**What:** Full codebase audit finding and fixing all bugs across the backend and mobile app.

**Backend fixes:**

**Bug 1 — Login.ts: broken login time restriction (Critical)**
`user` from `.lean()` has no methods. `!user.isWithinLoginHours` evaluated a function reference (always truthy → `!truthy = false`), so restriction was never enforced. Fixed by replacing the broken ternary with `if (!this._withinHours(user, hhmm)) { throw new ForbiddenError(...); }`.
File: `backend/src/application/use-cases/auth/Login.ts`

**Bug 2 — CompletePayment: double-payment race condition (Critical)**
`completePayment` had no atomic pre-condition. Two concurrent requests could both complete the same transaction. Fixed by adding `paymentStatus: PAYMENT_STATUS.PENDING` to the `findOneAndUpdate` filter and checking for null result (returns null if already completed).
Files: `backend/src/infrastructure/db/repositories/MongoTransactionRepository.ts`, `backend/src/application/use-cases/transaction/CompletePayment.ts`

**Bug 3 — ResetDevData: no production guard (Security)**
The dev-only reset endpoint had no environment check. Fixed by throwing `BusinessRuleError` if `NODE_ENV === 'production'`.
File: `backend/src/application/use-cases/superAdmin/ResetDevData.ts`

**Mobile fixes:**

**Bug 4 — ReportsScreen: amounts divided by 100 (Critical)**
`fmt()` was doing `(n || 0) / 100` assuming paisa storage. Amounts are in rupees. Fixed to `(n || 0).toLocaleString('en-IN')`.
File: `mobile/src/features/reports/screens/ReportsScreen.tsx`

**Bug 5 — BranchLedgerScreen: missing pending events in EVENT_META (Major)**
`pending_payout` and `pending_payout_reversed` were missing, like MyStatementScreen had in the prior session. Fixed with same entries (amber color, correct labels, `isActual: false`).
File: `mobile/src/features/branch/screens/BranchLedgerScreen.tsx`

**Bug 6 — ReportsScreen: hardcoded paddingBottom (Minor)**
`paddingBottom: 100` replaced with `tabBarHeight + theme.spacing.md` using `useBottomTabBarHeight()`.

**Bug 7 — String concat for colors (Minor)**
Multiple instances of `theme.colors.X + '40'` / `+ '15'` fixed to use `withAlpha()`.

**Bug 8 — Dead file with broken import (Minor)**
`CustomerSearchPicker.tsx` imported the deleted `customerApi`. File deleted.

**Bug 9 — KAV undefined on Android (Multiple screens)**
`CompleteByTokenScreen`, `CompletePaymentScreen`, `CreateHeadOfficeScreen`, `EditSettingsScreen`, `NotesScreen` all had `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. Fixed to `'height'` for Android.

---

### Bug Fix: Keyboard Covers Inputs on Multiple Screens

**User reported:** When tapping the rejection reason input on TransactionDetailScreen, the keyboard opens but the field is completely hidden.

**Root cause:** `TransactionDetailScreen` had NO `KeyboardAvoidingView` at all. The rejection input appears conditionally at the very bottom of a long `ScrollView` with multiple cards above it.

**Fixes applied to 6 screens:**

**1. TransactionDetailScreen.tsx (Critical fix)**
- Added `KeyboardAvoidingView` wrapping the root `ScrollView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
- Added `scrollRef` on the ScrollView
- "Reject Transaction" button now also calls `scrollRef.current?.scrollToEnd({ animated: true })` after `setShowRejectInput(true)` (150ms delay) so the newly rendered input scrolls into view before the user taps it

**2. TenantListScreen.tsx Modal (Severe fix)**
- Changed Modal's KAV `behavior` from `Platform.OS === 'ios' ? 'padding' : 'height'` to `"padding"` for both platforms
- `'height'` inside a Modal is unreliable on Android because the Modal renders in its own separate window

**3. CreateTransactionScreen.tsx (Moderate fix)**
- Added `scrollRef` on the ScrollView
- Remarks multiline input gets `onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}` so the field scrolls into view when focused

**4. RegisterCompanyScreen.tsx (Moderate fix)**
- Same scrollToEnd pattern on the Address multiline input (last field)

**5. CreateBranchScreen.tsx (Minor fix)**
- Same scrollToEnd pattern on City and State inputs (two last fields)

**6. CreateUserScreen.tsx (Minor fix)**
- Same scrollToEnd pattern on Password input (last text input before branch chips)

---

## 2026-07-09 — Session 10 (continued)

### Feature: SuperAdmin "Reset All Data (Dev Only)"

**What:** Added a dev-only reset option that wipes all data except super admin credentials.

**Backend:**
- New use-case: `backend/src/application/use-cases/superAdmin/ResetDevData.ts`
  - Deletes: tenants (except `system`), branches, users (except `super_admin`), transactions, branch_ledger, notifications, audit_logs, idempotency
  - Returns deletion counts per collection
- New route: `DELETE /api/v1/tenants/reset-dev-data` (super_admin only, placed before `/:id` to avoid route conflict)
- TenantController: added `resetDev()` method wired to the use-case
- container.ts: `ResetDevData` instantiated and injected into TenantController

**Mobile:**
- `tenantApi.ts`: added `resetDevData()` calling `DELETE /tenants/reset-dev-data`
- `TenantListScreen.tsx`: rewrote to add "Reset All Data (Dev Only)" button at bottom of list
  - Tap opens a modal with warning text
  - User must type exactly "RESET" in an inline TextInput (not Alert.prompt — iOS only per AGENTS.md)
  - Confirm button enabled only when text matches; calls mutation on press
  - On success: invalidates tenant query, shows Alert with deletion summary
  - On error: shows Alert with error message

**Route ordering note:** `DELETE /tenants/reset-dev-data` MUST be declared before `GET /tenants/:id` in the router, otherwise Express matches `reset-dev-data` as the `:id` param. This is already done correctly.

---

## 2026-07-09 — Session 9 (continued)

### Bug Fix: Payout Branch Sees No Transactions / Empty Statement

**Symptoms reported:**
- Payout branch user sees effective balance in minus (correct) but no entries in MyStatementScreen
- Payout branch transaction list was showing no transactions

**Root causes found and fixed:**

**Bug 1 — Transaction list (FIXED):** `TransactionController.list()` was taking `branchId` only from `req.query`. Since the mobile sends no explicit `branchId` param (it relies on the server knowing who the user is), a branch user got ALL tenant transactions or NONE depending on the query. Fixed by forcing `branchId = req.user.branchId` for branch-role users, regardless of query params.
```typescript
const effectiveBranchId = req.user.role === 'branch' ? req.user.branchId : (branchId || undefined);
```
File: `backend/src/interfaces/http/controllers/TransactionController.ts`

**Bug 2 — GetBranchLedger effectiveBalance (ALREADY FIXED by parallel agent):** Was computing `effectiveBalance = balance - committedPayout` without `pendingPayout`. Already corrected to `balance - committedPayout - pendingPayout`.
File: `backend/src/application/use-cases/branch/GetBranchLedger.ts`

**Bug 3 — MyStatementScreen EVENT_META (ALREADY FIXED by parallel agent):** `pending_payout` and `pending_payout_reversed` events were missing from EVENT_META. Entries would render with raw event name as label and fallback icon. Now properly labeled with "Pending Payout Reserved" / "Pending Cleared", correct amber/pending color (`theme.colors.statusPending`), and `isActual: false` to distinguish from actual balance changes.
File: `mobile/src/features/branch/screens/MyStatementScreen.tsx`

**How to verify:** Restart backend → create a new transaction from any collection branch to the payout branch → log in as the payout branch user → tap the wallet chip → should see "Pending Payout Reserved" entry. Pull-to-refresh if the screen shows empty on first open.

---

## 2026-07-09 — Session 9

### Feature: Remove Phone Numbers + Sender/Receiver from Entire App

**What:** User requested removal of all phone number fields and the entire sender/receiver concept (with its Customer feature) from both frontend and backend.

**Decisions made:**
- Phone removed from User, Branch, Tenant (contactPhone) schemas/entities/use-cases/forms
- Sender/receiver concept removed entirely — Customer model, repository, use-cases, controller, and routes all deleted
- `senderId`/`receiverId` removed from Transaction model — transactions no longer link to customers
- Mobile: Customers tab removed from navigation; CustomerListScreen and CreateCustomerScreen deleted; customer feature directory deleted
- CreateTransactionScreen now only asks for payout branch, amount, payment method, and optional photo/remarks
- TransactionDetailScreen, TransactionListScreen, CompleteByTokenScreen no longer show sender/receiver names or phones

**Backend files changed:**
- `User.model.ts` — removed `phone` field
- `Branch.model.ts` — removed `phone` field
- `Transaction.model.ts` — removed `senderId`, `receiverId` fields
- `User.ts` entity — removed `phone` property
- `Branch.ts` entity — removed `phone` property
- `CreateUser.ts` — removed `phone` from params + repo call
- `CreateBranch.ts` — removed `phone` from params + repo call
- `CreateTransaction.ts` — removed `customerRepository` dep, `senderId`/`receiverId` params, customer lookups
- `MongoTransactionRepository.ts` — removed `.populate('senderId'/'receiverId')` calls
- `ExportReport.ts` — removed Sender/Receiver Excel columns
- `TenantController.ts` — removed `phone` from createHeadOffice
- `schemas.ts` — removed phone from all schemas; removed createCustomer/updateCustomer schemas; removed senderId/receiverId from createTransaction; removed contactPhone from createTenant
- `container.ts` — removed all Customer imports, use-cases, controller, customerRepository
- `app.ts` — removed customerRoutes
- `seed-super-admin.js` — removed contactPhone + phone from upserts

**Backend files deleted:**
- `Customer.model.ts`, `MongoCustomerRepository.ts`, `ICustomerRepository.ts`
- `CreateCustomer.ts`, `UpdateCustomer.ts`, `GetCustomers.ts`, `SearchCustomers.ts`
- `CustomerController.ts`, `customer.routes.ts`

**Mobile files changed:**
- `CreateBranchScreen.tsx` — removed phone input + validation; keyboard chain: contactPerson → city
- `CreateUserScreen.tsx` — removed phone input + validation; keyboard chain: password → submit
- `CreateHeadOfficeScreen.tsx` — removed phone input + validation
- `CreateTransactionScreen.tsx` — removed customerApi import, senderName/senderPhone/receiverName/receiverPhone form fields, findOrCreate function, SENDER/RECEIVER DETAILS cards
- `TransactionDetailScreen.tsx` — removed Sender/Receiver InfoRows
- `TransactionListScreen.tsx` — removed sender→receiver name display
- `CompleteByTokenScreen.tsx` — removed Receiver/Sender rows; updated success alert message
- `MainNavigator.tsx` — removed CustomerListScreen/CreateCustomerScreen imports; removed CustomerStack; removed Customers tab

**Mobile directories deleted:**
- `mobile/src/features/customer/` (entire directory)

---

## 2026-07-09 — Session 8

### Topic: Mobile UI Overhaul — Responsiveness, UX, Platform Fixes

**What:** UI was breaking on both old Android (small screens, low RAM) and new devices (Dynamic Island / notch / bottom gesture bar). User also requested cleaner, more consistent UI.

**Root causes identified:**
1. `paddingBottom: 100` hardcoded throughout — wrong on all devices except ~one specific phone
2. `KeyboardAvoidingView` with `behavior={undefined}` on Android — keyboard covers forms entirely
3. No responsive typography — h1 at 28px overflows on 320px screens; accessibility large font blows up card layouts
4. `Alert.prompt` used for reject reason — silently does nothing on Android
5. `fontFamily: 'monospace'` on LoginScreen — invalid on iOS, silent fallback to default font
6. Hex color opacity via string concat (`theme.colors.x + '20'`) — fragile, breaks with non-hex tenant colors
7. Raw `TextInput` in filter section bypassed AppInput styling
8. FlatList missing all performance props — jank on old devices
9. No shared badge component — inconsistent sizes (16px vs 18px) across screens

**Decisions made:**
- `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` replaces all hardcoded paddingBottom
- KAV behavior: `'padding'` iOS / `'height'` Android — documented in AGENTS.md as a hard rule
- `TenantThemeProvider` now uses `useWindowDimensions` to scale fonts 90% on screens <375px
- `AppInput` converted to `forwardRef` — all form screens must wire keyboard nav chains
- `Alert.prompt` replaced with inline input pattern everywhere — cross-platform
- `withAlpha(hex, alpha)` utility created at `utils/colors.ts`
- `BadgeCount` component created at `shared/components/BadgeCount.tsx`
- All rules written to `mobile/AGENTS.md` so future sessions inherit them automatically

**Files created (new):**
- `mobile/src/utils/colors.ts`
- `mobile/src/shared/components/BadgeCount.tsx`

**Files modified (foundations — completed this session):**
- `mobile/src/theme/TenantThemeProvider.tsx` — responsive scaling
- `mobile/src/shared/components/AppInput.tsx` — forwardRef + keyboard nav props
- `mobile/src/features/auth/screens/LoginScreen.tsx` — KAV fix, keyboard chain, monospace fix
- `mobile/AGENTS.md` — full UI coding rules
- `CLAUDE.md` — updated current status

**Files completed this session (screen fixes):**
- `TransactionListScreen.tsx` — AppInput filters, FlatList perf, paddingBottom ✅
- `TransactionDetailScreen.tsx` — inline reject input (cross-platform), padding ✅
- `CreateTransactionScreen.tsx` — KAV fix, paddingBottom ✅
- `BranchListScreen.tsx` — FlatList perf, withAlpha, paddingBottom ✅
- `BranchLedgerScreen.tsx` — FlatList perf, withAlpha, paddingBottom ✅
- `UserListScreen.tsx` — FlatList perf, withAlpha, paddingBottom ✅
- `CustomerListScreen.tsx` — AppInput search, FlatList perf, withAlpha, paddingBottom ✅
- `NotificationsScreen.tsx` — FlatList perf, withAlpha, paddingBottom ✅
- `DashboardScreen.tsx` — BadgeCount, allowFontScaling, theme.spacing tokens ✅
- `CreateBranchScreen.tsx` — KAV fix, keyboard nav chain (name→code→contact→phone→city→state→submit) ✅
- `CreateUserScreen.tsx` — KAV fix, keyboard nav chain (name→username→password→phone→submit) ✅
- `RegisterCompanyScreen.tsx` — KAV fix, keyboard nav chain (name→slug→branchLimit→address→submit) ✅

**Session 8 UI overhaul: COMPLETE. All screens fixed.**

---

### Feature: Unified Error Handling (same session continuation)

**Problem:** API errors were not reaching the user in a readable form.
- Validation errors showed "Validation failed" — the `details` array with field-level messages was ignored entirely
- Network errors showed raw Axios messages: "Network Error", "timeout of 15000ms exceeded"
- 21 screens each duplicated the fragile extraction chain `(error as any)?.response?.data?.error?.message || (error as any)?.message`
- LoginScreen leaked the backend URL into the error display (debug code in UI)
- Joi messages used technical syntax: `"name" is not allowed to be empty`

**Decisions:**
- Single `parseApiError(error)` utility handles all cases centrally
- Backend now sends human-readable Joi messages via `humanizeJoiMessage()` in the validate middleware — no schema changes required
- `ErrorMessage` component now renders multi-line messages (one bullet per validation field error)
- Validation `message` field on the backend now also contains the joined detail messages (not just "Validation failed") — so even clients that don't read `details` get the full message

**Files created:**
- `mobile/src/utils/apiError.ts` — `parseApiError(error): string | null`

**Files modified:**
- `backend/src/interfaces/http/validators/schemas.ts` — `humanizeJoiMessage()` + updated validate middleware
- `mobile/src/shared/components/ErrorMessage.tsx` — multi-line support, `message` prop accepts `null`
- `mobile/src/features/auth/screens/LoginScreen.tsx` — removed URL debug leak, uses `parseApiError`
- All 21 screens with error extraction — replaced with `parseApiError()`

---

### Feature: Wallet Balance Header Chip + Bank Statement (same session)

**What:** Balance chip in Dashboard header showing live actual + effective balance for branch, and net total for head office. Tapping opens a bank statement.

**Branch role chip:** `ACTUAL ₹X | EFF. ₹Y` — tap → `MyStatementScreen` (own branch's bank statement)

**Head office chip:** `NET BALANCE ₹X` with "Balanced ✓" or "Imbalanced !" — tap → `BalanceSummaryScreen` (all branches listed with per-branch actual + effective + net total row)

**Bug fixed:** `DashboardScreen` was showing `balance / 100` (treating rupees as paisa). Amounts are stored in rupees throughout the system. Fixed to `toLocaleString('en-IN')`.

**Backend files changed:**
- `BranchController.ts` — Added `myLedger()` (uses `req.user.branchId`) and `balanceSummary()` (all active branches + totals)
- `branch.routes.ts` — Added `GET /my-ledger` (branch role) and `GET /balance-summary` (head_office role)

**Mobile files changed:**
- `branchApi.ts` — Added `getMyLedger()`, `getBalanceSummary()`
- `MyStatementScreen.tsx` (NEW) — Branch's own bank statement
- `BalanceSummaryScreen.tsx` (NEW) — Head office: all branches + net total, each row tappable to full ledger
- `MainNavigator.tsx` — Dashboard tab now uses `DashboardStack`; `DashboardHeaderRight` shows wallet chip + bell; `MyStatement`/`BalanceSummary`/`BranchLedger` added to DashboardStack
- `DashboardScreen.tsx` — Removed `useLayoutEffect` bell (moved to navigator); fixed balance `/100` bug

---

### Feature: Commission Model (same session continuation)

**What:** Commission chip in Dashboard header for both branch and head office users. Shows commission earned. Tapping opens a commission breakdown screen.

**Commission ownership rule:** Commission belongs to the collection branch — if they collect ₹1000 and payout is ₹900, the ₹100 commission stays with the collection branch. Amounts stored in rupees (not paisa) throughout.

**Branch chip:** `COMM. ₹X` (own commission total) — tap → `CommissionDetailScreen` (own transactions; COLLECTED | COMMISSION | PAYOUT per row; totals at top)

**Head office chip:** `COMM. ₹X` (grand total across all branches) — tap → `CommissionSummaryScreen` (per-branch breakdown with progress bars showing share; grand total at top; each row tappable to that branch's detail)

**Backend files changed:**
- `ITransactionRepository.ts` — Added abstract `getCommissionSummary()` and `getCommissionDetail()` methods
- `MongoTransactionRepository.ts` — Implemented both via MongoDB aggregations; `getCommissionSummary` groups by `collectionBranchId` with `$lookup` for branch name, sorts by commission desc; `getCommissionDetail` is paginated with totals
- `TransactionController.ts` — Added `commissionSummary()` (branch auto-filters to own branchId) and `commissionDetail()` (branch forced to own, HO can pass `?branchId=`); wired `transactionRepository` into constructor
- `transaction.routes.ts` — Added `GET /commission-summary` and `GET /commission-detail` before `/:id`
- `container.ts` — Added `transactionRepository` to `TransactionController` constructor call

**Mobile files changed:**
- `transactionApi.ts` — Added `getCommissionSummary()` and `getCommissionDetail()`
- `CommissionDetailScreen.tsx` (NEW) — Per-transaction list; 3-column amount cards (COLLECTED/COMMISSION/PAYOUT); collection→payout branch display; paginated with Load More
- `CommissionSummaryScreen.tsx` (NEW) — HO-only: per-branch rows with progress bar, share %, txn count; grand total card at top; each row navigates to CommissionDetail
- `MainNavigator.tsx` — Added `CommissionChip` component (same query key `['commission-summary']` shared between chip + screen); added `CommissionDetail` to DashboardStack for both roles; added `CommissionSummary` to DashboardStack for HO; `DashboardHeaderRight` renders wallet chip + commission chip + bell

---

### Bug Fix: Dashboard Showing 0 + Mumbai Payout Balance (2026-07-09 continuation)

**Problem 1 — Head office dashboard always showed 0:**
`MongoTransactionRepository.getDashboardStats()`, `getCommissionSummary()`, and `getCommissionDetail()` all use `TransactionModel.aggregate()`. MongoDB aggregation does NOT auto-cast strings to ObjectIds (unlike Mongoose's `find()`). The `tenantId` (and `branchId`) from the JWT token are strings, so the `$match` found 0 documents.

**Fix:** Added `new mongoose.Types.ObjectId()` wrapping for `tenantId` and `branchId` in all three aggregation match stages. Also added `import mongoose from 'mongoose'` which was missing.

**Problem 2 — Mumbai payout branch showed ₹0, not pending outflow:**
Payout branch balance was only updated on APPROVAL (`payout_committed`) and COMPLETION (`payout_completed`). So while Ahmedabad showed +₹18,000 immediately on transaction creation, Mumbai showed ₹0 because the transactions were still PENDING.

**Fix:** Added `pendingPayout` field to Branch model. New ledger events:
- `pending_payout` — written on `CreateTransaction` to reserve the payout branch (pendingPayout +finalAmount)
- `pending_payout_reversed` — written on `ApproveTransaction` (clears pending before committing) and `RejectTransaction` (clears pending on cancel)

Effective balance is now: `balance − committedPayout − pendingPayout`

**Problem 3 — EFF. chip showed no sign:**
`Math.abs(effective)` was used without a `−` prefix when negative.
**Fix:** Added `{effective < 0 ? '−' : effective > 0 ? '+' : ''}` prefix.

**Files modified (backend):**
- `MongoTransactionRepository.ts` — ObjectId cast fix in getDashboardStats, getCommissionSummary, getCommissionDetail; added mongoose import
- `Branch.model.ts` — Added `pendingPayout` field
- `BranchLedger.model.ts` — Added `pending_debit`, `pending_reversed` to type enum; `pending_payout`, `pending_payout_reversed` to event enum
- `MongoBranchLedgerRepository.ts` — Added pending events to buildIncrement; effectiveBalance now includes pendingPayout
- `CreateTransaction.ts` — Added `pending_payout` ledger entry for payout branch
- `ApproveTransaction.ts` — Added `pending_payout_reversed` before existing `payout_committed` entry
- `RejectTransaction.ts` — Added `pending_payout_reversed` for payout branch
- `GetDashboard.ts` — Returns `pendingPayout` in branch dashboard response
- `BranchController.ts` — balanceSummary includes pendingPayout; effectiveBalance = actual − committed − pending; totals include pending

**Files modified (mobile):**
- `MainNavigator.tsx` — BranchWalletChip reads pendingPayout; EFF = actual − committed − pending; shows sign
- `DashboardScreen.tsx` — Branch balance card shows pendingPayout (orange) and committedPayout (red) separately
- `BalanceSummaryScreen.tsx` — Per-branch pendingPayout row; totals pending row

---

> One entry per session. Most recent at top.
> Format: date, what was discussed, what was decided, why.

---

## 2026-07-04 — Session 7

### Feature: Device Whitelist Security

**What:** Only pre-authorized devices can log in to a user's account.

**Rules:**
- `super_admin` is exempt — no device check
- First login from any account → device auto-registered (no block, but head_office notified)
- Subsequent logins from unknown device → `DEVICE_NOT_AUTHORIZED` (HTTP 401)
- Head office can manage devices per user: list, add manually, remove

**Flow:**
1. Mobile generates a stable UUID stored in `expo-secure-store` on first launch
2. UUID + device name sent with every login request
3. Backend checks `user.allowedDevices[]` — empty = auto-register, match = allow, no match = block
4. Head office sees device icon on each user row, taps to manage devices
5. Blocked user sees their device ID on the login error screen so they can share it with head office

**Backend files changed:**
- `domain/errors/index.ts` — Added `DeviceNotAuthorizedError` (HTTP 401, code `DEVICE_NOT_AUTHORIZED`)
- `config/constants.ts` — Added `DEVICE_REGISTERED` to `NOTIFICATION_TYPE`
- `infrastructure/db/models/User.model.ts` — Added `allowedDevices: [{ deviceId, deviceName, registeredAt }]`
- `application/ports/IUserRepository.ts` — Added `addDevice`, `removeDevice`, `getDevices` abstract methods
- `infrastructure/db/repositories/MongoUserRepository.ts` — Implemented `addDevice` ($push), `removeDevice` ($pull), `getDevices`
- `application/use-cases/auth/Login.ts` — Device check after credential verification; auto-register on first login + notify head_office; block with `DeviceNotAuthorizedError` if unknown device
- `interfaces/http/controllers/UserController.ts` — Added `listDevices`, `addDevice`, `removeDevice` actions
- `interfaces/http/routes/user.routes.ts` — Added `GET/POST /:id/devices` and `DELETE /:id/devices/:deviceId` (placed before `GET /:id` to avoid route conflict)
- `interfaces/http/validators/schemas.ts` — Updated `login` schema to accept optional `deviceId` + `deviceName`; added `addDevice` schema
- `container.ts` — Added `notificationService` to `loginUseCase` constructor

**Mobile files changed:**
- `utils/deviceId.ts` — NEW: `getOrCreateDeviceId()` (UUID stored in SecureStore) + `getDeviceName()` (Constants.deviceName fallback)
- `features/auth/screens/LoginScreen.tsx` — Loads device ID on mount, sends with login, shows dedicated "Device Not Authorized" error card with device ID visible
- `features/user/api/userApi.ts` — Added `listDevices`, `addDevice`, `removeDevice` API calls
- `features/user/screens/UserDevicesScreen.tsx` — NEW: List devices, remove existing, add manually by pasting device ID
- `features/user/screens/UserListScreen.tsx` — Added phone icon per user row → navigates to UserDevicesScreen
- `navigation/MainNavigator.tsx` — Added `UserDevicesScreen` to UserStack

---

## 2026-07-04 — Session 6

### Feature: OTP + SMS Removal
User explicitly removed OTP and SMS from the entire application.
- Deleted: `SendOtp.ts`, `Msg91SmsService.ts`, `MockSmsService.ts`, `ISmsService.ts`
- `CompletePayment.ts` simplified — just checks `approved + pending`, then completes
- Mobile: OTP input removed from CompletePaymentScreen, "Send OTP" button gone from TransactionDetailScreen
- `canComplete` now = `approvalStatus === approved && paymentStatus === pending`
- Settings: OTP Expiry, OTP for Payout, SMS Notifications removed from UI and validator schema
- MSG91 env vars removed from `env.ts`

### Feature: Branch Balance & Ledger System
**What:** Every branch has a running balance + bank statement-style ledger.

**Balance rules:**
- Transaction CREATED → Collection branch (AHM) +amount (they collected cash)
- Transaction APPROVED → Payout branch (MUM) −finalAmount (committed to pay out)
- Transaction REJECTED → Collection branch (AHM) −amount (reversal, return cash to sender)
- Transaction COMPLETED → no balance change (already settled at approval)

**New backend files:**
- `BranchLedger.model.ts` — MongoDB collection `branch_ledger`
- `IBranchLedgerRepository.ts` — port
- `MongoBranchLedgerRepository.ts` — atomic `$inc` on branch.balance + creates ledger entry
- `GetBranchLedger.ts` — use case, returns branch info + paginated ledger + total credits/debits

**Updated backend:**
- `Branch.model.ts` — added `balance: Number default 0`
- `CreateTransaction.ts` — credits collection branch
- `ApproveTransaction.ts` — debits payout branch
- `RejectTransaction.ts` — debits collection branch (reversal) with rejection reason in description
- `BranchController.ts` — added `ledger()` action
- `branch.routes.ts` — added `GET /:id/ledger` (head_office only)
- `container.ts` — wired `branchLedgerRepository`, `getBranchLedger` use case

**New mobile files:**
- `BranchLedgerScreen.tsx` — bank statement UI, shows balance, total credits/debits, paginated entries

**Updated mobile:**
- `branchApi.ts` — added `getLedger()`
- `BranchListScreen.tsx` — shows balance on each branch card (green/red), tap to open ledger
- `MainNavigator.tsx` — added BranchLedger screen to BranchStack

---

## 2026-07-04 — Session 5

### Feature: Payment Method + Token Photo Upload (Cloudinary)

**Point 3 — Payment Method:** Cash / NEFT / RTGS / Bank Transfer selector on new transaction.

**Point 4 — Token Photos:**
- Collection branch uploads slip photo when creating transaction
- Payout branch uploads the token photo the customer brings when completing payment
- Both photos stored as Cloudinary URLs, shown in transaction detail

**Cloudinary setup:** `mobile/src/config/cloudinary.ts` has placeholder values — user must fill in `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` once they have their account.

**Also fixed:** `PAYMENT_STATUS.OTP_SENT` was missing from constants — `otp_sent` was never being saved to DB, breaking the complete payment flow. Added to constants.

### Files Changed

**Backend:**
- `config/constants.ts` — Added `PAYMENT_METHOD` enum; fixed `PAYMENT_STATUS` by adding `OTP_SENT: 'otp_sent'`
- `Transaction.model.ts` — Added `paymentMethod`, `collectionPhotoUrl`, `payoutPhotoUrl` fields
- `CreateTransaction.ts` — Accepts `paymentMethod` and `collectionPhotoUrl`
- `CompletePayment.ts` — Accepts `payoutPhotoUrl`, passes to repository
- `MongoTransactionRepository.ts` — `completePayment` now accepts `extras` spread into `$set`
- `TransactionController.ts` — Passes `payoutPhotoUrl` from `req.body` to use-case
- `schemas.ts` — Added `paymentMethod` + `collectionPhotoUrl` to createTransaction; `payoutPhotoUrl` to completePayment

**Mobile:**
- `config/cloudinary.ts` — NEW: Cloudinary config (placeholders, user must fill in)
- `utils/uploadImage.ts` — NEW: `uploadToCloudinary(uri)` utility using unsigned preset
- `shared/components/ImagePickerButton.tsx` — NEW: reusable camera/gallery picker + auto-upload component
- `features/transaction/api/transactionApi.ts` — `completePayment` now accepts optional `payoutPhotoUrl`
- `CreateTransactionScreen.tsx` — Added payment method toggle + collection slip photo picker
- `CompletePaymentScreen.tsx` — Added token verification photo picker before OTP entry; wrapped in ScrollView
- `TransactionDetailScreen.tsx` — Shows payment method in details; shows collection + payout photos (tap to open full size)

**Package installed:** `expo-image-picker` (SDK 54 compatible)

---

## 2026-07-04 — Session 4

### Participants
- User (Keval, product owner / super admin)
- Claude

### Feature: Instant Force-Logout on Disable

**What was requested:** When super admin disables a company, when head office disables a branch, or when head office disables a staff member — affected users must be logged out immediately.

**Mechanism (two-layer):**
1. **Socket.IO push** (`force_logout` event) — instant for connected clients
2. **Auth middleware DB check** — blocks next API call for offline clients

**Three triggers:**
- Super admin disables company → `notificationService.forceLogoutTenant(tenantId)` → emits to `tenant:{tenantId}` socket room
- Head office disables branch → `notificationService.forceLogoutBranch(tenantId, branchId)` → emits to `{tenantId}:branch:{branchId}` room
- Head office disables user → `notificationService.forceLogoutUser(tenantId, userId)` → emits to `{tenantId}:user:{userId}` room

**New error code `ACCOUNT_DISABLED` (HTTP 401):** Returned when authenticate middleware detects inactive user/tenant/branch. Mobile skips the refresh-token retry on this code and logs out immediately.

### Files Changed

**Backend:**
- `domain/errors/index.ts` — Added `AccountDisabledError` (HTTP 401, code `ACCOUNT_DISABLED`)
- `application/ports/INotificationService.ts` — Added `forceLogoutUser`, `forceLogoutBranch`, `forceLogoutTenant` abstract methods
- `infrastructure/services/SocketNotificationService.ts` — Implemented all three; emit `force_logout` event to appropriate Socket.IO rooms
- `interfaces/http/middleware/authenticate.ts` — Now async; does live DB checks (user + tenant + branch status) on every request using `Promise.all` + `.lean()`; throws `AccountDisabledError` if any is inactive
- `application/use-cases/auth/RefreshToken.ts` — Added branch status check before issuing new tokens; injected `branchRepository`
- `application/use-cases/branch/DeleteBranch.ts` — Injected `notificationService`; calls `forceLogoutBranch` after disabling
- `application/use-cases/user/DeleteUser.ts` — Injected `notificationService`; calls `forceLogoutUser` after disabling
- `application/use-cases/tenant/UpdateTenantStatus.ts` — Injected `notificationService`; calls `forceLogoutTenant` when status → inactive/suspended
- `server.ts` — Added `socket.join('tenant:{tenantId}')` so company-wide broadcasts work
- `container.ts` — Updated `refreshTokenUseCase`, `deleteBranch`, `deleteUser`, `updateTenantStatus` instantiations

**Mobile:**
- `shared/hooks/useSocket.ts` — Added `force_logout` listener; calls `logout()` + shows Alert
- `api/client.ts` — Added `ACCOUNT_DISABLED` check before refresh retry; immediately clears tokens and logs out via `useAuthStore.getState().logout()`

---

## 2026-07-04 — Session 3

### Participants
- User (Keval, product owner / super admin)
- Claude

### Feature: Branch Limit per Company

**What was requested:** Super admin must set a branch limit when registering a company. Head office cannot add more branches than that limit. UI shows "X / Y branches" everywhere relevant.

**Key decisions:**
- `branchLimit` counts only non-`head_office` type branches
- Existing companies in DB get `default: 99` so nothing breaks (Mongoose schema default)
- Soft-limit enforcement: backend throws `BusinessRuleError` (HTTP 422) if count >= limit; frontend shows alert before even navigating to CreateBranch
- `GetBranches` now returns `branchLimit` and `branchCount` alongside the branches array — no extra API call needed on the list screen

### Files Changed

**Backend:**
- `backend/src/infrastructure/db/models/Tenant.model.ts` — Added `branchLimit: { type: Number, required: true, default: 99, min: 1 }`
- `backend/src/application/use-cases/tenant/CreateTenant.ts` — Accepts and persists `branchLimit`
- `backend/src/interfaces/http/validators/schemas.ts` — Added `branchLimit` (integer, min 1, max 9999, required) to `createTenant` schema
- `backend/src/application/ports/IBranchRepository.ts` — Added `countNonHeadOffice(tenantId)` abstract method
- `backend/src/infrastructure/db/repositories/MongoBranchRepository.ts` — Implemented `countNonHeadOffice` (counts active, non-head_office branches)
- `backend/src/application/use-cases/branch/CreateBranch.ts` — Injected `tenantRepository`; throws `BusinessRuleError` when non-head-office branch count >= tenant.branchLimit
- `backend/src/application/use-cases/branch/GetBranches.ts` — Injected `tenantRepository`; returns `branchLimit` and `branchCount` alongside paginated result
- `backend/src/container.ts` — Updated `createBranch` and `getBranches` instantiation to include `tenantRepository`

**Mobile:**
- `mobile/src/features/tenant/screens/RegisterCompanyScreen.tsx` — Added `Branch Limit` numeric input field with validation (required, min 1)
- `mobile/src/features/branch/screens/BranchListScreen.tsx` — Added "Branches Used: X / Y" banner (red + LIMIT REACHED badge when full); `+` button shows alert instead of navigating when at limit; `useLayoutEffect` deps include `atLimit` so icon color updates reactively

---

## 2026-06-30 — Session 1

### Participants
- User (Keval, product owner / super admin)
- Claude

### Problems Reported
1. **Mobile app showing "Network Error"** on login screen.

### Investigation & Fixes
1. Found port mismatch: mobile `client.js` defaulted to `localhost:3000`, backend runs on port `4000`. Fixed default fallback to `4000`.
2. Found backend was not running — nothing listening on port `4000`.
3. Created `mobile/.env` with `EXPO_PUBLIC_API_URL=http://192.168.31.70:4000/api/v1` (machine's local WiFi IP).
4. Found Windows Firewall blocking port `4000` from phone. Added inbound rule for TCP 4000.
5. After all fixes, confirmed backend responds (422 on login = server reachable, validation error only).
6. Added `--clear` flag guidance for Expo to pick up new `.env`.

### Role Structure Discussion
**Problem:** Codebase had 4-5 roles (`super_admin`, `admin`, `head_office`, `branch`, `collection_branch`, `payout_branch`) — inconsistent, some undefined at runtime causing silent auth failures.

**User clarified the correct 3-role structure:**
- `super_admin` — product owner (Keval), registers companies, creates head office accounts
- `head_office` — company head, one per company, manages all sub-branches, approves transactions
- `branch` — sub-branch staff, assigned to one branch, creates and completes transactions

**Why:** Any branch can both collect money (create transaction) and pay out (complete payment) — no need to split into collection_branch/payout_branch. Head office oversees everything under their company.

**Requirements doc reviewed:** `C:\Users\USER\Downloads\ERP Enterprise Product.docx`

### Role Fix Implementation
All completed in this session:

**Backend fixes:**
- `constants.js` — reduced to 3 roles: `super_admin`, `head_office`, `branch`. Added `OTP_SENT` audit action.
- `transaction.routes.js` — branch creates + completes, head_office approves/rejects
- `branch.routes.js`, `user.routes.js`, `settings.routes.js` — `ROLES.ADMIN` → `ROLES.HEAD_OFFICE`
- `CreateUser.js` — only `branch` role requires branchId
- `User.js` entity — `requiresBranch()` now only for `branch` role
- `GetDashboard.js` — branch sees all their transactions (both collection + payout via `$or`)
- `CompletePayment.js` — fixed `AUDIT_ACTIONS.COMPLETE` → `AUDIT_ACTIONS.PAYMENT_COMPLETE` bug
- `MongoTransactionRepository.js` — `$or` query for branch dashboard (collection + payout combined)
- **New endpoint:** `POST /tenants/:id/head-office` — super admin creates head office account for any company
- `TenantController.js`, `tenant.routes.js`, `schemas.js`, `container.js` updated accordingly

**Mobile fixes:**
- `MainNavigator.js` — super admin → Companies tab, head office → full tabs, branch → limited
- `TransactionDetailScreen.js` — head_office approves, branch completes
- `UserListScreen.js` — role labels updated
- `BranchListScreen.js`, `UserListScreen.js` — "+" button to create

**New mobile screens created:**
- `mobile/src/features/tenant/api/tenantApi.js`
- `TenantListScreen.js`, `RegisterCompanyScreen.js`, `TenantDetailScreen.js`, `CreateHeadOfficeScreen.js` (super admin)
- `CreateBranchScreen.js`, `CreateUserScreen.js`, `EditSettingsScreen.js` (head office)
- `SettingsScreen.js` updated with "Edit Settings" button for head office

### Requirements Doc Gap Analysis (vs current implementation)

**Missing — Critical:**
1. Reports module — entirely absent (daily, monthly, branch-wise, commission, export)
2. Balance sheet — entirely absent
3. Transaction filters — token number, amount range, user filter missing
4. Excel/PDF/CSV export — not built
5. CompletePayment only notifies collection branch — should also notify head office
6. Branch balance on dashboard missing
7. DELETE branch / DELETE user endpoints missing

**Missing — Medium:**
8. QR Code on token number
9. Notifications screen on mobile
10. Transaction search by token number in mobile UI
11. IP tracking in audit logs

**Missing — Optional:**
12. WhatsApp notifications
13. Multi-language support
14. Image/ID proof upload

### TypeScript Migration Decision
**Decision:** Convert entire project to TypeScript.
- Mobile: all `.js` → `.tsx` / `.ts`
- Backend: all `.js` → `.ts`

**Why:** User requirement. Clean, typed codebase for long-term maintainability.

### Approved Plan (pending execution)
6 phases approved — see `CLAUDE.md` for full detail.

1. Backend TypeScript migration
2. Mobile TypeScript migration
3. Reports + Balance Sheet (backend)
4. Reports + Balance Sheet (mobile)
5. Small backend fixes (notifications, filters, delete endpoints)
6. Filter UI (mobile)

### Worklog + Documentation Rule Established
- Before any work starts → write a plan, get approval
- After every session → update `WORKLOG.md` and `CLAUDE.md`
- An automated hook added to remind Claude to maintain these files

---

*Next session: Start Phase 1 (Backend TypeScript) + Phase 2 (Mobile TypeScript) in parallel after user approval.*

---

## 2026-07-01 — Session 2

### Participants
- User (Keval, product owner / super admin)
- Claude

### What Was Done

#### TypeScript Setup (before this session's main work)
- Installed backend TS devDeps: typescript, ts-node-dev, @types/node, @types/express, @types/bcryptjs, @types/jsonwebtoken, @types/cors, @types/morgan
- Created backend/tsconfig.json (target: ES2020, module: CommonJS, strict: false, esModuleInterop: true, skipLibCheck: true)
- Created mobile/tsconfig.json (extends expo/tsconfig.base, strict: false)
- Installed mobile deps: react-native-qrcode-svg, react-native-svg
- Converted App.js → App.tsx
- Updated backend package.json dev script to use ts-node-dev

#### Phase 1: Backend TypeScript Migration — COMPLETE
- Converted all 79 backend .js files to .ts (import/export syntax, CommonJS output)
- Config: constants.ts (named exports for ROLES, AUDIT_ACTIONS, etc.), env.ts, logger.ts
- Domain: errors/index.ts (named exports), value-objects, entities
- Ports: 8 interface classes (default exports)
- Use-cases: all 27 use-cases across auth, branch, user, customer, settings, tenant, dashboard, transaction
- Infrastructure: 8 mongoose models, 5 repositories, 4 services
- Interfaces: 4 middleware, 1 validators, 8 controllers, 8 routes
- Root: container.ts, app.ts, server.ts

#### Phase 2: Mobile TypeScript Migration — COMPLETE
- Converted all 47 mobile .js files to .tsx or .ts
- API files → .ts (10 files), stores → .ts (3), hooks → .ts (1), theme → .ts/.tsx, shared components → .tsx (7)
- Navigation → .tsx (3), all screens → .tsx (24 files)
- Fixed duplicate Ionicons import in UserListScreen

#### Phase 3: Reports Backend — COMPLETE
- Created GetReports use-case: summary stats + branch breakdown aggregation from transactions
- Created ExportReport use-case: Excel export (ExcelJS, up to 10,000 rows)
- Created ReportController: getReports + exportReports actions
- Created report.routes.ts: GET /api/v1/reports, GET /api/v1/reports/export (head_office + branch)

#### Phase 4: Reports Mobile — COMPLETE
- Created ReportsScreen.tsx: date filters, type tabs (daily/monthly/branch), summary cards, branch breakdown
- Created reportApi.ts
- Added Reports tab to MainNavigator for head_office

#### Phase 5: Backend Fixes — COMPLETE
- CompletePayment.ts: now notifies head_office role via notificationService.notifyRole after payment
- MongoTransactionRepository.ts: added tokenNumber regex filter + minAmount/maxAmount range filters
- Created DeleteBranch.ts (soft delete: status=inactive + audit log)
- Created DeleteUser.ts (soft delete: status=inactive + audit log)
- Added DELETE /branches/:id and DELETE /users/:id routes (head_office only)
- BranchController + UserController: added deleteBranch/deleteUser methods
- authenticate.ts: captures x-forwarded-for/req.ip and attaches to req.user.ip
- Created notification.routes.ts: GET /, PATCH /:id/read, PATCH /read-all
- Wired all new features into container.ts and app.ts

#### Phase 6: Filter UI Mobile — COMPLETE
- TransactionListScreen.tsx: collapsible filter bar (token search, date range, status chips), Apply button
- BranchListScreen.tsx: trash icon per item, Alert confirmation, soft-delete mutation
- UserListScreen.tsx: trash icon per user (skipped for head_office users), delete mutation

#### Phase 7: Notifications Screen — COMPLETE
- Created NotificationsScreen.tsx: unread indicators, mark-all-read header button, tap-to-transaction navigation
- Created notificationApi.ts: list, markRead, markAllRead
- Added Notifications tab to MainNavigator for head_office and branch (with unread badge)

#### Phase 8: QR Code on Token — COMPLETE
- TransactionDetailScreen.tsx: QR code (react-native-qrcode-svg) below token number, guarded by tokenNumber existence

#### Phase 9: Transaction Search — COMPLETE
- Via TransactionListScreen filter bar (tokenNumber filter passed to API)

#### Phase 10: Dashboard Improvements — COMPLETE
- DashboardScreen.tsx: bell icon in header (navigates to Notifications, shows unread badge)
- Branch balance card (branch role only, when data.balance exists)
- Branch breakdown section (head_office role, from data.branchBreakdown)

### Key Decisions
- TypeScript strict mode OFF throughout (strict: false) — used 'any' liberally for fast migration without breaking existing logic
- All conversions are CommonJS output (module: CommonJS in tsconfig) — backend stays Node.js compatible
- Soft delete only — never removes from DB, sets status: 'inactive'
- Reports: money in paisa stored in DB, displayed in ₹ (paisa / 100)
- Export: Excel only (ExcelJS already installed) — no PDF in this phase
- Notification routes query NotificationModel directly (no repository layer) to keep it simple
- AUDIT_ACTIONS.DELETE_BRANCH and DELETE_USER don't exist in constants — fallback string literals used

### Next Potential Work
- Add TypeScript strict mode gradually (per-file) once codebase is stable
- PDF export for reports
- WhatsApp notifications (optional, from requirements doc)
- Multi-language support (optional)
- Image/ID proof upload (optional)

---
