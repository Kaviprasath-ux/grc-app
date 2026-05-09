---
title: "Verifai GRC - Razorpay Payment Integration"
subtitle: "Complete Guide to Autopay Subscriptions"
date: "May 2026"
---

<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
  h1 { color: #1a365d; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
  h2 { color: #1e40af; margin-top: 30px; }
  h3 { color: #3730a3; }
  table { border-collapse: collapse; width: 100%; margin: 20px 0; }
  th { background: #1e40af; color: white; padding: 12px; text-align: left; }
  td { border: 1px solid #ddd; padding: 10px; }
  tr:nth-child(even) { background: #f8fafc; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; overflow-x: auto; }
  .info-box { background: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .danger-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .timeline { position: relative; padding-left: 30px; }
  .timeline-item { position: relative; padding-bottom: 20px; border-left: 2px solid #2563eb; padding-left: 20px; }
  .timeline-item:last-child { border-left: none; }
  .timeline-dot { position: absolute; left: -8px; top: 0; width: 14px; height: 14px; background: #2563eb; border-radius: 50%; }
</style>

# Verifai GRC - Razorpay Payment Integration

## Complete Guide to Autopay Subscriptions

---

# 1. What is This Document About?

This document explains how payments work in Verifai GRC. We use **Razorpay Autopay** to automatically collect subscription payments from customers.

<div class="info-box">
<strong>Who should read this?</strong><br>
• Business teams wanting to understand payment flows<br>
• Support teams handling customer payment queries<br>
• Developers maintaining or extending the payment system
</div>

---

# 2. How Our Subscription Works - The Big Picture

## 2.1 The 2-Year Subscription Model

When a customer signs up for Verifai GRC, they commit to a **2-year subscription** with the following structure:

| Period | Duration | Price per Module | What Happens |
|--------|----------|------------------|--------------|
| **Trial** | 14 days | FREE | Customer uses the platform for free |
| **Year 1** | 12 months | ₹1,200/year (₹100/month) | Promotional pricing |
| **Year 2** | 12 months | ₹1,80,000/year (₹15,000/month) | Standard pricing |

<div class="success-box">
<strong>Example:</strong> If a customer signs up for the GRC module:<br>
• Day 1-14: Free trial<br>
• Day 15: ₹1,416 charged (₹1,200 + 18% GST) for Year 1<br>
• Day 380: ₹2,12,400 charged (₹1,80,000 + 18% GST) for Year 2
</div>

## 2.2 What is Autopay?

**Autopay** (also called "mandate") is an authorization that allows us to automatically deduct money from the customer's bank account or card on scheduled dates.

**Supported Payment Methods:**

| Method | How it Works | Common Apps |
|--------|--------------|-------------|
| **UPI AutoPay** | Customer approves via UPI app | GPay, PhonePe, Paytm, BHIM |
| **e-NACH** | Bank mandate authorization | All major banks |
| **Card Mandate** | Card saved for recurring charges | Visa, Mastercard |

---

# 3. The Complete Customer Journey

## Step-by-Step: What Happens When Someone Signs Up

### Day 1: Sign Up & Authorize Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER SIGNS UP                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Customer fills signup form:                                     │
│     • Organization name                                             │
│     • Admin name & email                                            │
│     • Password                                                      │
│     • Selects modules (GRC, TPRM, Internal Audit)                  │
│                                                                     │
│  2. Customer agrees to:                                             │
│     ✓ 2-year subscription commitment                                │
│     ✓ Autopay authorization                                         │
│                                                                     │
│  3. Razorpay checkout opens:                                        │
│     • Customer selects payment method (UPI/Card/Bank)               │
│     • Authorizes the mandate (recurring payment permission)         │
│     • Small verification charge of ₹2 (refunded)                    │
│                                                                     │
│  4. Mandate authorized → Trial begins immediately!                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Day 1-14: Free Trial Period

<div class="success-box">
<strong>During the 14-day trial:</strong><br>
• Customer has FULL access to all selected modules<br>
• No charges are made<br>
• Customer can explore and set up their organization<br>
• The mandate (payment authorization) is active but unused
</div>

### Day 15: First Automatic Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRIAL ENDS - FIRST CHARGE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  What happens automatically on Day 15:                              │
│                                                                     │
│  1. Razorpay initiates the charge using the stored mandate          │
│                                                                     │
│  2. Customer's bank/UPI app processes the payment                   │
│     (Customer does NOT need to do anything)                         │
│                                                                     │
│  3. If successful:                                                  │
│     ✓ Invoice marked as PAID                                        │
│     ✓ Subscription status → ACTIVE                                  │
│     ✓ Customer continues using the platform                         │
│                                                                     │
│  4. If failed:                                                      │
│     ✗ Razorpay retries up to 3 times over 7 days                   │
│     ✗ If all retries fail → Subscription SUSPENDED                  │
│     ✗ Customer loses access until payment is resolved               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Year 2: Automatic Renewal

On the anniversary of the subscription (Day 380), the Year 2 charge happens automatically:

| Event | What Happens |
|-------|--------------|
| 7 days before | System sends reminder email |
| On due date | Razorpay charges the stored mandate |
| If successful | Subscription continues for another year |
| If failed | Retries attempted, then suspension |

---

# 4. Payment States Explained

## 4.1 Mandate (Authorization) States

| State | What It Means | Customer Access |
|-------|---------------|-----------------|
| **Pending** | Customer hasn't completed authorization yet | No access |
| **Authenticated** | Mandate authorized, trial active | Full access (trial) |
| **Active** | First payment captured, subscription running | Full access |
| **Halted** | Payment failed after all retries | **ACCESS REVOKED** |
| **Cancelled** | Customer or admin cancelled | **ACCESS REVOKED** |
| **Completed** | All contract charges done (2 years) | Access until expiry |

## 4.2 What Happens When Payment Fails?

<div class="danger-box">
<strong>IMPORTANT: Our Policy on Failed Payments</strong><br><br>
Because this is a mandatory 2-year contract with autopay, if autopay fails or is disabled, the subscription ends <strong>immediately</strong>.<br><br>
This is by design - the contract requires working autopay authorization.
</div>

**The Failure Sequence:**

```
Payment Due
    │
    ▼
First Attempt ──── Success ──→ Subscription continues
    │
    │ Failed
    ▼
Wait 24 hours
    │
    ▼
Retry #1 ──────── Success ──→ Subscription continues
    │
    │ Failed
    ▼
Wait 48 hours
    │
    ▼
Retry #2 ──────── Success ──→ Subscription continues
    │
    │ Failed
    ▼
Wait 72 hours
    │
    ▼
Final Retry ───── Success ──→ Subscription continues
    │
    │ Failed
    ▼
┌─────────────────────────────────────────┐
│  SUBSCRIPTION HALTED                    │
│  • Status → SUSPENDED                   │
│  • Module access → DISABLED             │
│  • Invoice → FAILED                     │
│  • Email notification sent              │
└─────────────────────────────────────────┘
```

---

# 5. How Razorpay Communicates With Us

## 5.1 Webhooks - Real-Time Notifications

Razorpay sends us instant notifications (called "webhooks") whenever something happens with a payment or subscription.

**Key Events We Handle:**

| Event | When It Fires | What We Do |
|-------|---------------|------------|
| `subscription.authenticated` | Customer authorizes mandate | Start trial, enable access |
| `subscription.charged` | Payment successfully captured | Mark invoice PAID, keep access |
| `subscription.halted` | All payment retries failed | Suspend subscription, revoke access |
| `subscription.cancelled` | Subscription cancelled | End subscription, revoke access |
| `subscription.completed` | All 2-year charges done | Mark as completed |
| `payment.failed` | Individual payment attempt failed | Log error, wait for retry |

## 5.2 The Webhook Flow (Technical)

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Razorpay   │        │  Our Server  │        │   Database   │
└──────┬───────┘        └──────┬───────┘        └──────┬───────┘
       │                       │                       │
       │  POST /webhooks/razorpay/subscription         │
       │  (with signature)     │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │                       │ 1. Verify signature   │
       │                       │    (timing-safe)      │
       │                       │                       │
       │                       │ 2. Validate payload   │
       │                       │    (Zod schema)       │
       │                       │                       │
       │                       │ 3. Check idempotency  │
       │                       │───────────────────────>│
       │                       │                       │
       │                       │ 4. Process event      │
       │                       │───────────────────────>│
       │                       │                       │
       │   { received: true }  │                       │
       │<──────────────────────│                       │
       │                       │                       │
```

---

# 6. Security Measures

## 6.1 How We Protect Payments

<div class="info-box">
<strong>Our security follows Razorpay's official best practices and adds extra protection.</strong>
</div>

### Signature Verification

Every message from Razorpay includes a digital signature. We verify it using a **timing-safe comparison** to prevent hackers from guessing the signature.

```javascript
// We use crypto.timingSafeEqual() - not simple === comparison
// This prevents "timing attacks" where hackers measure response times
```

### Payload Validation

We validate every webhook payload against a strict schema:
- Event type must be present
- Required fields must exist
- Data types must match expected formats

If validation fails → We reject the webhook with error 422.

### Fail-Closed Security

In production, if security credentials are missing:
- We **REJECT** the webhook (not accept)
- This prevents processing of potentially forged requests

### Idempotency Protection

We track every webhook event ID in the database:
- If we receive the same event twice → Process only once
- Prevents duplicate charges or duplicate processing

---

# 7. Technical Implementation Details

## 7.1 Key Files in the Codebase

| File | Purpose |
|------|---------|
| `src/lib/payment-provider.ts` | Core Razorpay client, signature verification |
| `src/lib/payment-provider-mandate.ts` | Create/manage subscription mandates |
| `src/lib/razorpay-plan-manager.ts` | Manage Razorpay plans |
| `src/app/api/webhooks/razorpay/subscription/route.ts` | Handle subscription webhooks |
| `src/app/api/webhooks/razorpay/route.ts` | Handle payment webhooks |

## 7.2 Database Tables

| Table | Purpose |
|-------|---------|
| `RazorpayPlan` | Cached Razorpay plan IDs |
| `RazorpayEvent` | Webhook idempotency tracking |
| `ModuleSubscription` | Links modules to mandate IDs |
| `Subscription` | Customer subscription records |
| `Invoice` | Billing records |
| `Payment` | Payment transaction records |

## 7.3 Environment Variables

```bash
# Required for Razorpay integration
RAZORPAY_KEY_ID=rzp_live_xxxxx      # API Key ID
RAZORPAY_KEY_SECRET=xxxxx           # API Secret (NEVER expose publicly)
RAZORPAY_WEBHOOK_SECRET=xxxxx       # Webhook signature secret

# Configuration
PAYMENT_STUB=false                   # Set true for testing without real payments
TRIAL_DAYS=14                        # Trial period duration
```

---

# 8. Common Scenarios & Troubleshooting

## 8.1 Customer Can't Complete Payment Authorization

**Possible causes:**
1. Bank doesn't support UPI AutoPay
2. Customer cancelled during checkout
3. Network timeout

**Solution:** Customer should retry with a different payment method or contact their bank.

## 8.2 Automatic Payment Failed

**Possible causes:**
1. Insufficient funds in customer's account
2. Card expired
3. Bank declined the transaction
4. Customer disabled autopay in their banking app

**What happens:**
- Razorpay retries automatically (up to 3 times)
- Customer receives notification emails
- If all retries fail → Subscription suspended

**Solution:** Customer needs to ensure sufficient funds and valid payment method, then contact support to retry.

## 8.3 Customer Wants to Cancel

<div class="warning-box">
<strong>Important:</strong> Cancellation is NOT available during the 2-year contract period. This is a binding commitment.
</div>

After 2 years, customer can choose not to renew by contacting support before the renewal date.

---

# 9. Pricing Summary

## Per Module Pricing (+ 18% GST)

| Module | Year 1 (Promo) | Year 2 (Standard) | 2-Year Total |
|--------|----------------|-------------------|--------------|
| GRC | ₹1,200/year | ₹1,80,000/year | ₹1,81,200 |
| TPRM | ₹1,200/year | ₹1,80,000/year | ₹1,81,200 |
| Internal Audit | ₹1,200/year | ₹1,80,000/year | ₹1,81,200 |

**With GST (18%):**

| Module | Year 1 Total | Year 2 Total | 2-Year Grand Total |
|--------|--------------|--------------|-------------------|
| GRC | ₹1,416 | ₹2,12,400 | ₹2,13,816 |
| TPRM | ₹1,416 | ₹2,12,400 | ₹2,13,816 |
| Internal Audit | ₹1,416 | ₹2,12,400 | ₹2,13,816 |

---

# 10. Contact & Support

For payment-related issues:
- **Customer Support:** Support team can check payment status in admin panel
- **Technical Issues:** Check `RazorpayEvent` table for webhook processing errors
- **Razorpay Dashboard:** Access at https://dashboard.razorpay.com

---

# Appendix A: Complete Timeline Example

**Customer: ABC Corp signs up for GRC module on January 1, 2026**

| Date | Day | Event | Amount |
|------|-----|-------|--------|
| Jan 1, 2026 | 1 | Signup, mandate authorized, trial starts | ₹2 (verification, refunded) |
| Jan 1-14, 2026 | 1-14 | Free trial period | ₹0 |
| Jan 15, 2026 | 15 | Year 1 charge (auto) | ₹1,416 |
| Jan 15, 2027 | 380 | Year 2 charge (auto) | ₹2,12,400 |
| Jan 15, 2028 | 745 | Contract ends | - |

**Total paid over 2 years: ₹2,13,816** (including GST)

---

# Appendix B: Webhook Event Reference

| Event | Trigger | Our Action |
|-------|---------|------------|
| `subscription.authenticated` | Mandate authorized | Enable trial access |
| `subscription.pending` | Awaiting authorization | Show pending status |
| `subscription.charged` | Payment captured | Mark invoice PAID |
| `subscription.halted` | All retries failed | Suspend immediately |
| `subscription.paused` | Subscription paused | Treat as cancelled |
| `subscription.cancelled` | Cancelled by user/admin | Revoke access |
| `subscription.completed` | All charges done | Mark completed |
| `payment.captured` | Payment successful | Update payment record |
| `payment.failed` | Payment attempt failed | Log, await retry |

---

*Document Version: 1.0 | Last Updated: May 2026*
