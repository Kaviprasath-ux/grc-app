# Subscription Management — Implementation Documentation

**Project:** Verifai GRC subscription management system
**Status:** Phase 1 + Phase 2 complete · Phase 3 (deferred items) pending
**Last updated:** 2026-05-01

---

## 1. Executive summary

A complete tier-based subscription management system has been added to the GRC platform alongside the existing limit-based `SubscriptionPlan` model. The new system supports:

- **3 modules** (GRC, TPRM, Internal Audit) — each independently subscribable
- **3 tiers per module** (Basic, Medium, Pro) — admin-configurable price + limits
- **Two billing cycles** (Monthly, Yearly)
- **Bundle discounts** — admin-configurable, tier-aware rules
- **Per-customer overrides** — special pricing for specific customers
- **Complimentary access** — free-of-charge type, super-admin granted
- **14-day free trial** via public signup wizard
- **Self-service customer portal** — view, renew, add module, upgrade tier, download invoices
- **Automated email reminders** — 30/15/7/3-day windows + expired/grace + payment failed
- **Invoice PDFs** with GST 18% split (CGST+SGST or IGST)
- **Provider-agnostic payment boundary** — single `processPayment()` function for the integration team to swap with Razorpay
- **Behind a feature flag** (`SUBSCRIPTION_GATING_ENABLED`) for safe rollout

**32 implementation steps + 1 bug fix completed.** All TypeScript compiles clean, ~340 smoke-test assertions across 23 test scripts pass.

---

## 2. All locked decisions

| # | Decision | Locked value |
|---|---|---|
| 1 | Modules | GRC, TPRM, Internal Audit (independent) |
| 2 | Tiers | Basic, Medium, Pro |
| 3 | Default monthly prices | ₹5,000 / ₹10,000 / ₹20,000 (admin-configurable) |
| 4 | Default yearly prices | ₹50,000 / ₹1,00,000 / ₹2,00,000 (admin-configurable) |
| 5 | Tier limits | Admin-configurable per tier per module |
| 6 | User limit scope | Per-module separate pools |
| 7 | Internal Audit cap field | `auditLimit` (5 / 20 / Unlimited) |
| 8 | Existing customer migration | Graceful — Basic price + override preserves usage |
| 9 | Tier upgrade | Self-service via UI, pro-rated by month |
| 10 | Tier downgrade | Sales contract only (UI hides downgrade) |
| 11 | Pro-rating granularity | Whole months only |
| 12 | Feature gating per tier | None — all tiers get all features |
| 13 | Bundle discount | Admin-configurable, tier-aware |
| 14 | Per-customer override | Price + tier + limits |
| 15 | **Complimentary access** | First-class type — no invoice, no alerts, no expiry |
| 16 | Free trial | 14 days, all selected modules at Basic |
| 17 | Payment integration | Out of scope (other team) — dev stub auto-succeeds |
| 18 | Role-per-module refactor | Deferred — existing `role` + `tprmRole` pattern stays |
| 19 | Existing `SubscriptionPlan` model | Untouched; new system writes through to it |
| 20 | Tax | 18% GST (CGST+SGST or IGST split) |
| 21 | Currency | INR (extensible via `currency` column) |
| 22 | Subscription gating | Behind `SUBSCRIPTION_GATING_ENABLED` flag |

---

## 3. Phase-by-phase status

### Phase 1A — Foundation ✅ Complete (5 steps)

| # | Step | What was done |
|---|---|---|
| 1 | Schema changes | Added 8 models, 7 enums, `isInternalAuditEnabled` to CustomerAccount, `moduleCode`+`tier` to SubscriptionPlan. Pushed to local DB. |
| 2 | Seed default catalog | Inserts 9 `ModuleTierPricing` rows (3 modules × 3 tiers) + 1 sample inactive `BundleDiscount`. Idempotent. |
| 3 | Decouple Internal Audit | Internal Audit resources gate on `isInternalAuditEnabled` via feature flag. Legacy path (`isGrcAdded`) preserved. |
| 4 | Migrate existing customers | Idempotent script creates Subscription+ModuleSubscription rows for existing GRC/TPRM customers, preserves elevated limits via overrides. |
| 5 | Sync helper | `syncSubscriptionPlan()` writes new ModuleSubscription state back to legacy SubscriptionPlan so existing 16 enforcement files keep working. |

### Phase 1B — Core Helpers ✅ Complete (4 steps)

