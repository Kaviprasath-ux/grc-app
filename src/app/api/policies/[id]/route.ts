import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single policy with all related data - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const policy = await prisma.policy.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
          policyControls: {
            include: {
              control: {
                include: {
                  domain: true,
                },
              },
            },
          },
          policyExceptions: {
            include: {
              exception: true,
            },
          },
          vaultDocumentLinks: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(policy);
    } catch (error) {
      console.error("Error fetching policy:", error);
      return NextResponse.json(
        { error: "Failed to fetch policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// PUT update policy - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        version,
        documentType,
        recurrence,
        departmentId,
        assigneeId,
        approverId,
        status,
        effectiveDate,
        reviewDate,
        content,
        aiReviewStatus,
        aiReviewScore,
        aiReviewJustification,
      } = body;

      // First, verify the policy belongs to the user's customer account
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      const policy = await prisma.policy.update({
        where: { id },
        data: {
          name,
          version,
          documentType,
          recurrence,
          departmentId,
          assigneeId,
          approverId,
          status,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          content,
          aiReviewStatus,
          aiReviewScore,
          aiReviewJustification,
        },
        include: {
          department: true,
          assignee: true,
          approver: true,
          attachments: true,
        },
      });

      return NextResponse.json(policy);
    } catch (error: unknown) {
      console.error("Error updating policy:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "edit" }
);

// DELETE policy - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the policy belongs to the user's customer account
      const existing = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      await prisma.policy.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Policy deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting policy:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete policy" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "delete" }
);
