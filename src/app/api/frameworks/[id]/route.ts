import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// Types for the complex nested structure from Prisma
interface PolicyControlWithPolicy {
  policy: { id: string; status: string };
}

interface EvidenceControlWithEvidence {
  evidence: { id: string; status: string };
}

interface ControlWithRelations {
  id: string;
  status: string;
  policyControls?: PolicyControlWithPolicy[];
  evidenceControls?: EvidenceControlWithEvidence[];
}

interface RequirementControlWithControl {
  control?: ControlWithRelations;
}

interface RequirementWithControls {
  controls?: RequirementControlWithControl[];
}

// Helper function to calculate compliance percentage from controls
function calculateCompliancePercentage(controls: { status: string }[]): number {
  if (!controls || controls.length === 0) {
    return 0;
  }
  const compliantCount = controls.filter(c => c.status === "Compliant").length;
  const percentage = (compliantCount / controls.length) * 100;
  // Round to one decimal place
  return Math.round(percentage * 10) / 10;
}

// Helper function to extract unique controls from requirements
function extractControlsFromRequirements(
  requirements: RequirementWithControls[]
): ControlWithRelations[] {
  const controlsMap = new Map<string, ControlWithRelations>();

  if (requirements && Array.isArray(requirements)) {
    for (const req of requirements) {
      if (req.controls && Array.isArray(req.controls)) {
        for (const rc of req.controls) {
          if (rc.control && rc.control.id) {
            // De-duplicate by control ID
            if (!controlsMap.has(rc.control.id)) {
              controlsMap.set(rc.control.id, rc.control);
            }
          }
        }
      }
    }
  }

  return Array.from(controlsMap.values());
}

// Helper function to calculate Policy compliance percentage
// Traversal: Framework → Requirements → Controls → PolicyControl → Policy
// Compliant statuses: "Approved", "Published"
function calculatePolicyCompliancePercentage(controls: ControlWithRelations[]): number {
  const policiesMap = new Map<string, { status: string }>();

  for (const control of controls) {
    if (control.policyControls && Array.isArray(control.policyControls)) {
      for (const pc of control.policyControls) {
        if (pc.policy && pc.policy.id) {
          // De-duplicate by policy ID
          if (!policiesMap.has(pc.policy.id)) {
            policiesMap.set(pc.policy.id, { status: pc.policy.status });
          }
        }
      }
    }
  }

  const policies = Array.from(policiesMap.values());
  if (policies.length === 0) {
    return 0;
  }

  // Count policies with compliant status (Approved or Published)
  const compliantCount = policies.filter(
    p => p.status === "Approved" || p.status === "Published"
  ).length;
  const percentage = (compliantCount / policies.length) * 100;
  // Round to one decimal place
  return Math.round(percentage * 10) / 10;
}

// Helper function to calculate Evidence compliance percentage
// Traversal: Framework → Requirements → Controls → EvidenceControl → Evidence
// Compliant statuses: "Published", "Validated"
function calculateEvidenceCompliancePercentage(controls: ControlWithRelations[]): number {
  const evidenceMap = new Map<string, { status: string }>();

  for (const control of controls) {
    if (control.evidenceControls && Array.isArray(control.evidenceControls)) {
      for (const ec of control.evidenceControls) {
        if (ec.evidence && ec.evidence.id) {
          // De-duplicate by evidence ID
          if (!evidenceMap.has(ec.evidence.id)) {
            evidenceMap.set(ec.evidence.id, { status: ec.evidence.status });
          }
        }
      }
    }
  }

  const evidences = Array.from(evidenceMap.values());
  if (evidences.length === 0) {
    return 0;
  }

  // Count evidence with compliant status (Published or Validated)
  const compliantCount = evidences.filter(
    e => e.status === "Published" || e.status === "Validated"
  ).length;
  const percentage = (compliantCount / evidences.length) * 100;
  // Round to one decimal place
  return Math.round(percentage * 10) / 10;
}