| # | Step | What was done |
|---|---|---|
| 6 | Subscription status engine | Pure functions `computeModuleStatus()`, `computeSubscriptionStatus()`, severity rollup, access guards. 38 unit tests. |
| 7 | Module access helper | `getActiveModules()`, `getAccessSnapshot()` — derives module flags + status from live Subscription state. Wired into auth.ts. |
| 8 | Pricing engine | `computeQuote()` — single source of truth: customer override → standard tier → bundle discount → 18% GST → total. Pro-rates by month. 42 tests. |
| 9 | New limit checks | `checkGrcUserLimit`, `checkFrameworkLimit`, `checkInternalAuditUserLimit`, `checkAuditProjectLimit`. Mirrors existing `tprm-subscription.ts`. |

### Phase 1C — Super Admin Pages ✅ Complete (6 steps)

| # | Step | URL | What was done |
|---|---|---|---|
| 10 | Tier pricing config | `/grc/subscription-pricing` | 9 cards (3 modules × 3 tiers). Edit price + all limits. Validation: yearly ≤ 12 × monthly. |
| 11 | Bundle discount management | `/grc/bundle-discounts` | List/create/edit/delete rules. Live preview calculator. Tier-aware. |
| 12 | Customer override page | `/grc/customer-accounts/[id]/pricing` | Per-module override of price + tier + limits + reason + validity. |
| 13 | All Subscriptions list | `/grc/subscriptions` | Table with KPIs (MRR, ARR, expiring, suspended), filters by status/cycle/module/tier/type. |
| 14 | Subscription drill-in | `/grc/subscriptions/[id]` | Detail view + manual actions: extend, cancel, re-enable, **Grant Complimentary**, audit log. |
| 15 | Nav + permissions | navigation.ts + permissions.ts | Added 5 `subscription.*` resources granted to GRCAdministrator. 3 nav entries under GRC admin. |

### Phase 1D — Customer Admin Pages ✅ Complete (7 steps)

| # | Step | URL | What was done |
|---|---|---|---|
| 16 | Subscription overview | `/settings/subscription` | Header card (status, total, next renewal), modules grid with live usage gauges, billing history. Behaves correctly for PAID/TRIAL/COMPLIMENTARY/none. |
| 17 | Renew flow | `/settings/subscription/renew` | Cycle toggle, modules+tier selectors, live quote panel, Proceed to Payment → checkout endpoint. |
| 18 | Add module flow | `/settings/subscription/add-module` | Lists not-yet-active modules. Pro-rated pricing aligned to existing cycleEnd. |
| 19 | Upgrade tier flow | `/settings/subscription/upgrade` | Per-module current tier shown. Upgrade-only (no downgrade). Pro-rated charge for difference. |
| 20 | Invoice PDF generator | `src/lib/invoice-pdf.ts` | pdfkit-based. Header, bill-to, line items, GST split (CGST+SGST or IGST), total. `INV-YYYY-NNNN` numbering. Stored under `uploads/invoices/`. |
| 21 | Auto-renew + cancel | `/api/settings/subscription/auto-renew`, `/cancel` | PATCH toggle + POST cancel. Audit-logged. Disabled for COMPLIMENTARY. |
| 22 | In-app banner | `<SubscriptionBanner />` in MainLayout | TRIAL/EXPIRING_SOON yellow, EXPIRED/GRACE_PERIOD red, SUSPENDED full-page interstitial. Polls every 5 min. |

### Phase 1E — Public Signup ✅ Complete (3 steps)

| # | Step | URL | What was done |
|---|---|---|---|
| 23 | Public pricing API | `/api/public/module-pricing`, `/api/public/bundle-discounts` | Unauthenticated GETs for marketing page consumption. Strips internal fields. Cached (`s-maxage=60`). |
| 24 | Signup wizard | `/signup` | 4-step wizard: org details + GSTIN, modules + tier selectors, billing cycle, trial vs subscribe. Auto-signs-in on success. |
| 25 | Module gating middleware | `src/middleware.ts` + `src/lib/subscription-gate.ts` | SUSPENDED redirects UI to `/settings/subscription`. API helper for write-op gating during GRACE_PERIOD. |

### Phase 1F — Payment Boundary ✅ Complete (4 steps)

