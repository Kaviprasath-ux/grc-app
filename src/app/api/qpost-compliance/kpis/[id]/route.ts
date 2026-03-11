import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";
import { translateRecord } from "@/lib/translation-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single QPost KPI with reviews - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const kpi = await prisma.qPostKPI.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: true,
          evidence: {
            include: {
              attachments: true,
              department: true,
            },
          },
          reviews: {
            include: {
              actionPlans: {
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { reviewDate: "desc" },
          },
        },
      });

      if (!kpi) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(kpi);
    } catch (error) {
      console.error("Error fetching QPost KPI:", error);
      return NextResponse.json(
        { error: "Failed to fetch KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.kpi", action: "view" }
);

// PUT update QPost KPI - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        objective,
        description,
        dataSource,
        calculationFormula,
        expectedScore,
        actualScore,
        reviewDate,
        status,
        departmentId,
        evidenceId,
      } = body;

      // First, verify the KPI belongs to the user's customer account
      const existing = await prisma.qPostKPI.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          code: true,
          objective: true,
          actualScore: true,
          evidence: {
            select: { assigneeId: true },
          },
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this KPI");
      }

      const kpi = await prisma.qPostKPI.update({
        where: { id },
        data: {
          objective,
          description,
          dataSource,
          calculationFormula,
          expectedScore: expectedScore !== undefined ? (expectedScore !== null ? parseFloat(expectedScore) : null) : undefined,
          actualScore: actualScore !== undefined ? (actualScore !== null ? parseFloat(actualScore) : null) : undefined,
          reviewDate: reviewDate ? new Date(reviewDate) : undefined,
          status,
          departmentId: departmentId || undefined,
          evidenceId: evidenceId || undefined,
        },
        include: {
          department: true,
          evidence: {
            include: {
              department: true,
            },
          },
          reviews: {
            orderBy: { reviewDate: "desc" },
          },
        },
      });

      // Trigger background translation
      if (existing.customerAccountId) {
        void translateRecord(existing.customerAccountId, "QPostKPI", kpi.id, {
          objective: kpi.objective || "",
          description: kpi.description || "",
          dataSource: kpi.dataSource || "",
          calculationFormula: kpi.calculationFormula || "",
        });
      }

      // Send KPI score update notification if score changed
      const newScore = actualScore !== undefined ? parseFloat(actualScore) : null;
      const oldScore = existing.actualScore;
      const scoreChanged = newScore !== null && newScore !== oldScore;

      if (scoreChanged && existing.customerAccountId && session.customerAccountId) {
        // Notify evidence assignee about KPI score update
        const recipientId = kpi.evidence?.assigneeId || existing.evidence?.assigneeId;
        if (recipientId && recipientId !== session.id) {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: recipientId,
            event: NOTIFICATION_EVENTS.KPI_SCORE_UPDATED,
            title: 'KPI Score Updated',
            message: `KPI "${kpi.code}: ${kpi.objective || 'Unnamed'}" score has been updated to ${newScore}.`,
            relatedEntityType: 'kpi',
            relatedEntityId: kpi.id,
            link: `/qpost-compliance/kpis/${kpi.id}`,
            metadata: {
              entityName: kpi.objective || kpi.code,
              kpiCode: kpi.code,
              kpiObjective: kpi.objective,
              oldScore: oldScore,
              newScore: newScore,
              updatedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(kpi);
    } catch (error: unknown) {
      console.error("Error updating QPost KPI:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.kpi", action: "edit" }
);

// DELETE QPost KPI - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the KPI belongs to the user's customer account
      const existing = await prisma.qPostKPI.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this KPI");
      }

      await prisma.qPostKPI.delete({
        where: { id },
      });

      return NextResponse.json({ message: "KPI deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting QPost KPI:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.kpi", action: "delete" }
);
