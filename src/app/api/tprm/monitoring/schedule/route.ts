import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

function computeNextRun(recurrence: string, customDays?: number | null): Date | null {
  const now = new Date();
  switch (recurrence) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    case "custom":
      if (customDays && customDays > 0) {
        return new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
      }
      return null;
    default:
      return null;
  }
}

// GET current schedule config
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const schedule = await prisma.tPRMMonitoringSchedule.findUnique({
        where: { customerAccountId },
      });

      return NextResponse.json({
        data: schedule || { recurrence: "none", customDays: null, nextScheduledRun: null },
      });
    } catch (error) {
      console.error("Failed to fetch monitoring schedule:", error);
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
    }
  },
  { resource: "tprm.monitoring", action: "edit" }
);

// PATCH update schedule config
export const PATCH = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const body = await req.json();
      const { recurrence, customDays } = body;

      const validRecurrences = ["none", "daily", "weekly", "monthly", "custom"];
      if (!validRecurrences.includes(recurrence)) {
        return NextResponse.json({ error: "Invalid recurrence type" }, { status: 400 });
      }

      if (recurrence === "custom" && (!customDays || customDays < 1)) {
        return NextResponse.json({ error: "Custom recurrence requires a positive number of days" }, { status: 400 });
      }

      const nextScheduledRun = computeNextRun(recurrence, customDays);

      const schedule = await prisma.tPRMMonitoringSchedule.upsert({
        where: { customerAccountId },
        create: {
          customerAccountId,
          recurrence,
          customDays: recurrence === "custom" ? customDays : null,
          nextScheduledRun,
        },
        update: {
          recurrence,
          customDays: recurrence === "custom" ? customDays : null,
          nextScheduledRun,
        },
      });

      return NextResponse.json({ data: schedule });
    } catch (error) {
      console.error("Failed to update monitoring schedule:", error);
      return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
    }
  },
  { resource: "tprm.monitoring", action: "edit" }
);