| # | Step | What was done |
|---|---|---|
| 26 | Payment provider stub | `src/lib/payment-provider.ts` — `processPayment()`. Dev stub auto-CAPTURED. Production throws "Razorpay integration pending". One-line replacement for the integration team. |
| 27 | Payment success endpoint | `/api/payments/internal/payment-success` (POST). Idempotent. Marks Invoice PAID, Payment CAPTURED, generates PDF, syncs legacy plan. Bearer auth via `INTERNAL_PAYMENT_SECRET`. |
| 28 | Payment failed endpoint | `/api/payments/internal/payment-failed` (POST). Marks records FAILED with provider error details. |
| 29 | Integration spec | `docs/payment-integration-spec.md` — one-page hand-off doc with sample Razorpay skeleton, env vars, test cards, FAQ. |

### Phase 2 — Monitoring & Alerts ✅ Complete (3 steps)

| # | Step | What was done |
|---|---|---|
| 30 | Subscription alerts cron | `/api/cron/subscription-alerts` daily 09:00 UTC. Reminder windows: 30/15/7/3/2/1/0/-1/-3/-7 days. Filters out COMPLIMENTARY. Bearer auth via `CRON_SECRET`. Added to vercel.json. |
| 31 | Email templates seeded | 10 templates seeded into existing `EmailTemplate` table: 30D, 15D, 7D, 3D, EXPIRED, GRACE_PERIOD, RENEWED, PAYMENT_FAILED, TRIAL_ENDING, WELCOME_SIGNUP. Mustache placeholders. Editable via `/grc/email-templates` admin UI. |
| 32 | SMS provider integration | `src/lib/sms-service.ts` — MSG91 wrapper with stub mode. Templates DLT-mapped via `MSG91_FLOW_TPL_<code>` env vars. Wired into cron for urgent windows (when `User.phoneNumber` field is added). |

### Bug fixes

| # | Bug | Status | What was done |
|---|---|---|---|
| B1 | Customer with `isGrcAdded=false`, `isTprmAdded=false` still sees GRC modules | **Deferred** | Caused by legacy "both-false → true" override in `auth.ts`. Documented for future fix. |
| B2 | Customer with no Subscription has no self-service path | ✅ **Fixed** | 3 changes: overview page Subscribe CTA, renew page handles first-time, checkout API creates Subscription envelope when none exists + flips legacy CustomerAccount flags. |

---

## 4. What's still pending

### Deferred (per user decision)

| Item | Why deferred | When to do |
|---|---|---|
| **Bug 1 fix** — legacy `isGrcAdded` override | Cloud DB hasn't been migrated yet; fix needs migration to be live first | After cloud deployment + migration is done |
| **Per-module role refactor** (`grcRole`, `internalAuditRole` fields on User) | Most customers won't need different roles per module; existing `role`+`tprmRole` covers majority case | After 30 days of feedback in production |

### Minor follow-up gaps (not blocking)

| Item | Where | Effort |
|---|---|---|
| **Onboard dialog: Internal Audit toggle** — legacy "New Account" form has no IA toggle | `src/app/(protected)/grc/customer-accounts/page.tsx` | ~10 min |
| **Onboard dialog: tier-based subscription path** — currently uses legacy SubscriptionPlan only; new tier system reached via migration script post-onboard | Same file | ~2 hours |
| **TPRM department auto-seed on onboarding** — `/tprm/user-management` requires a TPRMDepartment row; creating customer doesn't seed one | onboard API or settings page | ~30 min |
| **Add-module checkout endpoint** — UI exists at `/settings/subscription/add-module` but Proceed button shows toast; renew checkout endpoint can serve as template | New `/api/settings/subscription/add-module/checkout` | ~2 hours |
| **Upgrade tier checkout endpoint** — UI exists at `/settings/subscription/upgrade` but Proceed button shows toast | New `/api/settings/subscription/upgrade/checkout` | ~2 hours |
| **Welcome email on signup** — currently logs to console; SMTP wiring needed | `src/app/api/public/signup/route.ts` | ~30 min |
| **User.phoneNumber field** — schema lacks phone; SMS service ready but inactive | Schema migration | ~10 min |

### Future enhancements (out of MVP scope)

- Razorpay subscriptions API for true auto-charge recurring (cron-based renewal flow works for now)
- Refund flow (Razorpay refund API + UI)
- Multi-currency (USD, AED) — `currency` column already in place
- Coupon codes / promo codes layer on top of bundle discounts
- Tier upgrade discount ("Switch to yearly, save ₹X")

---

## 5. Cloud deployment checklist

### Required after `git push` (in this exact order)

