# Payment Integration Specification

**Audience:** Payment integration team (Razorpay or other provider).
**Goal:** Replace the dev stub at `src/lib/payment-provider.ts` with a real
provider integration without changing any other file in the application.

## TL;DR

You implement **one function** and **two webhook endpoints already exist** for
your provider's server-to-server callbacks. Everything else in the app
(checkout, finalisation, invoice generation, email) is already wired and tested.

---

## 1. The function you replace

**File:** `src/lib/payment-provider.ts`
**Function:** `processPayment(req: PaymentRequest): Promise<PaymentResult>`

```ts
interface PaymentRequest {
  subscriptionId: string;       // for receipt linkage
  amount: number;               // INR rupees (multiply ×100 for paise)
  currency: string;             // "INR"
  customerAccountId: string;    // for idempotency keying
  idempotencyKey?: string;      // pass to Razorpay's idempotency support
  description: string;          // free-text receipt line
}

interface PaymentResult {
  status: "CAPTURED" | "AUTHORIZED" | "FAILED";
  paymentRef: string;           // your provider's order_id or txn ref
  providerPaymentId?: string;   // payment_id from Razorpay
  errorCode?: string;
  errorDescription?: string;
}
```

### Current behaviour (dev stub)

- `PAYMENT_STUB=true` (default in non-prod) → returns `CAPTURED` immediately.
- `PAYMENT_STUB=false` → throws *"Razorpay integration pending"*.

### What your replacement must do

1. Create a Razorpay order with `amount * 100` paise.
2. Either:
   - **Synchronous flow** (server-side capture for B2B/UPI mandates): call the
     Razorpay capture API and return `CAPTURED`.
   - **Async flow** (most common — Razorpay Checkout JS): create the order,
     return `AUTHORIZED` immediately. The browser opens Razorpay Checkout,
     user pays, Razorpay sends a webhook → you call our success endpoint
     (Section 3 below).
3. Persist the Razorpay `order_id` in `paymentRef` and (when available) the
   `payment_id` in `providerPaymentId`.

The rest of the app does not care which flow you choose — finalisation logic
runs whenever the invoice is finalised, whether synchronously after `processPayment`
returns CAPTURED or asynchronously via the webhook endpoint.

---

## 2. Environment variables

Add to `.env`:

```
# Switch to disable the dev stub once real integration is live
PAYMENT_STUB=false

# Razorpay credentials (your provider, your key management)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Bearer token your webhook handler must include when calling our endpoints
INTERNAL_PAYMENT_SECRET=<long-random-string>
```

`INTERNAL_PAYMENT_SECRET` is verified by the two webhook endpoints below. If the
env var is unset, the check is skipped (development convenience).

---

## 3. Webhook endpoints (already implemented)

Your Razorpay webhook handler should:
1. Verify Razorpay signature (you own this).
2. Look up which Invoice the order_id corresponds to (you persist this mapping
   when creating the Razorpay order).
3. Call our internal endpoint below with the invoice id.

### POST /api/payments/internal/payment-success

Marks Invoice → PAID, Payment → CAPTURED, generates the PDF, syncs the legacy
`SubscriptionPlan` rows. Idempotent — replays return `ALREADY_PAID`.

**Headers:**
```
Authorization: Bearer <INTERNAL_PAYMENT_SECRET>
Content-Type: application/json
```

**Body:**
```json
{
  "invoiceId": "clxyz...abc",
  "providerPaymentId": "pay_NhSomeId",
  "providerSignature": "abc123hexsig"
}
```

**Response (200):**
```json
{ "data": { "invoiceId": "clxyz...abc", "invoiceNumber": "INV-2026-0042", "status": "PAID" } }
```

`status` is `PAID` on first call, `ALREADY_PAID` on replays.

### POST /api/payments/internal/payment-failed

Marks Invoice + Payment as FAILED with provider error details. Subscription
changes (cycleEnd extension, tier upgrade) made at checkout time are **not
rolled back** — they will naturally expire at cycleEnd if not retried.

**Body:**
```json
{
  "invoiceId": "clxyz...abc",
  "errorCode": "BAD_REQUEST_ERROR",
  "errorDescription": "Card declined"
}
```

**Response (200):**
```json
{ "data": { "invoiceId": "clxyz...abc", "status": "FAILED" } }
```

---

## 4. Checkout flow (how it all fits)

