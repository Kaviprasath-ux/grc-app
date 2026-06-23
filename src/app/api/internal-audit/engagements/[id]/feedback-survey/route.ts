import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - the feedback survey for an engagement (empty shell if none saved yet).
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

      const saved = await prisma.auditFeedbackSurvey.findUnique({ where: { engagementId: id } });
      if (!saved) {
        return NextResponse.json({
          id: null,
          engagementId: id,
          responses: {},
          comments: {},
          customRows: {},
          overallSatisfaction: null,
          didWell: "",
          improvements: "",
        });
      }

      return NextResponse.json({
        id: saved.id,
        engagementId: id,
        responses: saved.responses ? JSON.parse(saved.responses) : {},
        comments: saved.comments ? JSON.parse(saved.comments) : {},
        customRows: saved.customRows ? JSON.parse(saved.customRows) : {},
        overallSatisfaction: saved.overallSatisfaction,
        didWell: saved.didWell || "",
        improvements: saved.improvements || "",
      });
    } catch (error) {
      console.error("Error fetching feedback survey:", error);
      return NextResponse.json({ error: "Failed to fetch feedback survey" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// PUT - upsert the feedback survey for an engagement.
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
      const overall =
        body.overallSatisfaction === null || body.overallSatisfaction === undefined
          ? null
          : Number(body.overallSatisfaction);

      const data = {
        responses: JSON.stringify(body.responses && typeof body.responses === "object" ? body.responses : {}),
        comments: JSON.stringify(body.comments && typeof body.comments === "object" ? body.comments : {}),
        customRows: JSON.stringify(body.customRows && typeof body.customRows === "object" ? body.customRows : {}),
        overallSatisfaction: Number.isFinite(overall) ? overall : null,
        didWell: body.didWell ?? null,
        improvements: body.improvements ?? null,
      };

      const saved = await prisma.auditFeedbackSurvey.upsert({
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
        id: saved.id,
        engagementId: id,
        responses: saved.responses ? JSON.parse(saved.responses) : {},
        comments: saved.comments ? JSON.parse(saved.comments) : {},
        customRows: saved.customRows ? JSON.parse(saved.customRows) : {},
        overallSatisfaction: saved.overallSatisfaction,
        didWell: saved.didWell || "",
        improvements: saved.improvements || "",
      });
    } catch (error) {
      console.error("Error saving feedback survey:", error);
      return NextResponse.json({ error: "Failed to save feedback survey" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
