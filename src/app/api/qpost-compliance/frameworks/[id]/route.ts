import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// Types for the requirement structure from Prisma
interface RequirementWithRelations {
  implementationStatus?: string | null;
  evidences?: { evidence: { id: string; status: string } }[];
  policies?: { policy: { id: string; status: string } }[];
}

// Helper function to calculate compliance percentage from requirements
// Based on requirements with implementationStatus === "Implemented"
function calculateCompliancePercentage(requirements: RequirementWithRelations[]): number {
  if (!requirements || requirements.length === 0) {
    return 0;
  }
  const implementedCount = requirements.filter(r => r.implementationStatus === "Implemented").length;
  const percentage = (implementedCount / requirements.length) * 100;
  return Math.round(percentage * 10) / 10;
}

// Helper function to calculate Policy percentage
// Count requirements that have at least one linked policy vs total requirements
function calculatePolicyPercentage(requirements: RequirementWithRelations[]): number {
  if (!requirements || requirements.length === 0) {
    return 0;
  }
  const withPolicy = requirements.filter(r => r.policies && r.policies.length > 0).length;
  const percentage = (withPolicy / requirements.length) * 100;
  return Math.round(percentage * 10) / 10;
}

// Helper function to calculate Evidence percentage
// Count requirements that have at least one linked evidence vs total requirements
function calculateEvidencePercentage(requirements: RequirementWithRelations[]): number {
  if (!requirements || requirements.length === 0) {
    return 0;
  }
  const withEvidence = requirements.filter(r => r.evidences && r.evidences.length > 0).length;
  const percentage = (withEvidence / requirements.length) * 100;
  return Math.round(percentage * 10) / 10;
}

/**
 * Check if user can access a QPost framework based on multi-tenant rules:
 * - GRCAdministrator (superadmin) has GLOBAL access to all frameworks
 * - CustomerAdministrator and other roles can only access their own frameworks
 * - For subscription flow, customers can VIEW master frameworks (but not modify)
 */
async function canAccessFramework(
  frameworkCustomerAccountId: string | null,
  session: { customerAccountId: string | null; roles: string[] },
  action: "view" | "edit" | "delete"
): Promise<boolean> {
  // If framework has no customer account, deny access (data integrity issue)
  if (!frameworkCustomerAccountId) {
    return false;
  }

  // GRCAdministrator (superadmin) has GLOBAL access to all frameworks
  // This is the system-level admin who needs to manage all customer frameworks
  if (session.roles.includes("GRCAdministrator")) {
    return true;
  }

  // For other roles (CustomerAdministrator, etc.)
  if (!session.customerAccountId) {
    return false;
  }

  // Check if this is the user's own framework
  if (frameworkCustomerAccountId === session.customerAccountId) {
    return true;
  }

  // For VIEW only: Allow access to master frameworks from GRC Admin accounts (for subscription flow)
  if (action === "view") {
    const frameworkAccount = await prisma.customerAccount.findUnique({
      where: { id: frameworkCustomerAccountId },
      select: { code: true },
    });
    // Allow viewing frameworks from GRC Admin accounts (master frameworks)
    if (frameworkAccount?.code?.startsWith("GRC_ADMIN_")) {
      return true;
    }
  }

  // Deny access to other customers' frameworks
  return false;
}

