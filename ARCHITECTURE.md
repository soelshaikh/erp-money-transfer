# System Architecture — Money Transfer Branch Management System

> Research-backed decisions. Every rule here is sourced from adversarially verified findings
> (115 agents, 32 sources, 25 verified claims). Sources cited inline.

---

## 1. Architectural Pattern — Backend

### Decision: Pragmatic Clean Architecture (3-Layer + Ports & Adapters)

**Verified basis:** Clean Architecture mandates strictly unidirectional dependency flow.
Infrastructure may depend on domain; domain NEVER imports from infrastructure.
Ports (abstract interfaces) live in the application layer; Adapters (concrete implementations)
live in infrastructure and are injected at a single composition root.
[Source: khalilstemmler.com, Uncle Bob, Alistair Cockburn — 3-0 verified]

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  INTERFACES  (routes, controllers, middleware, DTOs) │
│  Knows about: HTTP, req/res, validation              │
└──────────────────────┬──────────────────────────────┘
                       │ calls
                       ▼
┌─────────────────────────────────────────────────────┐
│  APPLICATION  (use-cases, ports/interfaces)          │
│  Knows about: domain logic, abstract ports           │
│  Does NOT know: MongoDB, Express, SMS provider       │
└──────────────────────┬──────────────────────────────┘
                       │ depends on (via ports)
                       ▼
┌─────────────────────────────────────────────────────┐
│  DOMAIN  (entities, value objects, domain errors)    │
│  Zero external dependencies — pure business rules    │
└─────────────────────────────────────────────────────┘
                       ▲
                       │ implements ports
┌─────────────────────────────────────────────────────┐
│  INFRASTRUCTURE  (MongoDB models, SMS, push, socket) │
│  Concrete implementations of application ports       │
└─────────────────────────────────────────────────────┘
                       ▲
                       │ wired at