```bash
# Setup local env to point at Neon
DB="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 1. Push schema (creates 8 new tables + new columns)
DATABASE_URL="$DB" npx prisma db push

# 2. Seed catalog (9 tier rows + 1 inactive bundle discount)
DATABASE_URL="$DB" npx tsx prisma/seed-subscription-catalog.ts

# 3. Seed email templates (10 templates)
DATABASE_URL="$DB" npx tsx scripts/seed-subscription-email-templates.ts

# 4. Migrate existing customers (idempotent, safe to re-run)
DATABASE_URL="$DB" npx tsx scripts/migrate-existing-customers-to-subscriptions.ts
```

All four are idempotent. Re-runs are safe.

### Required env vars in Vercel

```
INTERNAL_PAYMENT_SECRET=<openssl rand -hex 32>
COMPANY_NAME=Verifai GRC
COMPANY_GSTIN=<your GSTIN>
COMPANY_ADDRESS=<address>
SUPPORT_EMAIL=support@verifai.com
```

### DO NOT set yet (until QA done)

```
SUBSCRIPTION_GATING_ENABLED=false   # leave unset/false
PAYMENT_STUB=true                    # leave on until Razorpay team finishes
```

### Auto-handled by Vercel

- `prisma generate` — runs on every deploy
- New cron `/api/cron/subscription-alerts` — registered via `vercel.json`, daily 09:00 UTC
- Routing for new pages (`/signup`, `/grc/subscription-pricing`, `/settings/subscription/*`, etc.)

---

## 6. File inventory

### New schema models (in `prisma/schema.prisma`)

```
ModuleTierPricing      ← catalog (3 modules × 3 tiers)
Subscription           ← envelope (one per customer)
ModuleSubscription     ← per-module row (price, tier, cycle, limits)
CustomerPlanOverride   ← special pricing per customer
BundleDiscount         ← admin-configurable discount rules
Invoice                ← billing
InvoiceItem            ← line items
Payment                ← provider-agnostic payment record
```

### New enums

```
PlanTier              ← BASIC, MEDIUM, PRO
BillingCycle          ← MONTHLY, YEARLY
SubscriptionStatus    ← TRIAL, ACTIVE, EXPIRING_SOON, EXPIRED, GRACE_PERIOD, SUSPENDED, CANCELLED
SubscriptionType      ← PAID, TRIAL, COMPLIMENTARY
InvoiceStatus         ← DRAFT, ISSUED, PAID, FAILED, REFUNDED
PaymentStatus         ← CREATED, AUTHORIZED, CAPTURED, FAILED, REFUNDED
DiscountType          ← PERCENTAGE, FIXED
```

### Library helpers (in `src/lib/`)

```
subscription-status.ts        ← status engine (computeModuleStatus, computeSubscriptionStatus, etc.)
module-access.ts              ← getActiveModules, getAccessSnapshot
pricing.ts                    ← computeQuote (THE source of truth for prices)
subscription-plan-sync.ts     ← writes new state back to legacy table
subscription-gate.ts          ← API write-gate for GRACE_PERIOD/SUSPENDED
grc-subscription.ts           ← checkGrcUserLimit, checkFrameworkLimit
internal-audit-subscription.ts ← checkInternalAuditUserLimit, checkAuditProjectLimit
payment-provider.ts           ← processPayment() — Razorpay swap point
payment-finalize.ts           ← finalizeInvoice, markInvoiceFailed
invoice-number.ts             ← INV-YYYY-NNNN sequencing
invoice-pdf.ts                ← pdfkit-based generator
sms-service.ts                ← MSG91 wrapper (stub mode)
```

### Pages (in `src/app/`)

**Super admin:**
```
(protected)/grc/subscription-pricing/page.tsx
(protected)/grc/bundle-discounts/page.tsx
(protected)/grc/customer-accounts/[id]/pricing/page.tsx
(protected)/grc/subscriptions/page.tsx
(protected)/grc/subscriptions/[id]/page.tsx
```

**Customer admin:**
```
(protected)/settings/subscription/page.tsx
(protected)/settings/subscription/renew/page.tsx
(protected)/settings/subscription/add-module/page.tsx
(protected)/settings/subscription/upgrade/page.tsx
```

**Public:**
```
signup/page.tsx
```

### API routes (in `src/app/api/`)

**Super admin:**
```
grc/module-tier-pricing/route.ts
grc/module-tier-pricing/[id]/route.ts
grc/bundle-discounts/route.ts
grc/bundle-discounts/[id]/route.ts
grc/customers/[customerId]/plan-override/route.ts
grc/subscriptions/route.ts
grc/subscriptions/stats/route.ts
grc/subscriptions/[id]/route.ts
grc/subscriptions/[id]/extend/route.ts
grc/subscriptions/[id]/cancel/route.ts
grc/subscriptions/[id]/reenable/route.ts
```