/**
 * Check if user can access a framework based on multi-tenant rules:
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

// GET single framework with all related data
export const GET = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };

      // First fetch the framework to check tenant access
      const framework = await prisma.framework.findUnique({
        where: { id },
        include: {
          controls: {
            include: {
              domain: true,
              owner: true,
              assignee: true,
            },
          },
          evidences: true,
          requirements: {
            include: {
              category: true,
              controls: {
                include: {
                  control: {
                    include: {
                      policyControls: {
                        include: {
                          policy: {
                            select: { id: true, status: true },
                          },
                        },
                      },
                      evidenceControls: {
                        include: {
                          evidence: {
                            select: { id: true, status: true },
                          },
                        },
                      },
                    },
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

      // Calculate dynamic compliance percentages based on controls linked through requirements
      const requirementControls = extractControlsFromRequirements(framework.requirements as RequirementWithControls[]);
      const compliancePercentage = calculateCompliancePercentage(requirementControls);
      const policyPercentage = calculatePolicyCompliancePercentage(requirementControls);
      const evidencePercentage = calculateEvidenceCompliancePercentage(requirementControls);

      return NextResponse.json({
        ...framework,
        compliancePercentage,
        policyPercentage,
        evidencePercentage,
      });
    } catch (error) {
      console.error("Error fetching framework:", error);
      return NextResponse.json(
        { error: "Failed to fetch framework" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "view" }
);

// PUT update framework
export const PUT = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };

      // First fetch the framework to check tenant access
      const existingFramework = await prisma.framework.findUnique({
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

      const framework = await prisma.framework.update({
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
        void translateRecord(session.customerAccountId, 'Framework', framework.id, {
          name: framework.name,
          description: framework.description,
          country: framework.country,
          industry: framework.industry,
        });
      }

      return NextResponse.json(framework);
    } catch (error: unknown) {
      console.error("Error updating framework:", error);
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
  { resource: "compliance.framework", action: "edit" }
);

// DELETE framework (or unsubscribe/archive for master templates)
export const DELETE = withAuth(
  async (request, context, session) => {
    try {
      const { id } = await context.params as { id: string };
      const { searchParams } = new URL(request.url);
      const forceDelete = searchParams.get("force") === "true";

      // First fetch the framework with subscription info
      const existingFramework = await prisma.framework.findUnique({
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
        await prisma.framework.update({
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
        // Get all control IDs linked to this framework
        const controls = await tx.control.findMany({
          where: { frameworkId: id },
          select: { id: true },
        });
        const controlIds = controls.map((c) => c.id);

        // Get all evidence IDs linked to this framework
        const evidences = await tx.evidence.findMany({
          where: { frameworkId: id },
          select: { id: true },
        });
        const evidenceIds = evidences.map((e) => e.id);

        // Get all policy IDs linked to these controls (via PolicyControl)
        const policyControls = await tx.policyControl.findMany({
          where: { controlId: { in: controlIds } },
          select: { policyId: true },
        });
        const policyIds = [...new Set(policyControls.map((pc) => pc.policyId))];

        // 1. Nullify references in Exception (non-cascade FKs)
        if (controlIds.length > 0) {
          await tx.exception.updateMany({
            where: { controlId: { in: controlIds } },
            data: { controlId: null },
          });
        }
        if (policyIds.length > 0) {
          await tx.exception.updateMany({
            where: { policyId: { in: policyIds } },
            data: { policyId: null },
          });
        }
        if (evidenceIds.length > 0) {
          // Nullify legacy controlId on evidences before deleting controls
          await tx.evidence.updateMany({
            where: { controlId: { in: controlIds } },
            data: { controlId: null },
          });
        }

        // 2. Delete evidences linked to this framework (cascades: EvidenceControl, EvidenceCycle, EvidenceArtifact, Artifact, EvidenceCycleComment)
        if (evidenceIds.length > 0) {
          await tx.evidence.deleteMany({
            where: { id: { in: evidenceIds } },
          });
        }

        // 3. Delete policies linked to this framework's controls (cascades: PolicyControl, PolicyVersion, PolicyReview)
        if (policyIds.length > 0) {
          await tx.policy.deleteMany({
            where: { id: { in: policyIds } },
          });
        }

        // 4. Delete controls linked to this framework (cascades: RequirementControl, EvidenceControl, PolicyControl, ControlRisk)
        if (controlIds.length > 0) {
          await tx.control.deleteMany({
            where: { id: { in: controlIds } },
          });
        }

        // 5. Delete the framework (cascades: RequirementCategory, Requirement)
        await tx.framework.delete({
          where: { id },
        });
      });

      // Fire-and-forget translation cleanup
      if (session.customerAccountId) {
        void deleteRecordTranslations(session.customerAccountId, 'Framework', id);
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
      console.error("Error deleting framework:", error);
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
  { resource: "compliance.framework", action: "delete" }
);
