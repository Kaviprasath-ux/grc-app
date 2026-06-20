import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Default Objective of the meeting (auditors can edit).
const DEFAULT_OBJECTIVE =
  "Clarify the scope and objectives of the internal audit function and coordinate with the concerned department";

// Standard opening-meeting agenda — pre-filled as Topics Discussed subjects.
const AGENDA_SUBJECTS = [
  "Audit Objectives",
  "Scope",
  "Timeline",
  "Key Contacts",
  "Data Availability",
];

const blankTopics = () =>
  AGENDA_SUBJECTS.map((subject, i) => ({
    number: String(i + 1),
    subject,
    details: "",
  }));

// GET - fetch the opening meeting form for an engagement. When none is saved
// yet, returns a blank form pre-filled with the standard agenda + objective.
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

      const existing = await prisma.auditOpeningMeeting.findUnique({
        where: { engagementId: id },
      });

      if (existing) {
        return NextResponse.json({
          ...existing,
          attendees: existing.attendees ? JSON.parse(existing.attendees) : [],
          topicsDiscussed: existing.topicsDiscussed ? JSON.parse(existing.topicsDiscussed) : [],
          agreedActions: existing.agreedActions ? JSON.parse(existing.agreedActions) : [],
        });
      }

      return NextResponse.json({
        id: null,
        engagementId: id,
        meetingVenue: "",
        history: "",
        assignmentTitle: engagement.engagementTitle || "",
        auditTaskNumber: engagement.auditId || "",
        department: "",
        management: "",
        objective: DEFAULT_OBJECTIVE,
        attendees: [],
        topicsDiscussed: blankTopics(),
        agreedActions: [],
      });
    } catch (error) {
      console.error("Error fetching opening meeting form:", error);
      return NextResponse.json({ error: "Failed to fetch opening meeting form" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// PUT - create or update (upsert) the opening meeting form for an engagement.
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
        objective,
        attendees,
        topicsDiscussed,
        agreedActions,
      } = body;

      const data = {
        meetingVenue: meetingVenue ?? null,
        history: history ?? null,
        assignmentTitle: assignmentTitle ?? null,
        auditTaskNumber: auditTaskNumber ?? null,
        department: department ?? null,
        management: management ?? null,
        objective: objective ?? null,
        attendees: Array.isArray(attendees) ? JSON.stringify(attendees) : null,
        topicsDiscussed: Array.isArray(topicsDiscussed) ? JSON.stringify(topicsDiscussed) : null,
        agreedActions: Array.isArray(agreedActions) ? JSON.stringify(agreedActions) : null,
      };

      const saved = await prisma.auditOpeningMeeting.upsert({
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
        topicsDiscussed: saved.topicsDiscussed ? JSON.parse(saved.topicsDiscussed) : [],
        agreedActions: saved.agreedActions ? JSON.parse(saved.agreedActions) : [],
      });
    } catch (error) {
      console.error("Error saving opening meeting form:", error);
      return NextResponse.json({ error: "Failed to save opening meeting form" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