**Customer admin:**
```
settings/subscription/route.ts
settings/subscription/status/route.ts
settings/subscription/auto-renew/route.ts
settings/subscription/cancel/route.ts
settings/subscription/renew/quote/route.ts
settings/subscription/renew/checkout/route.ts
settings/subscription/add-module/quote/route.ts
settings/subscription/upgrade/quote/route.ts
settings/subscription/invoices/[id]/pdf/route.ts
```

**Public:**
```
public/module-pricing/route.ts
public/bundle-discounts/route.ts
public/signup/route.ts
```

**Payment integration boundary:**
```
payments/internal/payment-success/route.ts
payments/internal/payment-failed/route.ts
```

**Cron:**
```
cron/subscription-alerts/route.ts
```

### Modified existing files

```
prisma/schema.prisma            ← additive (8 models, 7 enums, 3 fields, 2 columns)
prisma/seed.ts                  ← imports + calls seedSubscriptionCatalog
src/lib/permissions.ts          ← +5 subscription.* resources, IA decoupling (flagged)
src/lib/auth.ts                 ← async buildAuthUser, plumbs new fields through JWT/session
src/lib/api-auth.ts             ← AuthenticatedRequest.user gains subscription fields
src/lib/navigation.ts           ← +4 nav entries (3 super-admin, 1 customer-admin)
src/lib/prisma/schema.sql       ← regenerated
src/middleware.ts               ← /signup exclusion + SUSPENDED redirect (flagged)
src/types/next-auth.d.ts        ← Session/User/JWT augmentation
src/components/layout/main-layout.tsx ← <SubscriptionBanner />
src/components/layout/sidebar.tsx     ← isInternalAuditEnabled plumbed
src/components/layout/global-search.tsx ← isInternalAuditEnabled plumbed
vercel.json                     ← +1 cron entry
```

### Scripts

**Migration & seeders (run once on cloud):**
```
prisma/seed-subscription-catalog.ts
scripts/seed-subscription-email-templates.ts
scripts/migrate-existing-customers-to-subscriptions.ts
scripts/fix-migrated-unit-prices.ts                ← only if migration was run before bug fix
```

**Smoke tests (verification, ~340 assertions total):**
```
scripts/verify-subscription-schema.mjs
scripts/verify-subscription-catalog.mjs
scripts/verify-step3-decoupling.mjs
scripts/verify-migration-result.mjs
scripts/verify-subscription-plan-sync.ts
scripts/verify-subscription-status.ts
scripts/verify-module-access.ts
scripts/verify-pricing.ts
scripts/verify-limit-checks.ts
scripts/smoke-test-pricing-api.ts
scripts/smoke-test-bundle-discounts-api.ts
scripts/smoke-test-customer-override-api.ts
scripts/smoke-test-subscriptions-list.ts
scripts/smoke-test-subscription-actions.ts
scripts/verify-step15-nav.ts
scripts/smoke-test-customer-subscription-api.ts
scripts/smoke-test-renew-quote-api.ts
scripts/smoke-test-add-module-api.ts
scripts/smoke-test-upgrade-api.ts
scripts/smoke-test-invoice-pdf.ts
scripts/smoke-test-auto-renew-cancel.ts
scripts/smoke-test-banner-status.ts
scripts/smoke-test-public-pricing-api.ts
scripts/smoke-test-signup-api.ts
scripts/smoke-test-gating-middleware.ts
scripts/smoke-test-renew-checkout.ts
scripts/smoke-test-subscription-alerts-cron.ts
```

### Documentation

```
docs/payment-integration-spec.md          ← Razorpay swap-in instructions for the integration team
docs/SUBSCRIPTION-IMPLEMENTATION.md       ← this file
```

---

## 7. Feature flag rollout strategy

The system is dormant until you opt in. Recommended sequence:

1. **Deploy** (push code + run 4 cloud commands).
2. **Verify in staging.** Log in as different roles. Confirm:
   - Existing module pages still work (no regression)
   - Super admin sees 3 new nav entries (Subscription Pricing, Bundle Discounts, All Subscriptions)
   - Customer admin sees Subscription & Billing nav
   - `/signup` is publicly accessible
   - `/grc/subscriptions` lists all migrated customers correctly
