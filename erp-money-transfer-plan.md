# Money Transfer Branch Management System — Project Plan

## Confirmed Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Branch Naming | **Collection Branch** (receives cash) / **Payout Branch** (pays out) |
| 2 | Booking Type | Enum on transaction — marks which side created the entry |
| 3 | Commission | Both flat fee + percentage supported, configured in Settings by Admin |
| 4 | Login | Username + Password (no OTP login) |
| 5 | Customer OTP at Payout | Required — customer gets OTP before payment released |
| 6 | Customer Master | Yes — separate Customer entity, reusable across transactions |
| 7 | Token Format | Decided by dev team |
| 8 | Transaction Statuses | Pending → Approved / Rejected → Completed (no cancel/expiry) |
| 9 | Admin Can Create Transactions | Yes |
| 10 | Head Office | Single role, not a branch entity |
| 11 | Multi-tenant | Yes — this is a SaaS product, multiple companies use the system |
| 12 | Login Time Restriction | Global setting per tenant (configured by Tenant Admin) |
| 13 | Multi-device Sessions | Tracked and manageable |
| 14 | All APIs | Full REST API coverage required |

---

## Open Questions (Must Resolve Before Module Build)

> These were not fully answered — flag these before starting the affected module.

### Q1 — Commission: Who Sets It?
- Option A: Tenant Admin sets one global commission rule for all branches
- Option B: Tenant Admin sets commission per-branch or per-route (Ahmedabad→Mumbai = X%)
- **Affects**: Commission Engine, Settings Module, Transaction creation

### Q2 — Multi-tenant: Super Admin Role?
- Is there a **Platform-level Super Admin** (the product owner / technocodes) who creates and manages tenant accounts?
- Or do tenants self-register?
- **Affects**: Entire auth layer, onboarding flow, DB architecture

### Q3 — Multi-tenant DB Strategy
- Option A: **Shared DB** with `tenantId` on every document (simpler, faster to build)
- Option B: **Separate DB per tenant** (stronger isolation, more complex ops)
- Recommendation: Option A (shared DB + tenantId) for v1, scales fine for 40+ branches per tenant
- **Affects**: Every data model and query

### Q4 — WhatsApp Notification
- Required from Day 1 or optional/future?
- **Affects**: Sprint planning

### Q5 — Image / Document Upload (ID Proof)
- Required from Day 1 or optional/future?
- **Affects**: Storage setup (S3 / Cloudinary)

### Q6 — SMS Gateway
- Recommendation: **msg91** or **Fast2SMS** (better for India, cheaper than Twilio)
- Confirm which one?

### Q7 — Who Uses the Mobile App vs Web?
- Branch users → Mobile app (React Native)?
- Admin / Head Office → Web panel only?
- Or everyone uses mobile app?
- **Affects**: UI scope planning

### Q8 — Hosting Platform
- AWS / DigitalOcean / Railway / Render?
- **Affects**: Deployment architecture

---

## Tech Stack (Final — Confirmed)

| Layer | Technology |
|---|---|
| Mobile App | React Native (Android + iOS) |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas |
| Auth | JWT + Refresh Tokens |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| SMS | msg91 / Fast2SMS (India) |
| WhatsApp | Meta Cloud API or Interakt/Wati |
| File Storage | AWS S3 or Cloudinary |
| Real-time | Socket.IO (for live notifications) |
| Reports Export | ExcelJS (Excel), PDFKit or Puppeteer (PDF) |
| Hosting | TBD |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   MULTI-TENANT SaaS                  │
│                                                     │
│  ┌─────────────┐    ┌────────────────────────────┐  │
│  │ Super Admin │    │       Tenant (Company)      │  │
│  │  (Platform) │    │  Admin | Head Office | Branch│  │
│  └─────────────┘    └────────────────────────────┘  │
│                                                     │
│              Node.js + Express API                  │
│              MongoDB Atlas (tenantId isolated)      │
│              Socket.IO (real-time events)           │
└─────────────────────────────────────────────────────┘
         ↑                          ↑
   React Native App          (Future: Web Panel)
   (Android + iOS)
