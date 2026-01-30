import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

// GET single framework with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Calculate dynamic compliance percentages based on controls linked through requirements
    // This matches what the controls page displays (requirement-linked controls, not direct framework controls)
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
}

// PUT update framework
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
}

// DELETE framework
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.framework.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Framework deleted successfully" });
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
}
