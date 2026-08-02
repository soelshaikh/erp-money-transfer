# Coding Standards — Money Transfer System

> These are laws, not suggestions. Every PR must follow these rules.
> Violations during code review = block merge.

---

## Backend Standards (Node.js)

### 1. Layer Dependency Rule (MUST NEVER VIOLATE)

```
✅ interface → application → domain       (inward — allowed)
✅ infrastructure → application/domain    (implements ports — allowed)
❌ domain → infrastructure                (BANNED — breaks Clean Architecture)
❌ domain → application                   (BANNED)
❌ use-case → controller                  (BANNED)
```

**Check:** If a file in `domain/` has `require('../infrastructure/...')` → BLOCKED.

### 2. Repository Pattern (All Data Access)

Every data access operation goes through a repository. Controllers and use-cases
NEVER import Mongoose models directly.

```javascript
// ✅ CORRECT — use-case depends on ITransactionRepository (port)
class CreateTransactionUseCase {
  constructor({ transactionRepository, branchRepository, tenantRepository, auditService }) {
    this.transactionRepo = transactionRepository  // port, not mongo
    this.branchRepo = branchRepository
  }
  async execute(dto) { ... }
}

// ❌ BANNED — use-case importing Mongoose model directly
const Transaction = require('../../../infrastructure/db/models/TransactionModel')
```

### 3. tenantId is NEVER Optional

Every repository method signature includes `tenantId`. A query without tenantId
is a security breach — it leaks cross-tenant data.

```javascript
// ✅ CORRECT
async findById(tenantId, transactionId) {
  return TransactionModel.findOne({ tenantId, transactionId })
}

// ❌ BANNED — tenantId missing
async findById(transactionId) {
  return TransactionModel.findOne({ transactionId })  // leaks all tenants!
}
```

### 4. MongoDB Index Rule

Every compound index on any model MUST start with `{ tenantId: 1, ... }`.

```javascript
// ✅ CORRECT
schema.index({ tenantId: 1, createdAt: -1 })
schema.index({ tenantId: 1, tokenNumber: 1 }, { unique: true })
schema.index({ tenantId: 1, approvalStatus: 1, payoutBranchId: 1 })

// ❌ BANNED
schema.index({ createdAt: -1 })
schema.index({ tokenNumber: 1 }, { unique: true })
```

### 5. JWT / Auth Rules

```javascript
// ✅ CORRECT — algorithm pinned, never from header
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['ES256'] })

// ❌ BANNED — algorithm read from token header (CVE-2015-9235 class vulnerability)
jwt.verify(token, process.env.JWT_SECRET)  // defaults allow alg spoofing
```

Access token max expiry: `15m`. Refresh token max expiry: `7d`.
Never issue tokens with `expiresIn: '30d'` for access tokens.

### 6. HTTP Status Codes

Rate limiting → always `429`. Never `400` or `403` for rate limit.
Not found → `404`. Auth failure → `401`. Permission failure → `403`.
Conflict (already processed) → `409`. Validation → `422`. Server error → `500`.

### 7. Money Arithmetic — No Floating Point

```javascript
// ✅ CORRECT — work in paisa (integer), convert only for display
const amountPaisa = Math.round(amount * 100)  // store as integer
const commissionPaisa = Math.round(commissionAmount * 100)

// ❌ BANNED — floating point causes 0.1 + 0.2 = 0.30000000000000004
const final = amount - commissionAmount  // never do this directly
```

The `Money` value object in `domain/value-objects/Money.js` handles all arithmetic.
Use it everywhere. Never compute money inline in controllers or use-cases.

### 8. Error Handling

```javascript
// ✅ CORRECT — throw domain errors, catch in controller
class CreateTransactionUseCase {
  async execute(dto) {
    if (dto.amount <= 0) throw new ValidationError('Amount must be positive')
    if (dto.collectionBranchId === dto.payoutBranchId) {
      throw new ValidationError('Collection and payout branches must differ')
    }
  }
}

// Controller maps domain errors → HTTP codes
// ❌ BANNED — putting business validation in controllers
if (req.body.amount <= 0) return res.status(400).json({ ... })
```

### 9. Audit Logging

Every state-changing operation logs to audit. This is non-negotiable for a financial system.
The `auditService.log()` call is the last step in every use-case `execute()` method.
Audit failures must NEVER crash the main flow — wrap in try/catch internally.

### 10. Aggregation Pipeline Rules

```javascript
// ✅ CORRECT — $match first, $sort early, $limit before $lookup
[
  { $match: { tenantId, approvalStatus: 'pending' } },
  { $sort: { tenantId: 1, createdAt: -1 } },
  { $limit: 1000 },
  { $lookup: { from: 'branches', ... } }
]

// ❌ BANNED — sort after group = blocking in-memory sort
[
  { $group: { _id: '$branchId', total: { $sum: '$amount' } } },
  { $sort: { total: -1 } }  // no index can help here
]
```

### 11. File Naming Conventions

```
Domain entities:        PascalCase.js            → Transaction.js
Use-cases:              PascalCaseUseCase.js      → CreateTransactionUseCase.js
Repositories (mongo):   MongoPascalCaseRepository.js → MongoTransactionRepository.js
Ports (interfaces):     IPascalCase.js            → ITransactionRepository.js
Controllers:            PascalCaseController.js    → TransactionController.js
Routes:                 kebab-case.routes.js       → transaction.routes.js
Models:                 PascalCaseModel.js         → TransactionModel.js
Services:               PascalCaseService.js       → Msg91SmsService.js
```

