import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

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
function calculatePolicyCompliancePercentage(controls: ControlWithRelations[]): number {
  const policiesMap = new Map<string, { status: string }>();

  for (const control of controls) {
    if (control.policyControls && Array.isArray(control.policyControls)) {
      for (const pc of control.policyControls) {
        if (pc.policy && pc.policy.id) {
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

  const compliantCount = policies.filter(
    p => p.status === "Approved" || p.status === "Published"
  ).length;
  const percentage = (compliantCount / policies.length) * 100;
  return Math.round(percentage * 10) / 10;
}

// Helper function to calculate Evidence compliance percentage
function calculateEvidenceCompliancePercentage(controls: ControlWithRelations[]): number {
  const evidenceMap = new Map<string, { status: string }>();

  for (const control of controls) {
    if (control.evidenceControls && Array.isArray(control.evidenceControls)) {
      for (const ec of control.evidenceControls) {
        if (ec.evidence && ec.evidence.id) {
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

  const compliantCount = evidences.filter(
    e => e.status === "Published" || e.status === "Validated"
  ).length;
  const percentage = (compliantCount / evidences.length) * 100;
  return Math.round(percentage * 10) / 10;
}

/**
 * GET /api/grc/customers/[customerId]/frameworks
 * Returns only frameworks belonging to the selected customer's account.
 * GRCAdministrator only.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    const { customerId } = await context.params;

    // Look up the customer user to get their customerAccountId
    const customerUser = await prisma.user.findUnique({
      where: { id: customerId },
      select: { customerAccountId: true },
    });

    if (!customerUser?.customerAccountId) {
      return NextResponse.json(
        { error: "Customer not found or has no account" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {
      customerAccountId: customerUser.customerAccountId,
    };
    if (status) where.status = status;
    if (type) where.type = type;

    const frameworks = await prisma.framework.findMany({
      where,
      include: {
        _count: {
          select: { controls: true, evidences: true, requirements: true },
        },
        requirements: {
          include: {
            controls: {
              include: {
                control: {
                  select: {
                    id: true,
                    status: true,
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
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate dynamic compliance percentages for each framework
    const frameworksWithCompliance = frameworks.map(fw => {
      const requirementControls = extractControlsFromRequirements(fw.requirements as RequirementWithControls[]);
      const compliancePercentage = calculateCompliancePercentage(requirementControls);
      const policyPercentage = calculatePolicyCompliancePercentage(requirementControls);
      const evidencePercentage = calculateEvidenceCompliancePercentage(requirementControls);
      // Remove the requirements array from response to keep payload small
      const { requirements, ...rest } = fw;
      return {
        ...rest,
        compliancePercentage,
        policyPercentage,
        evidencePercentage,
      };
    });

    return NextResponse.json(frameworksWithCompliance);
  } catch (error) {
    console.error("Error fetching customer frameworks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
