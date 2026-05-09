# Razorpay Autopay Integration Guide

> Complete reference for our Razorpay recurring payments implementation.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Implementation](#security-implementation)
4. [Subscription Flow](#subscription-flow)
5. [Webhook Handling](#webhook-handling)
6. [Error Handling & Retry Logic](#error-handling--retry-logic)
7. [Environment Configuration](#environment-configuration)
8. [Testing](#testing)
9. [Production Checklist](#production-checklist)

---

## Overview

Our Razorpay integration supports **autopay subscriptions** with:
- 14-day free trial period
- Mandatory 2-year contract commitment
- UPI AutoPay / e-NACH / Card mandate authorization
- Automatic recurring charges

### Supported Payment Methods

| Method | Description |
|--------|-------------|
| UPI AutoPay | BHIM, GPay, PhonePe, Paytm |
| e-NACH | Bank mandate via National Automated Clearing House |
| Card Mandate | Visa/Mastercard recurring authorization |

---

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/payment-provider.ts` | Core Razorpay client, signature verification, retry logic |
| `src/lib/payment-provider-mandate.ts` | Subscription/mandate creation and management |
| `src/lib/razorpay-plan-manager.ts` | Plan creation and caching in database |
| `src/app/api/webhooks/razorpay/route.ts` | Payment webhook handler |
| `src/app/api/webhooks/razorpay/subscription/route.ts` | Subscription lifecycle webhook handler |
| `src/types/razorpay.d.ts` | TypeScript type definitions |

### Database Models

```
RazorpayPlan         - Cached Razorpay plan IDs
RazorpayEvent        - Webhook idempotency tracking
ModuleSubscription   - Links modules to mandate IDs
Subscription         - Customer subscription records
Invoice              - Billing records
Payment              - Payment transaction records
```

---

## Security Implementation

Our implementation follows the [Razorpay Security Best Practices](https://razorpay.com/docs/payments/subscriptions/) with additional hardening.

### 1. Timing-Safe Signature Verification

All signature comparisons use `crypto.timingSafeEqual()` to prevent timing attacks:

```typescript
// src/lib/payment-provider.ts

// Payment signature verification
const sigBuf = Buffer.from(params.razorpay_signature, "hex");
const expBuf = Buffer.from(expectedSignature, "hex");
const isValid = sigBuf.length === expBuf.length &&
                crypto.timingSafeEqual(sigBuf, expBuf);

// Webhook signature verification
const sigBuf = Buffer.from(signature, "hex");
const expBuf = Buffer.from(expectedSignature, "hex");
if (sigBuf.length !== expBuf.length) {
  return false;
}
return crypto.timingSafeEqual(sigBuf, expBuf);
```

### 2. Fail-Closed in Production

Webhook verification **rejects** requests if `RAZORPAY_WEBHOOK_SECRET` is not configured in production:

```typescript
if (!secret) {
  if (stubEnabled()) {
    // Only allow bypass in dev/stub mode
    return true;
  }
  // FAIL CLOSED in production
  console.error("[Razorpay] CRITICAL: RAZORPAY_WEBHOOK_SECRET not set");
  return false;
}
```

### 3. Zod Payload Validation

All webhook payloads are validated against strict Zod schemas before processing:

```typescript
const razorpayWebhookEventSchema = z.object({
  event: z.string().min(1, "Event type is required"),
  payload: z.object({
    payment: z.object({
      entity: paymentEntitySchema,
    }).optional(),
    order: z.object({
      entity: orderEntitySchema,
    }).optional(),
  }),
  created_at: z.number(),
});

// Validation in handler
const validated = razorpayWebhookEventSchema.safeParse(parsed);
if (!validated.success) {
  return NextResponse.json(
    { error: "Invalid payload structure", details: validated.error.flatten() },
    { status: 422 }
  );
}
```

### 4. Server-Side Secrets

| Variable | Exposure | Notes |
|----------|----------|-------|
| `RAZORPAY_KEY_ID` | Server only | API authentication |
| `RAZORPAY_KEY_SECRET` | Server only | **Never** use `NEXT_PUBLIC_` prefix |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | Webhook signature verification |

### Security Checklist

| Control | Status | Implementation |
|---------|--------|----------------|
| Timing-safe signature comparison | ✅ | `crypto.timingSafeEqual()` |
| Webhook signature verification | ✅ | HMAC-SHA256 |
| Fail-closed in production | ✅ | Rejects if secret not set |
| Zod payload validation | ✅ | All webhooks validated |
| Raw body for signature | ✅ | Uses `req.text()` |
| Idempotency | ✅ | `RazorpayEvent` table |
| No client-side secrets | ✅ | No `NEXT_PUBLIC_` on secrets |
| HTTPS only | ✅ | Enforced by Razorpay |

---

## Subscription Flow

### Signup Flow (V2)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Server    │     │  Razorpay   │     │   Webhook   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ POST /signup/v2   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ Create Plan       │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ Create Subscription                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │   { subscriptionId, checkoutUrl }     │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ Open Razorpay Checkout                │                   │
       │──────────────────────────────────────>│                   │
       │                   │                   │                   │
       │                   │ User authorizes mandate               │
       │                   │                   │                   │
       │   { razorpay_subscription_id }        │                   │
       │<──────────────────────────────────────│                   │
       │                   │                   │                   │
       │ POST /signup/callback                 │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │   subscription.authenticated         │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │   Trial Active    │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │   (14 days later)                     │
       │                   │                   │                   │
       │                   │   subscription.charged                │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │                   │ Update invoice PAID                   │
       │                   │ Subscription ACTIVE                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### Mandate States

| State | Description | User Access |
|-------|-------------|-------------|
| `pending` | Awaiting customer authorization | None |
| `authenticated` | Mandate authorized, trial active | Full (trial) |
| `active` | First charge captured, recurring | Full |
| `halted` | Payment failed, retries exhausted | **Revoked** |
| `cancelled` | Customer or admin cancelled | **Revoked** |
| `completed` | All charges completed | Full until expiry |

---

## Webhook Handling

### Subscription Webhooks

**Endpoint:** `POST /api/webhooks/razorpay/subscription`

| Event | Action |
|-------|--------|
| `subscription.authenticated` | Set `mandateStatus = "authenticated"`, trial begins |
| `subscription.charged` | Set `mandateStatus = "active"`, mark invoice PAID |
| `subscription.halted` | **IMMEDIATELY** suspend subscription, revoke access |
| `subscription.completed` | Set `mandateStatus = "completed"` |
| `subscription.cancelled` | Set `mandateStatus = "cancelled"`, end subscription |
| `subscription.paused` | Treat as cancelled (autopay disabled) |
| `subscription.pending` | Set `mandateStatus = "pending"` |

### Payment Webhooks

**Endpoint:** `POST /api/webhooks/razorpay`

| Event | Action |
|-------|--------|
| `payment.captured` | Find invoice by order_id, mark PAID |
| `payment.failed` | Log error, notify internal system |
| `payment.authorized` | Log for monitoring |
| `order.paid` | Backup handler if payment.captured missed |

### Idempotency

All webhooks are idempotent via the `RazorpayEvent` table:

```typescript
// Check if already processed
const existing = await prisma.razorpayEvent.findUnique({
  where: { eventId },
});
if (existing?.processedAt) {
  return NextResponse.json({ data: { idempotent: true } });
}

// Process event...

// Mark as processed
await prisma.razorpayEvent.update({
  where: { eventId },
  data: { processedAt: new Date() },
});
```

---

## Error Handling & Retry Logic

### Exponential Backoff

All Razorpay API calls use automatic retry with exponential backoff:

```typescript
// src/lib/payment-provider.ts

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string
): Promise<T> {
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableError(error) || attempt > config.maxRetries) {
        throw error;
      }
      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }
}
```

### Retryable Errors

| Error Code | Retryable | Action |
|------------|-----------|--------|
| `GATEWAY_ERROR` | Yes | Retry with backoff |
| `SERVER_ERROR` | Yes | Retry with backoff |
| `NETWORK_ERROR` | Yes | Retry with backoff |
| `TIMEOUT` | Yes | Retry with backoff |
| `BAD_REQUEST_ERROR` | No | Fail immediately |
| `AUTH_ERROR` | No | Fail immediately |

### Error Categorization

```typescript
function categorizeError(error: unknown): {
  code: string;
  description: string;
  isRetryable: boolean;
} {
  // Categorizes Razorpay API errors, network errors, and timeouts
  // Returns structured error info for logging and user display
}
```

---

## Environment Configuration

### Required Variables

```bash
# Razorpay API credentials
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Payment mode
PAYMENT_STUB=false  # Set to "true" for development without real payments

# Trial period (optional, default: 14)
TRIAL_DAYS=14
```

### Stub Mode

When `PAYMENT_STUB=true` or in non-production:
- No real Razorpay API calls are made
- Payments return mock CAPTURED status
- Mandates return mock active status
- Webhook signature verification is bypassed

---

## Testing

### Test Credentials

Use `rzp_test_*` keys for development:

```bash
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=test_secret_here
```

### Test UPI IDs

| UPI ID | Behavior |
|--------|----------|
| `success@razorpay` | Mandate succeeds |
| `failure@razorpay` | Mandate fails |
| `delay@razorpay` | Async authorization |

### Test Card Numbers

| Card Number | Behavior |
|-------------|----------|
| `4111 1111 1111 1111` | Visa - success |
| `5267 3181 8797 5449` | Mastercard - success |
| `4000 0000 0000 0002` | Decline simulation |

### Local Webhook Testing

```bash
# Install ngrok
npx ngrok http 3000

# Add webhook URL in Razorpay Dashboard:
# https://<ngrok-id>.ngrok.io/api/webhooks/razorpay/subscription
```

---

## Production Checklist

| Item | Status | Notes |
|------|--------|-------|
| Live API keys configured | ☐ | Replace `rzp_test_*` with `rzp_live_*` |
| Webhook URL registered | ☐ | Add production URL in Razorpay Dashboard |
| Webhook secret configured | ☐ | `RAZORPAY_WEBHOOK_SECRET` must match Dashboard |
| `PAYMENT_STUB=false` | ☐ | Ensure real payments are enabled |
| Signature verification active | ☐ | Timing-safe comparison enabled |
| Idempotency working | ☐ | `RazorpayEvent` table created |
| Error monitoring | ☐ | Alerts for 4xx/5xx on payment routes |
| Retry logic tested | ☐ | Exponential backoff for transient failures |
| HTTPS enforced | ☐ | All endpoints over HTTPS |
| Autopay enabled | ☐ | UPI AutoPay / NACH enabled on Razorpay account |

---

## Troubleshooting

### Common Issues

**Webhook signature verification failing:**
1. Ensure `RAZORPAY_WEBHOOK_SECRET` matches the secret in Razorpay Dashboard
2. Verify raw body is used (not parsed JSON) for signature calculation
3. Check for trailing whitespace in environment variables

**Payments not being captured:**
1. Check webhook URL is registered and reachable
2. Verify `subscription.charged` event handler is working
3. Check `RazorpayEvent` table for failed events

**Mandate authorization failing:**
1. Ensure Razorpay account has AutoPay enabled
2. Verify plan pricing is in paise (amount × 100)
3. Check customer bank supports selected mandate type

### Logs to Check

```bash
# Filter Razorpay logs
grep "\[Razorpay" /var/log/app.log

# Check webhook events
SELECT * FROM "RazorpayEvent" ORDER BY "createdAt" DESC LIMIT 20;

# Check mandate status
SELECT * FROM "ModuleSubscription" WHERE "mandateId" IS NOT NULL;
```

---

## References

- [Razorpay Subscriptions API](https://razorpay.com/docs/payments/subscriptions/)
- [Razorpay Webhooks Reference](https://razorpay.com/docs/webhooks/)
- [Razorpay Node SDK](https://github.com/razorpay/razorpay-node)
- [UPI AutoPay Documentation](https://razorpay.com/docs/payments/recurring-payments/upi/)