```
Customer clicks "Renew" / "Add Module" / "Upgrade Tier"
                    │
                    ▼
   POST /api/settings/subscription/renew/checkout
                    │
                    ├── Build quote (via computeQuote)
                    ├── Apply ModuleSubscription updates
                    ├── Create Invoice (DRAFT) + Payment (CREATED)
                    ├── Call processPayment()  ← YOU IMPLEMENT THIS
                    │       │
                    │       ▼
                    │   ┌────────────────────────────┐
                    │   │ Razorpay order + checkout   │
                    │   │  (sync OR async via webhook)│
                    │   └────────────────────────────┘
                    │       │
                    │       ▼ on CAPTURED
                    ▼
   finalizeInvoice() runs (PDF, sync, email)
                    │
                    ▼
   Return { invoiceNumber, paid:true, redirectUrl } to client
```

**Async webhook variant:**
1. `processPayment()` returns `AUTHORIZED` (not `CAPTURED`).
2. Invoice stays DRAFT, Payment stays CREATED.
3. Customer pays in Razorpay Checkout → Razorpay webhook → your handler →
   POST `/api/payments/internal/payment-success` with the invoice id.
4. `finalizeInvoice()` runs.

---

## 5. What you do NOT need to build

- ✅ Quote computation (`src/lib/pricing.ts`) — already integrated everywhere
- ✅ Invoice numbering (`src/lib/invoice-number.ts`) — `INV-YYYY-0042` format
- ✅ Invoice PDF generation (`src/lib/invoice-pdf.ts`) — pdfkit-based with GST split
- ✅ Tier limits / module access updates (`src/lib/subscription-plan-sync.ts`)
- ✅ Customer-side UI (renew page wired and tested end-to-end)
- ✅ Invoice download (`/api/settings/subscription/invoices/[id]/pdf`)
- ✅ All the bookkeeping in `finalizeInvoice()` and `markInvoiceFailed()`

---

## 6. Sample Razorpay implementation skeleton

```ts
// Replace src/lib/payment-provider.ts

import Razorpay from "razorpay";
import { randomUUID } from "crypto";
import type { PaymentRequest, PaymentResult } from "./payment-provider"; // export the types too

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  if (process.env.PAYMENT_STUB === "true") {
    // Keep dev shortcut
    return { status: "CAPTURED", paymentRef: `STUB-${randomUUID()}`, providerPaymentId: `stub_pay_${Date.now()}` };
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(req.amount * 100), // paise
      currency: req.currency,
      receipt: req.idempotencyKey ?? `ord_${randomUUID()}`,
      notes: {
        subscriptionId: req.subscriptionId,
        customerAccountId: req.customerAccountId,
        description: req.description,
      },
    });

    // Async flow: return AUTHORIZED, browser opens Razorpay Checkout, webhook
    // hits our /payment-success endpoint after user pays.
    return {
      status: "AUTHORIZED",
      paymentRef: order.id,
    };
  } catch (e: any) {
    return {
      status: "FAILED",
      paymentRef: "",
      errorCode: e.error?.code ?? "UNKNOWN",
      errorDescription: e.error?.description ?? e.message,
    };
  }
}
```

The browser-side Razorpay Checkout integration belongs in `RenewPage`'s
`proceedToPayment` function — pass it the `paymentRef` (order_id) returned
from `processPayment`. On `handler` success, POST to your webhook handler
which then calls our `/payment-success` endpoint.

---

## 7. Test mode handover

When you're ready to test, set:
```
PAYMENT_STUB=false
RAZORPAY_KEY_ID=rzp_test_<test-key>
RAZORPAY_KEY_SECRET=<test-secret>
RAZORPAY_WEBHOOK_SECRET=<test-webhook-secret>
INTERNAL_PAYMENT_SECRET=<random-32-char-string>
```

Use Razorpay's [test cards](https://razorpay.com/docs/payments/payments/test-card-details/)
(`4111 1111 1111 1111` etc.) to verify the full flow.

---

## 8. Smoke test

`scripts/smoke-test-renew-checkout.ts` exercises the full path with
`PAYMENT_STUB=true`. After your integration is live, run the same script
with `PAYMENT_STUB=false` and Razorpay test keys — it should still pass
end-to-end (replace the `processPayment` call in the script's harness, or
run the actual HTTP route via curl).

---

## 9. Open questions for the payment team

| Question | Default if unanswered |
|---|---|
| Sync (capture inline) or Async (webhook) flow? | Async (Razorpay-recommended) |
| Subscription auto-renew via Razorpay Subscriptions API? | Out of scope for this hand-off; we'll handle via cron + processPayment |
| Refunds on cancellation within X days? | Not in scope; you'd extend `processPayment` with a `refund(paymentId)` companion |
| 3DS / OTP handling? | Provided by Razorpay Checkout; nothing for us |
| Webhook retry / dedupe? | Our endpoints are idempotent — feel free to retry |

Reach out at `support@verifai.com` for clarifications.
