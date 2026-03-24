import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Static list of all scheduled cron events — matches vercel.json exactly
const SCHEDULED_CRONS = [
  {
    id: "due-reminders",
    name: "Due Date Reminders",
    description: "Sends due-date reminders for evidence, CAPA/findings, policy reviews, TPRM assessments, contracts, and SME assignments.",
    schedule: "0 8 * * *",
    scheduleHuman: "Daily at 8:00 AM UTC",
    path: "/api/cron/due-reminders",
  },
  {
    id: "escalation",
    name: "Escalation",
    description: "Runs escalation checks for overdue items and triggers escalation notifications.",
    schedule: "0 9 * * *",
    scheduleHuman: "Daily at 9:00 AM UTC",
    path: "/api/cron/escalation",
  },
  {
    id: "cadence-reassessment",
    name: "Cadence Reassessment",
    description: "Auto-creates periodic reassessments for completed vendor assessments once the configured cadence period (based on VRR) has elapsed.",
    schedule: "0 7 * * *",
    scheduleHuman: "Daily at 7:00 AM UTC",
    path: "/api/cron/cadence-reassessment",
  },
  {
    id: "remediation-reminders",
    name: "Remediation Due Reminders",
    description: "Sends reminders to AM, Assessor, Approver, RM, and BO when a remediation item is approaching its due date (based on configured reminder days per severity).",
    schedule: "0 8 * * *",
    scheduleHuman: "Daily at 8:00 AM UTC",
    path: "/api/cron/remediation-reminders",
  },
];

// GET — return static list of scheduled cron events OR run history
// ?history=true&cronId=xxx returns run history for a specific cron (or all if no cronId)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const history = searchParams.get('history') === 'true';
    const cronId = searchParams.get('cronId');

    if (history) {
      const where = cronId ? { taskFunction: cronId } : {};
      const runs = await prisma.scheduledTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json(runs);
    }

    return NextResponse.json(SCHEDULED_CRONS);
  } catch (error) {
    console.error("Error fetching scheduled crons:", error);
    return NextResponse.json({ error: "Failed to fetch scheduled crons" }, { status: 500 });
  }
}

// POST — manually trigger a cron by ID (GRCAdministrator only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    const cron = SCHEDULED_CRONS.find((c) => c.id === id);
    if (!cron) {
      return NextResponse.json({ error: "Cron not found" }, { status: 404 });
    }

    // Call the cron endpoint internally
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}${cron.path}`, {
      headers: {
        'x-triggered-by': 'manual',
        ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
      },
    });

    const result = await response.json();
    return NextResponse.json({ success: response.ok, cronId: id, result });
  } catch (error) {
    console.error("Error triggering cron:", error);
    return NextResponse.json({ error: "Failed to trigger cron" }, { status: 500 });
  }
}
