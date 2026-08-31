# Plan — Enterprise Commission Split & Partner-Based Lenar/Mokalnar

**Date:** 2026-08-25
**Status:** Phase A and Phase B both implemented (2026-08-25) — see WORKLOG.md Sessions 49–50.
**Related session:** See `WORKLOG.md` Session 48 (2026-08-25) for the businessType field this plan builds on.

---

## Background

`Tenant.businessType` (`enterprise` | `aangadia`) was added in Session 48. This plan covers the first real behavior difference driven by that field: how commission is split and settled for `enterprise` tenants, plus a related but separate change to how partner (`ExternalAccount`) selection works in the Gujarati-style entry screen.

---

## Phase A — Enterprise commission split

### Business rule (confirmed with user via concrete example)

Example: Ahmedabad (collection) → Mumbai (payout), ₹500,000 transferred, ₹4,000 total commission taken (commission *amount* computation is unchanged — still driven by `tenant.settings.commission` / branch `commissionConfig` / override, exactly as today).

Two settings per enterprise tenant: **Branch %** and **Head Office %**, where `2 × branchPct + headOfficePct = 100` (branch % applies once to whichever branch earns the commission on this transaction — collection or payout side, same determination as today).

With branchPct=30, headOfficePct=40:
- Earning branch (Ahmedabad in this example) keeps 30% = ₹1,200
- The *other* branch (Mumbai) is informationally owed 30% = ₹1,200
- Head Office is owed 40% = ₹1,600

**Critical correction from the user:** the earning branch does **not** settle directly with the other branch. Only two parties settle: **earning branch ↔ Head Office**, for the *combined* 70% (₹2,800 = Mumbai's 1200 + HO's 1600). What Head Office then does with Mumbai's share is Head Office's own call — outside this system's automated settlement. We only need to show the breakdown so HO knows how much of each settlement is "really theirs" vs "owed onward to Mumbai."

### Design

This reuses the **existing** `HQCommissionItem` / `HQCommissionSettlement` system (today driven by `Branch.masterCommissionPct`) almost unchanged — no new branch-to-branch settlement system needed.

1. **`Tenant.model.ts`** — `settings.commissionSplit: { branchPct: Number, headOfficePct: Number }`. Validated: `2×branchPct + headOfficePct === 100`.
2. **`Transaction.model.ts`** — add a commission-split snapshot (own share, other branch id/share, HO share) for reporting, since settings can change after the fact.
3. **`CreateTransaction.ts` / `CompletePayment.ts`** (enterprise tenants only):
   - Earning branch is still credited the **full** commission amount immediately, unchanged timing (creation for collection-side, completion for payout-side) — no change to today's ledger crediting.
   - Additionally create **one** `HQCommissionItem` with `hqSharePct = 100 − branchPct` (70%), `hqShareAmount = commissionAmount × 70%` (₹2,800), plus informational-only fields: `otherBranchId` (Mumbai), `otherBranchShareAmount` (₹1,200), `headOfficeOwnShareAmount` (₹1,600).
   - Bypasses `masterCommissionPct` and the `creditCommissionToSendingBranch` flag entirely for enterprise tenants — those remain exactly as-is for `aangadia` tenants.
4. If an enterprise tenant hasn't configured `commissionSplit` yet, **block transaction creation** with a clear validation error (financial safety — no silent fallback).
5. Settlement mechanics (Ahm ↔ HO) reuse the existing `HQCommissionSettlement` flow completely unchanged — just a larger amount than today's `masterCommissionPct`-derived one.
6. **Mobile:**
   - `HQCommissionItemsScreen.tsx` / `HQCommissionSettlementsScreen.tsx` — show the 1200/1600 breakdown alongside the total, so HO can see what's earmarked for the other branch vs their own.
   - `MyStatementScreen.tsx` / `BranchLedgerScreen.tsx` — fill in the missing `hq_commission_out`/`hq_commission_in` event labels (found during research to be undefined today — falls back to raw event name).
   - `TenantDetailScreen.tsx` (super admin) + head-office self-service settings — new "Commission Split" editor (Branch % / HO %) shown only for enterprise tenants, with live 100%-sum validation.
7. **Reports** — `GetReports.ts` / `ExportReport.ts` extended to include the 3-way breakdown for enterprise tenants.

---

## Phase B — Partner selection for Lenar/Mokalnar (ShakhaEntryScreen only)

Scope: `mobile/src/features/transaction/screens/ShakhaEntryScreen.tsx` only — not the plain `CreateTransactionScreen.tsx`.

1. **Mokalnar (sender)** — mutually-exclusive toggle: type name/mobile, or select an existing partner. Reuses the *existing* `externalAccountId` field/logic (already scoped to the collection branch, already moves partner balance toward "OWES US" at approval) — this half is mostly UI wiring to make it a clean either/or with the free-text fields.
2. **Lenar (receiver)** — **new capability.** Add `payoutExternalAccountId` to `Transaction.model.ts`, validated against the payout branch. At `CompletePayment`: branch still pays cash out exactly as today (unchanged ledger debit), **and** the selected partner's balance moves toward "OWES US" by the same amount — symmetric direction to the sender side, per user confirmation.
3. **Branch balance visibility** — stop netting out partner-covered amounts from branch balance. Today, `CreateTransaction.ts` computes `branchPortion = amount − partnerCoveredAmount`, which hides the partner-covered portion from the branch's own balance. Change so branch balance/ledger always reflects the **full** transaction amount, while partner balance moves as a fully separate, additional record — both fully visible, nothing excluded.
4. Commission calculation is confirmed unaffected by partner involvement on either side (verified in research — no change needed there).

---

## Explicitly out of scope for this round

- Automated Head-Office → Mumbai settlement (Phase A) — HO's own manual process for now.
- Partner selection on `CreateTransactionScreen.tsx` (Phase B) — ShakhaEntryScreen only.
- Any change to how the total commission *amount* itself is computed (flat/percentage/override) — unchanged in both phases.
