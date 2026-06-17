import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface FindingForPrefill {
  finding: string;
  description: string | null;
  severity: string;
  recommendation: string | null;
  responsiblePerson: string | null;
  targetDate: Date | null;
}

function buildNotesFromFindings(findings: FindingForPrefill[]) {
  return findings.map((f, idx) => ({
    number: String(idx + 1),
    note: f.finding || f.description || "",
    degreeOfRisk: f.severity || "",
    managementResponse: "",
    proposedAction: f.recommendation || "",
  }));
}

function buildAgreedActionsFromFindings(findings: FindingForPrefill[]) {
  return findings
    .filter((f) => (f.recommendation || "").trim())
    .map((f, idx) => ({
      number: String(idx + 1),
      procedure: f.recommendation || "",
      official: f.responsiblePerson || "",
      implementationDate: f.targetDate ? f.targetDate.toISOString().slice(0, 10) : "",
    }));
}

// GET - fetch the Findings Discussion (Preliminary Observations) meeting form.
// When none is saved, returns a blank shell with the Notes Discussed and Agreed
// Actions grids pre-filled from the engagement's findings.
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

      const existing = await prisma.auditFindingsDiscussionMeeting.findUnique({
        where: { engagementId: id },
      });

      if (existing) {
        return NextResponse.json({
          ...existing,
          attendees: existing.attendees ? JSON.parse(existing.attendees) : [],
          notesDiscussed: existing.notesDiscussed ? JSON.parse(existing.notesDiscussed) : [],
          agreedActions: existing.agreedActions ? JSON.parse(existing.agreedActions) : [],
        });
      }

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          finding: true,
          description: true,
          severity: true,
          recommendation: true,
          responsiblePerson: true,
          targetDate: true,
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
        notesDiscussed: buildNotesFromFindings(findings),
        agreedActions: buildAgreedActionsFromFindings(findings),
      });
    } catch (error) {
      console.error("Error fetching findings discussion meeting:", error);
      return NextResponse.json(
        { error: "Failed to fetch findings discussion meeting" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// PUT - create or update (upsert) the findings discussion meeting form.
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
      const data = {
        meetingVenue: body.meetingVenue ?? null,
        history: body.history ?? null,
        assignmentTitle: body.assignmentTitle ?? null,
        auditTaskNumber: body.auditTaskNumber ?? null,
        department: body.department ?? null,
        management: body.management ?? null,
        attendees: Array.isArray(body.attendees) ? JSON.stringify(body.attendees) : null,
        notesDiscussed: Array.isArray(body.notesDiscussed)
          ? JSON.stringify(body.notesDiscussed)
          : null,
        agreedActions: Array.isArray(body.agreedActions)
          ? JSON.stringify(body.agreedActions)
          : null,
      };

      const saved = await prisma.auditFindingsDiscussionMeeting.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          createdById: session.id || null,
          updatedById: session.id || null,
          ...data,
        },
        update: { updatedById: session.id || null, ...data },
      });

      return NextResponse.json({
        ...saved,
        attendees: saved.attendees ? JSON.parse(saved.attendees) : [],
        notesDiscussed: saved.notesDiscussed ? JSON.parse(saved.notesDiscussed) : [],
        agreedActions: saved.agreedActions ? JSON.parse(saved.agreedActions) : [],
      });
    } catch (error) {
      console.error("Error saving findings discussion meeting:", error);
      return NextResponse.json(
        { error: "Failed to save findings discussion meeting" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
