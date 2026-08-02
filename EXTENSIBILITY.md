# Extensibility Guide — Multi-Tenant SaaS

> How to extend the system for new tenants, new features, and new integrations
> without modifying existing code.

---

## 1. Tenant Branding System

### What Each Tenant Can Customize

```javascript
// Stored in Tenant.branding in MongoDB
{
  appName: "Mehta Money Transfer",        // Replaces "MoneyTransfer" in app
  tagline: "Trusted Since 1995",          // Shown on login screen
  logoUrl: "https://cdn.../mehta-logo.png",  // S3/Cloudinary URL
  faviconUrl: "https://cdn.../mehta-icon.png",
  primaryColor: "#C0392B",               // Overrides default blue
  secondaryColor: "#922B21",
  accentColor: "#E74C3C",
  supportEmail: "support@mehtatransfer.com",
  supportPhone: "+91 98765 43210",
}
```

### How It Flows to the Mobile App

```
Login API response includes:
{
  user: { ... },
  tenant: {
    companyName: "Mehta Money Transfer",
    branding: { primaryColor, logoUrl, appName, ... }
  }
}
     │
     ▼
authStore.js saves tenant branding after login
     │
     ▼
TenantThemeProvider.jsx reads it, merges with defaultTheme
     │
     ▼
useTenantTheme() hook exposes merged theme to all components
     │
     ▼
Component: const theme = useTenantTheme()
           <Image source={{ uri: theme.branding.logoUrl }} />
           <View style={{ backgroundColor: theme.colors.primary }} />
```

### Adding a New Branding Field

1. Add field to `TenantModel.js` → `branding.newField`
2. Add to `GET /auth/login` response (include in tenant payload)
3. Add to `TenantThemeProvider.jsx` merge logic
4. Use in components via `theme.branding.newField`
5. Zero changes to business logic or other components.

---

## 2. Feature Flags System

### Current Feature Flags (per Tenant)

```javascript
tenant.features = {
  customerOtpRequired: true,         // OTP before payout
  qrCodeEnabled: false,              // QR code on token (Phase 2)
  whatsappNotifications: false,       // WhatsApp integration (Phase 3)
  imageUploadEnabled: false,          // ID proof upload (Phase 3)
  transactionLimitsEnabled: false,    // Daily limits per branch/user
  loginTimeRestriction: true,         // 10am-8pm enforcement
  reportExportEnabled: true,          // Excel/PDF export
  multiDeviceLogin: false,            // Single device only
}
```

### Checking a Feature Flag

```javascript
// In a use-case — check before executing optional logic
class SendPaymentOtpUseCase {
  async execute({ tenantId, transactionId, userId }) {
    const tenant = await this.tenantRepo.findById(tenantId)

    if (!tenant.features.customerOtpRequired) {
      // Feature disabled for this tenant — skip OTP, go straight to payment
      return { otpRequired: false }
    }
    // ... OTP logic
  }
}
```

### Adding a New Feature Flag

1. Add boolean field to `TenantModel.js` → `features.myNewFeature: { type: Boolean, default: false }`
2. In the relevant use-case, check `tenant.features.myNewFeature`
3. Admin can toggle it via `PUT /settings` API
4. No code change needed to enable/disable per tenant.

---

## 3. SMS Provider Extensibility

The `ISmsService` port means swapping SMS providers requires zero use-case changes.

```javascript
// application/ports/ISmsService.js
class ISmsService {
  async sendOtp(mobileNumber, otp) { throw new Error('Not implemented') }
  async sendTransactionAlert(mobileNumber, message) { throw new Error('Not implemented') }
}

// Infrastructure adapters:
// infrastructure/services/sms/Msg91SmsService.js   — current provider
// infrastructure/services/sms/Fast2SmsSmsService.js — swap without touching use-cases
// infrastructure/services/sms/MockSmsService.js     — for tests

// To switch to Fast2SMS:
// In container.js, change ONE line:
const smsService = new Fast2SmsSmsService({ apiKey: env.FAST2SMS_API_KEY })
// Nothing else changes.
```

---

## 4. Notification Channel Extensibility

Current channels: In-app (Socket.IO), Push (FCM), SMS
Future channels: WhatsApp, Email

```javascript
// application/ports/INotificationService.js
class INotificationService {
  async notify({ tenantId, userId, type, title, body, referenceId }) { ... }
}

// Adding WhatsApp: Create infrastructure/services/notification/WhatsappNotificationService.js
// Register in container.js
// Add feature flag: tenant.features.whatsappNotifications
// The INotificationService is a facade — all channel routing happens inside the adapter
// Use-cases never change.
```

---

## 5. Report Export Extensibility

Current: Excel export
Future: PDF, CSV, custom report formats

```javascript
// application/ports/IReportExporter.js
class IReportExporter {
  async exportTransactions(transactions, format) { ... }
}

// infrastructure/services/export/ExcelReportExporter.js  — current
// infrastructure/services/export/PdfReportExporter.js    — add when needed
// infrastructure/services/export/CsvReportExporter.js

// ReportController reads `?format=excel|pdf|csv`
// Selects the right exporter from container
// Use-case (data fetching) never changes.
```

---

## 6. Commission Engine Extensibility

Current: flat fee or percentage (global per tenant)
Future: per-branch rates, per-route rates, tiered rates

The `Commission` value object in `domain/value-objects/Commission.js`
encapsulates all commission logic. To add a new commission type:

1. Add new type to `CommissionType` enum
2. Add calculation logic in `Commission.js`
3. Update `tenant.settings.commissionType` to accept new value
4. Zero changes in use-cases — they call `Commission.calculate(amount, settings)`.

---

## 7. Role/Permission Extensibility

Current roles: super_admin, admin, head_office, branch
Future: sub-admin, branch_manager, view-only, etc.

```javascript
// Adding a new role:
// 1. Add to ROLES constant in config/constants.js
// 2. Add to User model enum
// 3. Add permission rules in authorize.js middleware
// 4. Add navigation in mobile AppNavigator.jsx

// The authorize middleware uses a declarative rule set:
const PERMISSIONS = {
  'transaction:create': ['admin', 'branch', 'branch_manager'],  // add new role here
  'transaction:approve': ['head_office'],
  'branch:manage': ['admin'],
}
```

---

## 8. What to Do When a Tenant Needs a Custom Flow

1. **Feature flag first**: Can it be gated behind `tenant.features.customFlow`?
2. **Config-driven**: Can it be driven by a new `tenant.settings.someValue`?
3. **Adapter variant**: Can you create a new infrastructure adapter and inject per tenant?
4. **Only as a last resort**: Tenant-specific conditional in a use-case — document why.

**Never fork the codebase for a tenant.** The entire system is designed to
serve all tenants from one codebase via configuration and flags.

---

## 9. Database Migration Strategy

When you add a new field to an existing model:

```javascript
// Add with a safe default — existing documents get null/false/0
// This is non-breaking in MongoDB (schema-less)
newField: { type: String, default: null }

// Run a one-time migration script if you need to backfill:
// scripts/migrations/add-newField-to-all-tenants.js
// Always test on a copy of production data first.
```

When you add a new index:
```javascript
// Run createIndex() in a migration script — not during app startup
// Large collections: use background index build
// In MongoDB Atlas: background is default for rolling index builds
```