### 12. Container (Dependency Injection)

`container.js` is the ONLY file allowed to instantiate classes and wire dependencies.
No `new SomeService()` anywhere else.

```javascript
// container.js
const transactionRepo = new MongoTransactionRepository()
const smsService = process.env.NODE_ENV === 'test'
  ? new MockSmsService()
  : new Msg91SmsService({ authKey: env.MSG91_AUTH_KEY })

const createTransactionUseCase = new CreateTransactionUseCase({
  transactionRepository: transactionRepo,
  branchRepository: branchRepo,
  smsService,
  auditService,
})

module.exports = { createTransactionUseCase, ... }
```

---

## React Native Standards

### 1. Feature-Based Imports Only

```javascript
// ✅ CORRECT — import from own feature or shared/
import { TransactionCard } from '../components/TransactionCard'
import { Button } from '@shared/components/Button'
import { formatCurrency } from '@shared/utils/formatters'

// ❌ BANNED — cross-feature imports
import { CustomerCard } from '../../customer/components/CustomerCard'
// If you need it in two features, move it to shared/
```

### 2. Theme — Never Hardcode Colors or Sizes

```javascript
// ✅ CORRECT — always use theme
const theme = useTenantTheme()
<View style={{ backgroundColor: theme.colors.primary }} />

// ❌ BANNED — hardcoded values
<View style={{ backgroundColor: '#1A56DB' }} />
<View style={{ padding: 16 }} />  // use theme.spacing.md
```

### 3. API Calls — Always in Feature api.js

```javascript
// ✅ CORRECT — each feature has api.js
// features/transaction/api.js
export const createTransaction = (data) => client.post('/transactions', data)

// ❌ BANNED — inline API calls in screens
const res = await axios.post('/api/transactions', data)  // in component
```

### 4. State Management Rules

- **Server state** (lists, transaction detail, dashboard): React Query / TanStack Query
  - `staleTime: 30_000` for financial data (never serve stale transaction status)
- **Global state** (auth, tenant, unread count): Zustand
- **Form state, modals, local UI**: `useState` — never put in Zustand

```javascript
// ✅ CORRECT — server state via React Query
const { data, isLoading, refetch } = useQuery({
  queryKey: ['transactions', tenantId, filters],
  queryFn: () => getTransactions(filters),
  staleTime: 30_000,
})

// ❌ BANNED — server state in Zustand (creates sync problems)
const { transactions, fetchTransactions } = useTransactionStore()
```

### 5. Component Rules

- One component per file
- Props destructured at the top, never `props.xxx` inline
- No business logic in components — extract to hooks
- Screen components: only layout + call hooks. Max 150 lines.

```javascript
// ✅ CORRECT — logic in hook
export function TransactionListScreen() {
  const { transactions, isLoading, filters, setFilter } = useTransactionList()
  return <FlatList data={transactions} ... />
}

// ❌ BANNED — logic in screen
export function TransactionListScreen() {
  const [transactions, setTransactions] = useState([])
  useEffect(() => { axios.get('/transactions').then(r => setTransactions(r.data)) }, [])
  ...
}
```

### 6. File Naming

```
Screens:         PascalCaseScreen.jsx    → TransactionListScreen.jsx
Components:      PascalCase.jsx          → TransactionCard.jsx
Hooks:           useCamelCase.js         → useTransactionList.js
API files:       api.js                  → features/transaction/api.js
Stores:          camelCaseStore.js       → authStore.js
Utils:           camelCase.js            → formatters.js
```

### 7. Navigation Rules

- Role check happens ONLY in `AppNavigator.jsx`
- Individual screens NEVER check roles to conditionally render navigation
- Deep link to a protected screen → AppNavigator redirects to login

---

## General Rules (Both Backend and Mobile)

### Comments

Write comments ONLY for the WHY, never the WHAT.

```javascript
// ✅ CORRECT — explains hidden constraint
// MongoDB findOneAndUpdate is atomic — prevents dual approval race condition
const updated = await Transaction.findOneAndUpdate(
  { tenantId, transactionId, approvalStatus: 'pending' },
  ...
)

// ❌ BANNED — explains the obvious
// Find the transaction and update its status
const updated = await Transaction.findOneAndUpdate(...)
```

### No Console.log in Production

Use structured logging (`pino` or `winston`) with log levels.
`console.log` is allowed only in scripts and dev seed files.

### Environment Variables

```javascript
// ✅ CORRECT — validated at startup, fail fast
// config/env.js validates all required vars at import time
// If JWT_SECRET is missing, server refuses to start

// ❌ BANNED — lazy access
process.env.JWT_SECRET  // scattered through files, fails at runtime
```

### Security: Input Sanitization

```javascript
// ✅ CORRECT — validate all inputs at HTTP boundary with Joi
// Domain code assumes input is already validated
// NEVER trust req.body directly in use-cases

// ❌ BANNED — validation inside use-cases or domain
// Validation belongs at the interface (HTTP) layer
```