```

---

## Data Models (Core)

### Tenant
```
tenantId, companyName, adminEmail, plan, status, createdAt
settings: { loginStartTime, loginEndTime, sessionTimeout, commissionType, commissionValue }
```

### User
```
tenantId, userId, fullName, username, passwordHash, role (super_admin|admin|head_office|branch),
branchId, status, lastLogin, deviceTokens[], createdAt
```

### Branch
```
tenantId, branchId, branchName, city, state, address, contactNumber, email, status, createdAt
```

### Customer
```
tenantId, customerId, fullName, mobileNumber, address, idProofType, idProofNumber,
idProofImage (optional), createdAt, createdBy
```

### Transaction
```
tenantId, transactionId, tokenNumber, bookingType (collection|payout),
collectionBranchId, payoutBranchId,
customerId, customerName, customerMobile,
amount, commissionType, commissionValue, commissionAmount, finalAmount,
approvalStatus (pending|approved|rejected), approvalBy, approvalDate, rejectionReason,
paymentStatus (pending|completed), paymentDate, paymentBy,
customerOtp, customerOtpVerified,
createdBy, createdAt, remarks
```

### AuditLog
```
tenantId, userId, action, module, description, ipAddress, deviceInfo, timestamp
```

### Notification
```
tenantId, userId, type, title, body, referenceId, referenceType, isRead, channel[], sentAt
```

---

## Modules Breakdown

### Phase 1 — Foundation
- [ ] Project setup (Node.js, MongoDB Atlas, React Native)
- [ ] Multi-tenant architecture + Super Admin
- [ ] Authentication (username + password, JWT, refresh tokens)
- [ ] Session management + device tracking
- [ ] Login time restriction (global setting)

### Phase 2 — Core Management
- [ ] Tenant onboarding flow
- [ ] Branch Management (CRUD)
- [ ] User Management (CRUD, role assignment)
- [ ] Customer Master (CRUD, search)
- [ ] Settings Module (commission, login timing, session policy)

### Phase 3 — Transaction Engine
- [ ] Token number generation
- [ ] Create Transaction (Collection Branch)
- [ ] HO Approval / Rejection flow
- [ ] Customer OTP generation + verification at payout
- [ ] Payout completion flow
- [ ] Commission auto-calculation (flat/percentage)

### Phase 4 — Notifications
- [ ] In-app notifications (Socket.IO real-time)
- [ ] Push notifications (FCM)
- [ ] SMS notifications
- [ ] WhatsApp notifications (if confirmed required in v1)

### Phase 5 — Dashboard & Reports
- [ ] Role-based dashboards (Admin / HO / Branch)
- [ ] Financial reports (daily, monthly, branch-wise, commission)
- [ ] User activity reports (login/logout/session)
- [ ] Export: Excel, PDF, CSV
- [ ] Balance sheet module

### Phase 6 — Advanced Features
- [ ] QR Code for token
- [ ] Audit logs module
- [ ] Search & filter (global, transaction, customer, branch)
- [ ] Transaction limits (daily/user-wise)
- [ ] Image upload for ID proof (if confirmed v1)

### Phase 7 — Polish & Deploy
- [ ] Full API documentation
- [ ] Testing (unit + integration)
- [ ] Deployment setup
- [ ] User training materials

---

## API Structure (High Level)

### Auth
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout

### Tenants (Super Admin only)
- GET/POST /tenants
- GET/PUT/DELETE /tenants/:id

### Branches
- GET/POST /branches
- GET/PUT/DELETE /branches/:id

### Users
- GET/POST /users
- GET/PUT/DELETE /users/:id
- POST /users/:id/reset-password

### Customers
- GET/POST /customers
- GET/PUT /customers/:id
- GET /customers/search

### Transactions
- POST /transactions (create)
- GET /transactions (list with filters)
- GET /transactions/:id
- PUT /transactions/:id/approve
- PUT /transactions/:id/reject
- POST /transactions/:id/verify-otp
- PUT /transactions/:id/complete-payment

### Dashboard
- GET /dashboard/admin
- GET /dashboard/head-office
- GET /dashboard/branch

### Reports
- GET /reports/transactions (daily/monthly/branch-wise)
- GET /reports/commission
- GET /reports/balance-sheet
- GET /reports/login-activity
- GET /reports/export (Excel/PDF/CSV)

### Notifications
- GET /notifications
- PUT /notifications/:id/read
- PUT /notifications/read-all

### Settings
- GET/PUT /settings

### Audit Logs
- GET /audit-logs

---

## Roles & Permissions Matrix

| Feature | Super Admin | Admin | Head Office | Branch |
|---|---|---|---|---|
| Manage Tenants | ✅ | ❌ | ❌ | ❌ |
| Manage Branches | ❌ | ✅ | ❌ | ❌ |
| Manage Users | ❌ | ✅ | ❌ | ❌ |
| Manage Customers | ❌ | ✅ | ✅ (view) | ✅ |
| Create Transaction | ❌ | ✅ | ❌ | ✅ |
| Approve/Reject Transaction | ❌ | ❌ | ✅ | ❌ |
| Complete Payment | ❌ | ✅ | ❌ | ✅ |
| View All Transactions | ❌ | ✅ | ✅ | Own branch only |
| Commission Settings | ❌ | ✅ | ❌ | ❌ |
| System Settings | ❌ | ✅ | ❌ | ❌ |
| Export Reports | ❌ | ✅ | ✅ | Limited |
| Audit Logs | ❌ | ✅ | ❌ | ❌ |

---

## Transaction Status Flow

```
[Created by Collection Branch]
        ↓
   PENDING (Approval)
        ↓
  ┌─────┴─────┐
APPROVED    REJECTED
  ↓            ↓
[Payout   [Reason sent to
 Branch]   Collection Branch]
  ↓
Customer provides Token
  ↓
Customer OTP verified
  ↓
COMPLETED
```

---

## Notification Triggers

| Event | Collection Branch | Head Office | Payout Branch |
|---|---|---|---|
| Transaction Created | — | ✅ | — |
| Transaction Approved | ✅ | — | ✅ |
| Transaction Rejected | ✅ | — | — |
| Payment Completed | ✅ | ✅ | — |

---

*Last updated: 2026-06-28*
*Stack: React Native + Node.js + MongoDB Atlas*
*Status: Planning — awaiting answers to Open Questions (Q1–Q8)*