┌─────────────────────────────────────────────────────┐
│  CONTAINER  (container.js — composition root)        │
│  One file. Instantiates all adapters, injects into  │
│  use-cases. No other file does dependency injection. │
└─────────────────────────────────────────────────────┘
```

---

## 2. Backend Folder Structure

```
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Transaction.js       # Pure business object, no Mongoose
│   │   │   ├── Branch.js
│   │   │   └── User.js
│   │   ├── value-objects/
│   │   │   ├── Money.js             # Handles ₹ precision (paisa-level)
│   │   │   ├── Commission.js        # flat / percentage calc logic
│   │   │   └── TokenNumber.js       # Generation + format rules
│   │   └── errors/
│   │       ├── DomainError.js
│   │       ├── ValidationError.js
│   │       └── NotFoundError.js
│   │
│   ├── application/
│   │   ├── ports/                   # Abstract interfaces (Ports)
│   │   │   ├── ITransactionRepository.js
│   │   │   ├── IBranchRepository.js
│   │   │   ├── IUserRepository.js
│   │   │   ├── ICustomerRepository.js
│   │   │   ├── ITenantRepository.js
│   │   │   ├── INotificationService.js
│   │   │   ├── ISmsService.js
│   │   │   └── IAuditService.js
│   │   └── use-cases/
│   │       ├── auth/
│   │       │   ├── LoginUseCase.js
│   │       │   └── LogoutUseCase.js
│   │       ├── transaction/
│   │       │   ├── CreateTransactionUseCase.js
│   │       │   ├── ApproveTransactionUseCase.js
│   │       │   ├── RejectTransactionUseCase.js
│   │       │   ├── SendPaymentOtpUseCase.js
│   │       │   └── CompletePaymentUseCase.js
│   │       ├── branch/
│   │       │   ├── CreateBranchUseCase.js
│   │       │   └── UpdateBranchUseCase.js
│   │       ├── user/
│   │       │   ├── CreateUserUseCase.js
│   │       │   └── ResetPasswordUseCase.js
│   │       └── tenant/
│   │           └── CreateTenantUseCase.js
│   │
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   ├── models/              # Mongoose schemas ONLY — no business logic
│   │   │   │   ├── TenantModel.js
│   │   │   │   ├── UserModel.js
│   │   │   │   ├── BranchModel.js
│   │   │   │   ├── CustomerModel.js
│   │   │   │   ├── TransactionModel.js
│   │   │   │   ├── AuditLogModel.js
│   │   │   │   └── NotificationModel.js
│   │   │   └── repositories/        # Adapters implementing IXxxRepository
│   │   │       ├── MongoTransactionRepository.js
│   │   │       ├── MongoBranchRepository.js
│   │   │       ├── MongoUserRepository.js
│   │   │       ├── MongoCustomerRepository.js
│   │   │       └── MongoTenantRepository.js
│   │   └── services/                # Adapters implementing IXxxService
│   │       ├── sms/
│   │       │   ├── Msg91SmsService.js
│   │       │   └── MockSmsService.js
│   │       ├── notification/
│   │       │   ├── SocketNotificationService.js
│   │       │   └── FirebasePushService.js
│   │       └── audit/
│   │           └── MongoAuditService.js
│   │
│   ├── interfaces/
│   │   └── http/
│   │       ├── middleware/
│   │       │   ├── authenticate.js      # JWT verification (ES256, algo pinned)
│   │       │   ├── authorize.js         # Role-based allow()
│   │       │   ├── tenantGuard.js       # Tenant active check
│   │       │   ├── loginTimeGuard.js    # Branch time restriction
│   │       │   ├── idempotency.js       # Idempotency key dedup
│   │       │   └── rateLimiter.js       # Returns 429 per OWASP
│   │       ├── routes/
│   │       │   ├── auth.routes.js
│   │       │   ├── tenant.routes.js
│   │       │   ├── branch.routes.js
│   │       │   ├── user.routes.js
│   │       │   ├── customer.routes.js
│   │       │   ├── transaction.routes.js
│   │       │   ├── dashboard.routes.js
│   │       │   ├── report.routes.js
│   │       │   ├── notification.routes.js
│   │       │   ├── settings.routes.js
│   │       │   └── auditLog.routes.js
│   │       ├── controllers/
│   │       │   ├── AuthController.js
│   │       │   ├── TenantController.js
│   │       │   ├── BranchController.js
│   │       │   ├── UserController.js
│   │       │   ├── CustomerController.js
│   │       │   ├── TransactionController.js
│   │       │   ├── DashboardController.js
│   │       │   ├── ReportController.js
│   │       │   ├── NotificationController.js
│   │       │   ├── SettingsController.js
│   │       │   └── AuditLogController.js
│   │       └── validators/
│   │           └── schemas.js           # Joi schemas
│   │
│   ├── config/
│   │   ├── env.js                   # All env vars, validated at startup
│   │   └── constants.js
│   │
│   ├── container.js                 # ONLY file that does 'new'. Wires everything.
│   └── app.js                       # Express setup, no business logic
│
├── server.js                        # Entry point: load container, start HTTP + Socket
├── scripts/
│   └── seed-super-admin.js
├── .env.example
└── package.json
```

---

## 3. MongoDB Multi-Tenancy Rules

**Verified basis:** MongoDB Atlas explicitly classifies per-tenant collections inside a shared
database as an anti-pattern. The correct model = shared DB + shared collections + tenantId on
every document. All compound indexes MUST start with tenantId.
[Source: mongodb.com/docs/atlas/build-multi-tenant-arch/ — 3-0 verified]

### Rules (non-negotiable)

1. **Every document has `tenantId` as the first field**
2. **Every compound index starts with `{ tenantId: 1, ... }`** — never a field-first index
3. **Every repository method takes `tenantId` as a required parameter** — never optional
4. **Tenant isolation is enforced at the repository layer, not in controllers**
5. **Anti-pattern (banned):** separate collections per tenant inside shared DB

### Index Strategy

```javascript
// CORRECT — tenantId always first in compound index
TransactionModel.index({ tenantId: 1, approvalStatus: 1, createdAt: -1 })
TransactionModel.index({ tenantId: 1, tokenNumber: 1 }, { unique: true })
TransactionModel.index({ tenantId: 1, collectionBranchId: 1, createdAt: -1 })
TransactionModel.index({ tenantId: 1, payoutBranchId: 1, paymentStatus: 1 })

