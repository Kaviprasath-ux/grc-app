import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { parseFindingsDiscussionWorkbook } from "@/lib/findings-discussion-template";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - fetch the saved Findings Discussion data for an engagement (display on page).
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

      const saved = await prisma.auditFindingsDiscussionMeeting.findUnique({
        where: { engagementId: id },
      });
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
        notesDiscussed: saved.notesDiscussed ? JSON.parse(saved.notesDiscussed) : [],
        agreedActions: saved.agreedActions ? JSON.parse(saved.agreedActions) : [],
        updatedAt: saved.updatedAt,
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

// PUT - save the Findings Discussion meeting minutes from the inline form (JSON).
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
      const payload = {
        meetingVenue: body.meetingVenue ?? null,
        history: body.history ?? null,
        assignmentTitle: body.assignmentTitle ?? null,
        auditTaskNumber: body.auditTaskNumber ?? null,
        department: body.department ?? null,
        management: body.management ?? null,
        attendees: JSON.stringify(Array.isArray(body.attendees) ? body.attendees : []),
        notesDiscussed: JSON.stringify(Array.isArray(body.notesDiscussed) ? body.notesDiscussed : []),
        agreedActions: JSON.stringify(Array.isArray(body.agreedActions) ? body.agreedActions : []),
      };

      const saved = await prisma.auditFindingsDiscussionMeeting.upsert({
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
        meetingVenue: saved.meetingVenue,
        history: saved.history,
        assignmentTitle: saved.assignmentTitle,
        auditTaskNumber: saved.auditTaskNumber,
        department: saved.department,
        management: saved.management,
        attendees: saved.attendees ? JSON.parse(saved.attendees) : [],
        notesDiscussed: saved.notesDiscussed ? JSON.parse(saved.notesDiscussed) : [],
        agreedActions: saved.agreedActions ? JSON.parse(saved.agreedActions) : [],
      });
    } catch (error) {
      console.error("Error saving findings discussion meeting:", error);
      return NextResponse.json({ error: "Failed to save findings discussion meeting" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);

// POST - upload a filled Findings Discussion template; parse it and save.
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
      const { data, error } = parseFindingsDiscussionWorkbook(buffer);
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
        notesDiscussed: JSON.stringify(data.notesDiscussed),
        agreedActions: JSON.stringify(data.agreedActions),
      };

      await prisma.auditFindingsDiscussionMeeting.upsert({
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
        notesDiscussed: data.notesDiscussed,
        agreedActions: data.agreedActions,
      });
    } catch (error) {
      console.error("Error uploading findings discussion meeting:", error);
      return NextResponse.json(
        { error: "Failed to upload findings discussion meeting" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
