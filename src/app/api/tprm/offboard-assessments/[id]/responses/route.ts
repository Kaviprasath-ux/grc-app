import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getCustomerAccountId } from "@/lib/api-auth";
import { saveUploadedFile } from "@/lib/file-upload";
import { validateUploadedFile } from "@/lib/upload-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tprm/offboard-assessments/[id]/responses — Save a single response (auto-save)
 */
export const POST = withAuthOnly(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: assessmentId } = await context.params;

      // Verify assessment belongs to customer and is editable
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: {
          id: assessmentId,
          customerAccountId,
          assessmentType: "Offboard Assessment",
          status: { in: ["Offboard_In_Progress", "Offboard_Awaiting_Response"] },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found or not editable" }, { status: 404 });
      }

      const body = await req.json();
      const { questionId, response, comment, isFlagged, isDelegated, delegatedToId } = body;

      if (!questionId) {
        return NextResponse.json({ error: "questionId is required" }, { status: 400 });
      }

      // Server-side write guard for SMEs (mirrors the onboarding
      // responses route). Offboard responses have the same delegation
      // model; without this an SME could POST to any questionId on the
      // offboard assessment.
      const isSME = session.roles.includes('TPRMSME');
      const isAM = session.roles.includes('AccountManager') || session.roles.includes('CustomerAdministrator') || session.roles.includes('GRCAdministrator');
      if (isSME && !isAM) {
        const existing = await prisma.tPRMOffboardResponse.findUnique({
          where: { assessmentId_questionId: { assessmentId, questionId } },
          select: { isDelegated: true, delegatedToId: true },
        });
        const isDelegatee = existing?.isDelegated && existing.delegatedToId === session.id;
        if (!isDelegatee) {
          return NextResponse.json(
            { error: 'You can only edit questions that have been delegated to you.' },
            { status: 403 },
          );
        }
      }

      // Upsert the response
      const updated = await prisma.tPRMOffboardResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId,
            questionId,
          },
        },
        update: {
          ...(response !== undefined ? { response } : {}),
          ...(comment !== undefined ? { comment } : {}),
          ...(isFlagged !== undefined ? { isFlagged } : {}),
          ...(isDelegated !== undefined ? { isDelegated } : {}),
          ...(delegatedToId !== undefined ? { delegatedToId: delegatedToId || null } : {}),
        },
        create: {
          customerAccountId,
          assessmentId,
          questionId,
          questionNo: 0,
          questionTitle: "",
          response: response || null,
          comment: comment || null,
          isFlagged: isFlagged || false,
          isDelegated: isDelegated || false,
          delegatedToId: delegatedToId || null,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Offboard Response POST error:", error);
      return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
    }
  }
);

/**
 * PATCH /api/tprm/offboard-assessments/[id]/responses — Bulk save responses
 */
export const PATCH = withAuthOnly(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: assessmentId } = await context.params;

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: {
          id: assessmentId,
          customerAccountId,
          assessmentType: "Offboard Assessment",
          status: { in: ["Offboard_In_Progress", "Offboard_Awaiting_Response"] },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found or not editable" }, { status: 404 });
      }

      const body = await req.json();
      const { responses } = body;

      if (!Array.isArray(responses)) {
        return NextResponse.json({ error: "responses array is required" }, { status: 400 });
      }

      // Server-side write guard for SMEs (mirrors POST). Reject the
      // whole batch if any question isn't delegated to the SME.
      const isSME = session.roles.includes('TPRMSME');
      const isAM = session.roles.includes('AccountManager') || session.roles.includes('CustomerAdministrator') || session.roles.includes('GRCAdministrator');
      if (isSME && !isAM) {
        const questionIds = responses.map((r) => r.questionId).filter(Boolean);
        const allowed = await prisma.tPRMOffboardResponse.findMany({
          where: {
            assessmentId,
            questionId: { in: questionIds },
            isDelegated: true,
            delegatedToId: session.id,
          },
          select: { questionId: true },
        });
        const allowedSet = new Set(allowed.map((r) => r.questionId));
        const blocked = questionIds.filter((q) => !allowedSet.has(q));
        if (blocked.length > 0) {
          return NextResponse.json(
            { error: `${blocked.length} question(s) are not delegated to you.` },
            { status: 403 },
          );
        }
      }

      for (const resp of responses) {
        await prisma.tPRMOffboardResponse.upsert({
          where: {
            assessmentId_questionId: {
              assessmentId,
              questionId: resp.questionId,
            },
          },
          update: {
            ...(resp.response !== undefined ? { response: resp.response } : {}),
            ...(resp.comment !== undefined ? { comment: resp.comment } : {}),
          },
          create: {
            customerAccountId,
            assessmentId,
            questionId: resp.questionId,
            questionNo: 0,
            questionTitle: "",
            response: resp.response || null,
            comment: resp.comment || null,
          },
        });
      }

      return NextResponse.json({ success: true, count: responses.length });
    } catch (error) {
      console.error("Offboard Response PATCH error:", error);
      return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }
  }
);

/**
 * PUT /api/tprm/offboard-assessments/[id]/responses — Upload artifact for a response
 */
export const PUT = withAuthOnly(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: assessmentId } = await context.params;

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: {
          id: assessmentId,
          customerAccountId,
          assessmentType: "Offboard Assessment",
          status: { in: ["Offboard_In_Progress", "Offboard_Awaiting_Response"] },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found or not editable" }, { status: 404 });
      }

      const formData = await req.formData();
      const questionId = formData.get("questionId") as string;
      const file = formData.get("file") as File;

      if (!questionId || !file) {
        return NextResponse.json({ error: "questionId and file are required" }, { status: 400 });
      }

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // SME write guard for artifact upload — same shape as POST.
      const isSME = session.roles.includes('TPRMSME');
      const isAM = session.roles.includes('AccountManager') || session.roles.includes('CustomerAdministrator') || session.roles.includes('GRCAdministrator');
      if (isSME && !isAM) {
        const existing = await prisma.tPRMOffboardResponse.findUnique({
          where: { assessmentId_questionId: { assessmentId, questionId } },
          select: { isDelegated: true, delegatedToId: true },
        });
        const isDelegatee = existing?.isDelegated && existing.delegatedToId === session.id;
        if (!isDelegatee) {
          return NextResponse.json(
            { error: 'You can only attach files to questions that have been delegated to you.' },
            { status: 403 },
          );
        }
      }

      const subDir = `tprm/offboard/${assessmentId}`;
      const { urlPath } = await saveUploadedFile(file, subDir);

      await prisma.tPRMOffboardResponse.update({
        where: {
          assessmentId_questionId: {
            assessmentId,
            questionId,
          },
        },
        data: {
          artifactUrl: urlPath,
          artifactName: file.name,
        },
      });

      return NextResponse.json({ url: urlPath, name: file.name });
    } catch (error) {
      console.error("Offboard Response Upload error:", error);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
  }
);