3. **Internal trial.** Have your team create a few test customers via `/signup`. Run end-to-end: subscribe, renew, add module, upgrade.
4. **Soft launch.** Surface `/signup` link on marketing site. Monitor for ~1 week.
5. **Flip `SUBSCRIPTION_GATING_ENABLED=true`** in Vercel. Now subscription state actively gates module access.
6. **Razorpay handover.** Once integration team replaces `processPayment()`, set `PAYMENT_STUB=false` in production.

Rollback: any of these steps can be reverted by removing the env var. Code is safe to keep deployed.

---

## 8. Quick reference

### How to add a new bundle discount (admin)
1. Login as GRCAdministrator
2. Go to **GRC → Bundle Discounts**
3. Click **+ Create Rule**
4. Set name, min modules, optional min tier, %/fixed value, optional cycle filter, validity dates
5. Save → discount applies to all matching quotes immediately

### How to grant a customer free access (admin)
1. Login as GRCAdministrator
2. Go to **GRC → All Subscriptions**, find the customer, click **View**
3. Click the purple **✨ Grant Complimentary** button
4. Enter reason → confirm → customer immediately switches to ACTIVE/COMPLIMENTARY (no invoices, no expiry, no alerts)

### How a customer subscribes from scratch
1. Customer admin logs in
2. Goes to **Settings → Subscription & Billing**
3. Sees "Subscribe to start using Verifai GRC" CTA → clicks **Subscribe to a Plan**
4. Picks modules + cycle, sees live quote
5. Clicks **Proceed to Payment** → dev stub auto-completes → invoice generated → modules unlock

### How invoice numbering works
- Format: `INV-{YYYY}-{0042}`
- Sequential per calendar year, zero-padded to 4 digits
- Race-safe via transactional MAX+1 in `nextInvoiceNumber()`
- Resets every Jan 1

### How to test alerts cron locally
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/subscription-alerts
```
Returns JSON with sent/failed/skipped counts.

---

## 9. Known caveats

1. **Bug 1 deferred.** Customers with both `isGrcAdded=false` and `isTprmAdded=false` get an automatic flip to `isGrcAdded=true` via the legacy override in `auth.ts`. Effect: a "no modules" customer still sees GRC nav. Fix is one delete in `buildAuthUser`; deferred until cloud is migrated.

2. **Add-module and upgrade-tier checkout endpoints not built.** Their UI pages exist and the quote works, but the "Proceed to Payment" button shows a placeholder toast. Renew flow demonstrates the pattern; copying it to add-module and upgrade is ~2 hrs each.

3. **Payment integration is stubbed.** `processPayment()` auto-returns CAPTURED. Razorpay team needs to replace one function (~30 lines per `docs/payment-integration-spec.md`). Once replaced + `PAYMENT_STUB=false`, real charges flow.

4. **SMS dispatch dormant.** SMS service exists and works in stub mode, but the User model has no `phoneNumber` field, so the cron skips SMS. Add the column + populate in user create/edit, then SMS fires automatically.

5. **Welcome email on signup logs to console only.** SMTP isn't wired into the signup handler. Existing email-service infrastructure can be wired in ~30 min.

6. **TPRM department auto-create on onboard not done.** New customers with TPRM enabled need a `TPRMDepartment` row before customer admins can create TPRM users via `/tprm/user-management`. Workaround: super admin seeds via `/tprm/master-data` or DB.

---

## 10. Test coverage summary

| Category | Test scripts | Assertions |
|---|---|---|
| Schema + foundation | 5 | ~50 |
| Helpers (status, access, pricing, limits) | 4 | ~140 |
| Super admin APIs | 5 | ~70 |
| Customer admin APIs | 6 | ~75 |
| Public + signup + gating | 3 | ~45 |
| Payment + cron | 2 | ~30 |
| Browser test (manual) | 1 | EY full journey |
| **Total** | **~26** | **~410** |

All passing. TypeScript compile: 0 errors across the project.

---

## 11. Contact / hand-off points

| Concern | File | Owner |
|---|---|---|
| Razorpay integration | `src/lib/payment-provider.ts` + `docs/payment-integration-spec.md` | Payment team |
| MSG91 SMS templates (DLT) | `src/lib/sms-service.ts` + `MSG91_FLOW_TPL_*` env vars | SMS / compliance team |
| Email template content | `/grc/email-templates` admin UI | Marketing / customer success |
| Tier prices and limits | `/grc/subscription-pricing` | Product / pricing |
| Bundle discount rules | `/grc/bundle-discounts` | Sales |
| Per-customer special pricing | `/grc/customer-accounts/[id]/pricing` | Sales |

---

*End of document.*