// GET single QPost framework with all related data
export const GET = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };

      // First fetch the framework to check tenant access
      const framework = await prisma.qPostFramework.findUnique({
        where: { id },
        include: {
          evidences: true,
          requirements: {
            include: {
              category: true,
              evidences: {
                include: {
                  evidence: {
                    select: { id: true, status: true },
                  },
                },
              },
              policies: {
                include: {
                  policy: {
                    select: { id: true, code: true, name: true, status: true },
                  },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          requirementCategories: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!framework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      const hasAccess = await canAccessFramework(framework.customerAccountId, session, "view");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied to this framework" },
          { status: 403 }
        );
      }

      // Calculate dynamic compliance percentages based on requirements directly
      const requirements = framework.requirements as RequirementWithRelations[];
      const compliancePercentage = calculateCompliancePercentage(requirements);
      const policyPercentage = calculatePolicyPercentage(requirements);
      const evidencePercentage = calculateEvidencePercentage(requirements);

      return NextResponse.json({
        ...framework,
        compliancePercentage,
        policyPercentage,
        evidencePercentage,
      });
    } catch (error) {
      console.error("Error fetching QPost framework:", error);
      return NextResponse.json(
        { error: "Failed to fetch framework" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.framework", action: "view" }
);

// PUT update QPost framework
export const PUT = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };

      // First fetch the framework to check tenant access
      const existingFramework = await prisma.qPostFramework.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingFramework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }

      // Validate tenant access for edit
      const hasAccess = await canAccessFramework(existingFramework.customerAccountId, session, "edit");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied. You can only edit frameworks in your own account." },
          { status: 403 }
        );
      }

      const body = await request.json();
      const {
        name,
        description,
        version,
        type,
        status,
        country,
        industry,
        logo,
        compliancePercentage,
        policyPercentage,
        evidencePercentage,
      } = body;

      const framework = await prisma.qPostFramework.update({
        where: { id },
        data: {
          name,
          description,
          version,
          type,
          status,
          country,
          industry,
          logo,
          compliancePercentage,
          policyPercentage,
          evidencePercentage,
        },
      });

      // Fire-and-forget translation
      if (session.customerAccountId) {
        void translateRecord(session.customerAccountId, 'QPostFramework', framework.id, {
          name: framework.name,
          description: framework.description,
          country: framework.country,
          industry: framework.industry,
        });
      }

      return NextResponse.json(framework);
    } catch (error: unknown) {
      console.error("Error updating QPost framework:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update framework" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.framework", action: "edit" }
);

// DELETE QPost framework (or unsubscribe/archive for master templates)
export const DELETE = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };
      const { searchParams } = new URL(request.url);
      const forceDelete = searchParams.get("force") === "true";

      // First fetch the framework with subscription info
      const existingFramework = await prisma.qPostFramework.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          name: true,
          status: true,
          isMasterTemplate: true,
          sourceFrameworkId: true,
          _count: {
            select: { subscribedCopies: true },
          },
        },
      });

      if (!existingFramework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }

      // Validate tenant access for delete
      const hasAccess = await canAccessFramework(existingFramework.customerAccountId, session, "delete");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied. You can only delete frameworks in your own account." },
          { status: 403 }
        );
      }

      // Check if this is a master template
      if (existingFramework.isMasterTemplate) {
        // Master templates should be archived, not deleted
        // Check if there are active subscriptions
        if (existingFramework._count.subscribedCopies > 0 && !forceDelete) {
          return NextResponse.json(
            {
              error: `Cannot delete master framework "${existingFramework.name}" - it has ${existingFramework._count.subscribedCopies} active subscription(s). Archive it instead or use force=true.`,
              subscribedCount: existingFramework._count.subscribedCopies,
              suggestion: "archive",
            },
            { status: 409 }
          );
        }

        // Archive the master template instead of deleting
        await prisma.qPostFramework.update({
          where: { id },
          data: { status: "Archived" },
        });

        return NextResponse.json({
          message: `Master framework "${existingFramework.name}" has been archived. It will no longer appear in the framework selection list but existing subscriptions are preserved.`,
          action: "archived",
        });
      }

      // For customer copies (subscriptions) - delete all linked data
      await prisma.$transaction(async (tx) => {
        // Get all evidence IDs linked to this framework
        const evidences = await tx.qPostEvidence.findMany({
          where: { frameworkId: id },
          select: { id: true },
        });
        const evidenceIds = evidences.map((e) => e.id);

        // 1. Delete evidences linked to this framework
        if (evidenceIds.length > 0) {
          await tx.qPostEvidence.deleteMany({
            where: { id: { in: evidenceIds } },
          });
        }

        // 2. Delete the framework (cascades: QPostRequirementCategory, QPostRequirement)
        await tx.qPostFramework.delete({
          where: { id },
        });
      });

      // Fire-and-forget translation cleanup
      if (session.customerAccountId) {
        void deleteRecordTranslations(session.customerAccountId, 'QPostFramework', id);
      }

      // Decrement frameworksUsed in the active subscription plan
      if (existingFramework.customerAccountId && existingFramework.status === "Subscribed") {
        const now = new Date();
        const activePlan = await prisma.subscriptionPlan.findFirst({
          where: {
            customerAccountId: existingFramework.customerAccountId,
            status: "Active",
            expiryDate: { gte: now },
          },
        });
        if (activePlan && activePlan.frameworksUsed > 0) {
          await prisma.subscriptionPlan.update({
            where: { id: activePlan.id },
            data: { frameworksUsed: { decrement: 1 } },
          });
        }
      }

      return NextResponse.json({
        message: existingFramework.sourceFrameworkId
          ? `Successfully unsubscribed from framework "${existingFramework.name}"`
          : `Framework "${existingFramework.name}" deleted successfully`,
        action: existingFramework.sourceFrameworkId ? "unsubscribed" : "deleted",
      });
    } catch (error: unknown) {
      console.error("Error deleting QPost framework:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete framework" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.framework", action: "delete" }
);
