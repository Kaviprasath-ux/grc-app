import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET task queue items — filtered by tab (my-queue, reassessment, returned)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const tab = searchParams.get("tab") || "my-queue";
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status");
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = { ...tenantFilter };

      // Tab-specific filters
      switch (tab) {
        case "unassigned":
          // Submitted assessments with no assessor assigned (ready for assessor to claim)
          where.assessorId = null;
          where.status = "Submitted";
          break;
        case "my-queue":
          // Assessments assigned to current user (as assessor) that are in active states
          where.assessorId = session.id;
          where.status = { in: ["Draft", "In Progress", "Submitted", "Under Review"] };
          break;
        case "reassessment":
          // Completed assessments that can be reassessed
          where.status = { in: ["Completed", "Approved"] };
          break;
        case "returned":
          // Assessments that were returned/rejected
          where.status = { in: ["Returned", "Rejected"] };
          break;
      }

      // Common search filter
      if (search) {
        where.OR = [
          { assessmentCode: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      // Status override for returned tab
      if (tab === "returned" && status) {
        where.status = status;
      }

      // Date filter
      if (dateFrom || dateTo) {
        where.vendorSubmissionDate = {};
        if (dateFrom)
          (where.vendorSubmissionDate as Record<string, unknown>).gte = new Date(dateFrom);
        if (dateTo)
          (where.vendorSubmissionDate as Record<string, unknown>).lte = new Date(dateTo);
      }

      const [assessments, total] = await Promise.all([
        prisma.tPRMAssessment.findMany({
          where,
          include: {
            vendor: {
              select: { id: true, name: true, vendorCode: true, serviceCategory: true },
            },
            initiatedBy: { select: { id: true, fullName: true } },
            assessor: { select: { id: true, fullName: true } },
            approver: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.tPRMAssessment.count({ where }),
      ]);

      return NextResponse.json({
        data: assessments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + assessments.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching TPRM task queue:", error);
      return NextResponse.json(
        { error: "Failed to fetch task queue" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.task-queue", action: "view" }
);