// WRONG — never start without tenantId
TransactionModel.index({ approvalStatus: 1, createdAt: -1 })  // ❌ BANNED
```

### Aggregation Pipeline Rules

**Verified basis:** $sort placed before $unwind/$group/$project uses an index.
After those stages = blocking in-memory sort.
[Source: practical-mongodb-aggregations.com — 3-0 verified]

```javascript
// CORRECT — $match (with tenantId) + $sort early
pipeline = [
  { $match: { tenantId, approvalStatus: 'pending' } },   // 1. filter first
  { $sort: { tenantId: 1, createdAt: -1 } },              // 2. sort early = index used
  { $limit: 100 },                                         // 3. limit before any joins
  { $lookup: { ... } }                                     // 4. join last
]

// WRONG — sort after group kills index usage
pipeline = [
  { $group: { ... } },
  { $sort: { ... } }   // ❌ blocking in-memory sort
]
```

---

## 4. Security Architecture

**Verified basis:** OWASP, Curity, FAPI 2.0, RFC 9449 [3-0 verified across 4 sub-claims]

### JWT Rules

```
Algorithm:    ES256 (ECDSA) — hard-coded server-side, NEVER read from header
              Reject alg:none at the library config level
Access token: 15 minutes expiry
Refresh token: 7 days expiry
Storage:      Refresh token in secure HTTP-only cookie (web) / SecureStore (mobile)
```

### Rate Limiting Rules

```
Returns:      HTTP 429 (Too Many Requests) — OWASP mandatory [3-0 verified]
Login:        10 attempts per 15 minutes per IP
OTP send:     3 attempts per 10 minutes per transaction
General API:  200 requests per 15 minutes per user
Reports/Export: 10 requests per hour per tenant
```

### Idempotency (Transaction Safety)

Every state-mutation endpoint (create transaction, approve, complete payment) accepts
an `Idempotency-Key` header. Duplicate keys within 24 hours return the cached response.

```
Header:    Idempotency-Key: <uuid-v4>  (client generates)
Storage:   MongoDB idempotency collection, TTL index = 24 hours
On hit:    Return 200 + original response body, skip re-execution
On miss:   Execute, store result, return result
```

---

## 5. Tenant Extensibility Architecture

### Tenant Branding Schema

Every tenant can have its own branding. Stored in the Tenant document:

```javascript
branding: {
  appName: String,           // "Mehta Money Transfer"
  logoUrl: String,           // CDN URL
  primaryColor: String,      // "#1A56DB" (hex)
  secondaryColor: String,    // "#0E9F6E"
  accentColor: String,
  faviconUrl: String,
  supportEmail: String,
  supportPhone: String,
}
```

### Tenant Feature Flags

Per-tenant features stored in Tenant document. Evaluated at runtime without redeploy.

```javascript
features: {
  whatsappNotifications: Boolean,
  customerOtpRequired: Boolean,
  qrCodeEnabled: Boolean,
  imageUploadEnabled: Boolean,
  transactionLimitsEnabled: Boolean,
  multiDeviceLogin: Boolean,
  loginTimeRestriction: Boolean,
  reportExportEnabled: Boolean,
}
```

**Pattern:** Feature check is always: `req.tenant.features.featureName === true`
Never check feature flags in domain code — only in application use-cases and middleware.

---

## 6. React Native Architecture

### Pattern: Feature-Based Folder Structure

Each feature is a self-contained module with its own screens, API calls, and local state.
Shared UI components live in `shared/`. Global state (auth, tenant) lives in `core/`.

```
mobile/src/
├── features/
│   ├── auth/
│   │   ├── screens/
│   │   │   └── LoginScreen.jsx
│   │   ├── hooks/
│   │   │   └── useLogin.js
│   │   └── api.js
│   ├── transaction/
│   │   ├── screens/
│   │   │   ├── TransactionListScreen.jsx
│   │   │   ├── TransactionDetailScreen.jsx
│   │   │   └── NewTransactionScreen.jsx
│   │   ├── components/
│   │   │   └── TransactionCard.jsx
│   │   ├── hooks/
│   │   │   └── useTransactions.js
│   │   └── api.js
│   ├── branch/
│   ├── customer/
│   ├── dashboard/
│   ├── notification/
│   ├── report/
│   └── settings/
│
├── shared/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   └── Button.types.js
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Badge/
│   │   ├── Modal/
│   │   ├── EmptyState/
│   │   ├── Loader/
│   │   └── StatCard/
│   ├── hooks/
│   │   ├── useDebounce.js
│   │   └── usePagination.js
│   └── utils/
│       ├── formatters.js     # Currency, date, mask
│       └── storage.js        # AsyncStorage wrapper
│
├── core/
│   ├── api/
│   │   ├── client.js         # Axios instance + interceptors
│   │   └── endpoints.js      # All API URL constants
│   ├── store/
│   │   ├── authStore.js      # Zustand — login, logout, user
│   │   └── notificationStore.js
│   └── tenant/
│       ├── TenantThemeProvider.jsx  # Context that serves branding
│       ├── useTenantTheme.js        # Hook to read current theme
│       └── defaultTheme.js          # Fallback when no tenant branding
│
├── navigation/
│   ├── AppNavigator.jsx      # Root: auth check → role router
│   ├── AuthNavigator.jsx
│   ├── AdminNavigator.jsx
│   ├── HeadOfficeNavigator.jsx
│   └── BranchNavigator.jsx
│
└── theme/
    ├── index.js              # Design tokens (spacing, radius, shadow, typography)
    └── colors.js             # Default color palette
