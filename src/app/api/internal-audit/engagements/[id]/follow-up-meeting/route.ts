import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Shape of a recommendation-status row in the JSON column.
function buildRecommendationsFromFindings(
  findings: Array<{
    findingId: string;
    recommendation: string | null;
    responsiblePerson: string | null;
    targetDate: Date | null;
    status: string;
  }>
) {
  return findings
    .filter((f) => (f.recommendation || "").trim().length > 0)
    .map((f, idx) => ({
      number: String(idx + 1),
      recommendation: f.recommendation || "",
      official: f.responsiblePerson || "",
      implementationDate: f.targetDate ? f.targetDate.toISOString().slice(0, 10) : "",
      implementationStatus: ["Open", "In Progress", "Implemented", "Closed"].includes(f.status)
        ? f.status
        : "Open",
      progress: f.status === "Closed" ? "100" : "0",
      notes: "",
    }));
}

// GET - fetch the follow-up meeting form for an engagement.
// When none is saved yet, returns a blank form with the recommendation grid
// pre-filled from the engagement's findings.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditId: true, engagementTitle: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const existing = await prisma.auditFollowUpMeeting.findUnique({
        where: { engagementId: id },
      });

      if (existing) {
        return NextResponse.json({
          ...existing,
          attendees: existing.attendees ? JSON.parse(existing.attendees) : [],
          recommendations: existing.recommendations ? JSON.parse(existing.recommendations) : [],
        });
      }

      // No saved form yet — return a blank shell pre-filled from findings.
      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          findingId: true,
          recommendation: true,
          responsiblePerson: true,
          targetDate: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({
        id: null,
        engagementId: id,
        meetingVenue: "",
        history: "",
        assignmentTitle: engagement.engagementTitle || "",
        auditTaskNumber: engagement.auditId || "",
        department: "",
        management: "",
        attendees: [],
        recommendations: buildRecommendationsFromFindings(findings),
      });
    } catch (error) {
      console.error("Error fetching follow-up meeting form:", error);
      return NextResponse.json({ error: "Failed to fetch follow-up meeting form" }, { status: 500 });
    }
  },
  { resource: "audit.capa", action: "view" }
);

// PUT - create or update (upsert) the follow-up meeting form for an engagement.
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json({ error: "No customer account associated" }, { status: 400 });
      }

      const body = await req.json();
      const {
        meetingVenue,
        history,
        assignmentTitle,
        auditTaskNumber,
        department,
        management,
        attendees,
        recommendations,
      } = body;

      const data = {
        meetingVenue: meetingVenue ?? null,
        history: history ?? null,
        assignmentTitle: assignmentTitle ?? null,
        auditTaskNumber: auditTaskNumber ?? null,
        department: department ?? null,
        management: management ?? null,
        attendees: Array.isArray(attendees) ? JSON.stringify(attendees) : null,
        recommendations: Array.isArray(recommendations) ? JSON.stringify(recommendations) : null,
      };

      const saved = await prisma.auditFollowUpMeeting.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          createdById: session.id || null,
          updatedById: session.id || null,
          ...data,
        },
        update: {
          updatedById: session.id || null,
          ...data,
        },
      });

      return NextResponse.json({
        ...saved,
        attendees: saved.attendees ? JSON.parse(saved.attendees) : [],
        recommendations: saved.recommendations ? JSON.parse(saved.recommendations) : [],
      });
    } catch (error) {
      console.error("Error saving follow-up meeting form:", error);
      return NextResponse.json({ error: "Failed to save follow-up meeting form" }, { status: 500 });
    }
  },
  { resource: "audit.capa", action: "edit" }
);
