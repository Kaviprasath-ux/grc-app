import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId, getTenantFilter } from "@/lib/api-auth";

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
// This is used for compliance calculation as controls are linked via RequirementControl
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

// GET all frameworks
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const type = searchParams.get("type");

      const isGRCAdmin = session.roles.includes("GRCAdministrator");

      // For GRC Administrator: return ALL frameworks (global access for system admin)
      if (isGRCAdmin) {
        const tenantFilter = getTenantFilter(session, { globalAccess: true });
        const where: Record<string, unknown> = { ...tenantFilter };
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
        // Using controls linked through requirements (matches controls page display)
        const frameworksWithCompliance = frameworks.map(fw => {
          const requirementControls = extractControlsFromRequirements(fw.requirements);
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
      }

      // For Customer Admin and other roles:
      // 1. Fetch their own frameworks (subscribed)
      // 2. Fetch master frameworks from GRC Admin accounts (for "Not Subscribed" filter)

      const customerAccountId = session.customerAccountId;
      if (!customerAccountId) {
        return NextResponse.json([]);
      }

      // Get customer's own frameworks
      const customerWhere: Record<string, unknown> = { customerAccountId };
      if (type) customerWhere.type = type;

      const customerFrameworks = await prisma.framework.findMany({
        where: customerWhere,
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

      // Get GRC Admin accounts (master framework sources)
      const grcAdminAccounts = await prisma.customerAccount.findMany({
        where: {
          code: { startsWith: "GRC_ADMIN_" },
        },
        select: { id: true },
      });

      const grcAdminAccountIds = grcAdminAccounts.map((a) => a.id);

      // Get master frameworks from GRC Admin accounts
      const masterWhere: Record<string, unknown> = {
        customerAccountId: { in: grcAdminAccountIds },
      };
      if (type) masterWhere.type = type;

      const masterFrameworks = await prisma.framework.findMany({
        where: masterWhere,
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

      // Build a set of subscribed framework names/codes for comparison
      const subscribedNames = new Set(
        customerFrameworks.map((f) => f.name.toLowerCase())
      );
      const subscribedCodes = new Set(
        customerFrameworks.filter((f) => f.code).map((f) => f.code!.toLowerCase())
      );

      // Process customer frameworks with dynamic compliance calculation
      // Using controls linked through requirements (matches controls page display)
      const processedCustomerFrameworks = customerFrameworks.map(fw => {
        const requirementControls = extractControlsFromRequirements(fw.requirements);
        const compliancePercentage = calculateCompliancePercentage(requirementControls);
        const policyPercentage = calculatePolicyCompliancePercentage(requirementControls);
        const evidencePercentage = calculateEvidenceCompliancePercentage(requirementControls);
        const { requirements, ...rest } = fw;
        return {
          ...rest,
          compliancePercentage,
          policyPercentage,
          evidencePercentage,
        };
      });

      // Combine: customer frameworks + master frameworks (marked as "Not Subscribed")
      const allFrameworks = [...processedCustomerFrameworks];

      for (const master of masterFrameworks) {
        // Check if customer already has this framework (by name or code)
        const isSubscribed =
          subscribedNames.has(master.name.toLowerCase()) ||
          (master.code && subscribedCodes.has(master.code.toLowerCase()));

        if (!isSubscribed) {
          // Calculate compliance percentages for master framework too
          // Using controls linked through requirements (matches controls page display)
          const requirementControls = extractControlsFromRequirements(master.requirements);
          const compliancePercentage = calculateCompliancePercentage(requirementControls);
          const policyPercentage = calculatePolicyCompliancePercentage(requirementControls);
          const evidencePercentage = calculateEvidenceCompliancePercentage(requirementControls);
          const { requirements, ...rest } = master;
          // Add master framework as "Not Subscribed" for customer view
          allFrameworks.push({
            ...rest,
            compliancePercentage,
            policyPercentage,
            evidencePercentage,
            status: "Not Subscribed",
          });
        }
      }

      // Apply status filter if provided
      let filteredFrameworks = allFrameworks;
      if (status) {
        filteredFrameworks = allFrameworks.filter((f) => f.status === status);
      }

      // Sort by name
      filteredFrameworks.sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json(filteredFrameworks);
    } catch (error) {
      console.error("Error fetching frameworks:", error);
      return NextResponse.json(
        { error: "Failed to fetch frameworks" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "view" }
);

// POST create new framework
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        code,
        name,
        description,
        version,
        type,
        status,
        country,
        industry,
        isCustom,
        logo,
        supportDocumentUrl,
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Framework name is required" },
          { status: 400 }
        );
      }

      // Check if user has a customer account assigned
      if (!session.customerAccountId) {
        console.error("User does not have a customer account assigned:", session.id, session.roles);
        return NextResponse.json(
          { error: "User does not have a customer account assigned. Please contact an administrator." },
          { status: 400 }
        );
      }

      const customerAccountId = session.customerAccountId;

      const framework = await prisma.framework.create({
        data: {
          code: code || null,
          name,
          description,
          version,
          type: type || "Framework",
          status: status || "Subscribed",
          country,
          industry,
          isCustom: isCustom || false,
          logo,
          supportDocumentUrl,
          compliancePercentage: 0,
          policyPercentage: 0,
          evidencePercentage: 0,
          customerAccountId,
        },
      });

      return NextResponse.json(framework, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating framework:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Framework with this name already exists" },
          { status: 409 }
        );
      }
      // Return more detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to create framework: ${errorMessage}` },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "create" }
);
