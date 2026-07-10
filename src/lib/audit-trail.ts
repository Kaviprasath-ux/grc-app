import { prisma } from "@/lib/prisma";

// Canonical action labels stored in the trail.
export const AUDIT_ACTIONS = [
  "Create",
  "Update",
  "Delete",
  "Submit",
  "Approve",
  "Reject",
  "Login",
  "Logout",
  "Export",
  "View",
] as const;
export type AuditTrailAction = (typeof AUDIT_ACTIONS)[number];

// Map an RBAC action (view/create/edit/delete/approve) to a trail label.
const ACTION_LABEL: Record<string, string> = {
  create: "Create",
  edit: "Update",
  delete: "Delete",
  approve: "Approve",
  view: "View",
};
export function actionLabel(action: string): string {
  return ACTION_LABEL[action] || action.charAt(0).toUpperCase() + action.slice(1);
}

// Turn a resource id like "audit.operational-plan" into a readable module name
// like "Operational Plan".
export function moduleLabel(resource: string): string {
  const key = (resource.split(".").pop() || resource).replace(/[._]/g, "-");
  return key
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface AuditTrailInput {
  customerAccountId?: string | null;
  userId?: string | null;
  userName: string;
  userRole?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
}

/**
 * Append a record to the audit trail. Fire-and-forget: never throws into the
 * caller — a logging failure must not break the underlying request.
 */
export async function recordAuditTrail(input: AuditTrailInput): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        customerAccountId: input.customerAccountId ?? null,
        userId: input.userId ?? null,
        userName: input.userName || "Unknown",
        userRole: input.userRole ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        description: input.description ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[audit-trail] failed to record:", error);
  }
}
