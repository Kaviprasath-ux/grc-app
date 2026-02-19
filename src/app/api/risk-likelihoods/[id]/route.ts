import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update risk likelihood - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { title, score, timeFrame, probability } = body;

      if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      // Verify tenant access
      const existing = await prisma.riskLikelihood.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this likelihood");
      }

      const likelihood = await prisma.riskLikelihood.update({
        where: { id },
        data: {
          title: title.trim(),
          score: parseInt(score) || 0,
          timeFrame: timeFrame?.trim() || null,
          probability: probability?.trim() || null,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskLikelihood', likelihood.id, { title: likelihood.title, timeFrame: likelihood.timeFrame, probability: likelihood.probability });

      return NextResponse.json(likelihood);
    } catch (error: unknown) {
      console.error("Error updating risk likelihood:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update risk likelihood" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE risk likelihood - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify tenant access
      const existing = await prisma.riskLikelihood.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this likelihood");
      }

      await prisma.riskLikelihood.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'RiskLikelihood', id);
      return NextResponse.json({ message: "Likelihood deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting risk likelihood:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete risk likelihood" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
