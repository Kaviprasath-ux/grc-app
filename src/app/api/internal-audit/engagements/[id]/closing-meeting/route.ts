import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { parseClosingMeetingWorkbook } from "@/lib/closing-meeting-template";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - fetch the saved Closing Meeting data for an engagement (display on page).
export const GET = withAuth(
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

      const saved = await prisma.auditClosingMeeting.findUnique({ where: { engagementId: id } });
      if (!saved) {
        return NextResponse.json(null);
      }

      return NextResponse.json({
        meetingVenue: saved.meetingVenue,
        history: saved.history,
        assignmentTitle: saved.assignmentTitle,
        auditTaskNumber: saved.auditTaskNumber,
        department: saved.department,
        management: saved.management,
        attendees: saved.attendees ? JSON.parse(saved.attendees) : [],
        summary: saved.summaryOfResults ? JSON.parse(saved.summaryOfResults) : [],
        decisions: saved.decisionsTaken ? JSON.parse(saved.decisionsTaken) : [],
        updatedAt: saved.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching closing meeting:", error);
      return NextResponse.json({ error: "Failed to fetch closing meeting" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// POST - upload a filled Closing Meeting template; parse it and save.
export const POST = withAuth(
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

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
        return NextResponse.json(
          { error: "Please upload the filled Excel template (.xlsx)." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { data, error } = parseClosingMeetingWorkbook(buffer);
      if (error || !data) {
        return NextResponse.json({ error: error || "Could not parse the file." }, { status: 400 });
      }

      const payload = {
        meetingVenue: data.header.meetingVenue || null,
        history: data.header.history || null,
        assignmentTitle: data.header.assignmentTitle || null,
        auditTaskNumber: data.header.auditTaskNumber || null,
        department: data.header.department || null,
        management: data.header.management || null,
        attendees: JSON.stringify(data.attendees),
        summaryOfResults: JSON.stringify(data.summary),
        decisionsTaken: JSON.stringify(data.decisions),
      };

      await prisma.auditClosingMeeting.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          createdById: session.id || null,
          updatedById: session.id || null,
          ...payload,
        },
        update: { updatedById: session.id || null, ...payload },
      });

      return NextResponse.json({
        ...data.header,
        attendees: data.attendees,
        summary: data.summary,
        decisions: data.decisions,
      });
    } catch (error) {
      console.error("Error uploading closing meeting:", error);
      return NextResponse.json({ error: "Failed to upload closing meeting" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
