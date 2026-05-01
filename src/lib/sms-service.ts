/**
 * SMS service — wraps MSG91 (or any SMS provider) behind a single function.
 *
 * Like payment-provider.ts, this is a single replaceable boundary. The dev
 * stub logs to console; production calls MSG91's flow API.
 *
 * Templates are referenced by `templateCode` which must be DLT-registered with
 * the carrier. For Indian SMS, all templates need to be approved through DLT
 * (Distributed Ledger Technology) before they can be sent.
 *
 * Env vars:
 *   SMS_STUB=true      → dev mode, logs only (default in non-production)
 *   MSG91_AUTH_KEY     → MSG91 auth key
 *   MSG91_SENDER_ID    → 6-character sender ID
 *   MSG91_FLOW_TPL_*   → DLT-registered flow IDs per template (see below)
 *
 * Approved template codes (set MSG91_FLOW_TPL_<CODE> after DLT approval):
 *   SUBSCRIPTION_REMINDER_15D, SUBSCRIPTION_REMINDER_7D,
 *   SUBSCRIPTION_REMINDER_3D, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_GRACE_PERIOD,
 *   PAYMENT_FAILED
 *
 * Templates are limited to ~160 chars each per DLT rules.
 */

const STUB_DEFAULT = process.env.NODE_ENV !== "production";

function smsStubEnabled(): boolean {
  if (process.env.SMS_STUB === "true") return true;
  if (process.env.SMS_STUB === "false") return false;
  return STUB_DEFAULT;
}

export interface SendSmsParams {
  /** Recipient phone with country code, e.g., "+919876543210" */
  to: string;
  /** Template code matching DLT-approved flow */
  templateCode: string;
  /** Variables to substitute into the DLT template body */
  variables: Record<string, string | number>;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS via MSG91 (or stub-log it in dev).
 *
 * Stub mode behaviour: returns success: true and logs the would-be message.
 * No DLT approval needed for stub.
 *
 * Production: calls MSG91 Flow API. Requires:
 *   - MSG91_AUTH_KEY env var
 *   - MSG91_FLOW_TPL_<TEMPLATE_CODE> env var holding the DLT-approved flow ID
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  if (smsStubEnabled()) {
    console.log(`[SmsService][STUB] To: ${params.to}, Template: ${params.templateCode}, Vars:`, params.variables);
    return { success: true, messageId: `stub-${Date.now()}` };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    return { success: false, error: "MSG91_AUTH_KEY not configured" };
  }

  const flowId = process.env[`MSG91_FLOW_TPL_${params.templateCode}`];
  if (!flowId) {
    return { success: false, error: `No DLT flow registered for template ${params.templateCode} (set MSG91_FLOW_TPL_${params.templateCode})` };
  }

  // Strip leading "+" — MSG91 expects digits only with country code
  const mobile = params.to.replace(/^\+/, "");

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authkey": authKey,
      },
      body: JSON.stringify({
        flow_id: flowId,
        sender: process.env.MSG91_SENDER_ID,
        recipients: [{ mobiles: mobile, ...params.variables }],
      }),
    });
    const json = await res.json();
    if (!res.ok || json.type === "error") {
      return { success: false, error: json.message || `HTTP ${res.status}` };
    }
    return { success: true, messageId: json.message ?? json.requestId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function isStubMode(): boolean {
  return smsStubEnabled();
}