```

### State Management

- **Zustand**: Auth state, notification store, tenant config — global, persistent
- **Local `useState`**: Form state, UI toggles — never leave the component
- **React Query (TanStack)**: Server data fetching, caching, pagination, background refresh
  - Cache time: 5 min for lists, 30 sec for transaction details (financial data must be fresh)

### Tenant Theming in React Native

```jsx
// core/tenant/TenantThemeProvider.jsx
// Reads tenant branding from authStore, merges with defaultTheme
// All components call useTenantTheme() — never hardcode colors
const theme = useTenantTheme()
// theme.colors.primary → tenant primary OR default #1A56DB
// theme.branding.logoUrl → tenant logo OR default app icon
// theme.branding.appName → "Mehta Transfers" OR "MoneyTransfer"
```

---

## 7. High-Volume Transaction Safety

### Idempotency Key Flow

```
Client                          API Server                    MongoDB
  │                                │                             │
  │── POST /transactions ─────────>│                             │
  │   Idempotency-Key: abc-123    │                             │
  │                                │── find idempotency key ───>│
  │                                │<── not found ──────────────│
  │                                │── create transaction ─────>│
  │                                │── store key + result ─────>│
  │<── 201 Created ────────────────│                             │
  │                                │                             │
  │── POST /transactions (retry) ─>│                             │
  │   Idempotency-Key: abc-123    │                             │
  │                                │── find idempotency key ───>│
  │                                │<── found: cached result ───│
  │<── 200 + same response ────────│ (no second transaction)     │
```

### Optimistic Concurrency for Approvals

Prevents two HO users approving the same transaction simultaneously:

```javascript
// Use MongoDB's findOneAndUpdate with status pre-condition
// If transaction was already approved by another user, the query returns null
const updated = await Transaction.findOneAndUpdate(
  { tenantId, transactionId, approvalStatus: 'pending' },  // Must still be pending
  { $set: { approvalStatus: 'approved', approvalBy: userId, approvalDate: new Date() } },
  { new: true }
)
if (!updated) throw new ConflictError('Transaction already processed')
```

---

## 8. API Response Contract

All API responses follow this exact shape. Never deviate.

```javascript
// Success
{ success: true, message: "Human readable", data: <payload> }

// Success paginated
{ success: true, message: "...", data: [...], pagination: { total, page, limit, pages } }

// Error
{ success: false, message: "Human readable error", code: "ERROR_CODE" }

// Validation error
{ success: false, message: "Validation failed", errors: [{ field, message }] }
```

HTTP status codes used: 200, 201, 400, 401, 403, 404, 409, 422, 429, 500.
No other codes.

---

## 9. What We Are NOT Building (Intentional Scope Limits)

- No event sourcing (overkill for 40 branches)
- No message queue (RabbitMQ/Kafka) in v1 — Socket.IO is sufficient for real-time
- No CQRS — single write/read model is appropriate at this scale
- No Redis — idempotency keys stored in MongoDB with TTL index (sufficient)
- No GraphQL — REST is simpler for this team and use case
- No microservices — monolith is correct for v1, extract later if needed
