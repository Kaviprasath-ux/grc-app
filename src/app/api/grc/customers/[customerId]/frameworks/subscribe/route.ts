import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ customerId: string }>;
}

/**
 * POST /api/grc/customers/[customerId]/frameworks/subscribe
 * Subscribe or suggest a master framework for a customer.
 * Clones the framework with requirement categories, requirements, and controls
 * into the customer's account.
 *
 * Body: { frameworkId: string, action: "subscribe" | "suggest" }
 * GRCAdministrator only.
 */
export async function POST(req: NextRequest, context: RouteContext) {
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
    const body = await req.json();
    const { frameworkId, action } = body;

    if (!frameworkId || !action) {
      return NextResponse.json(
        { error: "frameworkId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "subscribe" && action !== "suggest") {
      return NextResponse.json(
        { error: "action must be 'subscribe' or 'suggest'" },
        { status: 400 }
      );
    }

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

    const customerAccountId = customerUser.customerAccountId;

    // Fetch the source framework with all related data
    // Include controls both directly (via frameworkId) and through requirements (via RequirementControl)
    const sourceFramework = await prisma.framework.findUnique({
      where: { id: frameworkId },
      include: {
        requirementCategories: true,
        requirements: {
          include: {
            controls: {
              include: {
                control: {
                  include: {
                    domain: true,
                    policyControls: {
                      include: {
                        policy: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        controls: {
          include: {
            domain: true,
            policyControls: {
              include: {
                policy: true,
              },
            },
          },
        },
        evidences: {
          include: {
            evidenceControls: {
              include: {
                control: true, // Include the control details for evidence-control links
              },
            },
          },
        },
      },
    });

    if (!sourceFramework) {
      return NextResponse.json(
        { error: "Source framework not found" },
        { status: 404 }
      );
    }

    // Debug: Log what data the source framework has
    console.log(`Subscribing framework: ${sourceFramework.name}`);
    console.log(`  - Requirement Categories: ${sourceFramework.requirementCategories.length}`);
    console.log(`  - Requirements: ${sourceFramework.requirements.length}`);
    console.log(`  - Direct Controls: ${sourceFramework.controls.length}`);
    console.log(`  - Evidences: ${sourceFramework.evidences.length}`);

    // Count RequirementControl links
    let totalReqControlLinks = 0;
    for (const req of sourceFramework.requirements) {
      totalReqControlLinks += req.controls.length;
    }
    console.log(`  - RequirementControl links: ${totalReqControlLinks}`);

    // Count EvidenceControl links
    let totalEvControlLinks = 0;
    for (const ev of sourceFramework.evidences) {
      totalEvControlLinks += ev.evidenceControls.length;
    }
    console.log(`  - EvidenceControl links: ${totalEvControlLinks}`);

    // Count PolicyControl links
    let totalPolicyControlLinks = 0;
    for (const ctrl of sourceFramework.controls) {
      totalPolicyControlLinks += ctrl.policyControls.length;
    }
    console.log(`  - PolicyControl links: ${totalPolicyControlLinks}`);

    // Check if customer already has a framework with this name
    const existing = await prisma.framework.findFirst({
      where: {
        customerAccountId,
        name: sourceFramework.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Customer already has a framework with this name" },
        { status: 409 }
      );
    }

    const frameworkStatus = action === "subscribe" ? "Subscribed" : "Suggested";

    // Clone framework and all related data in a transaction
    const clonedFramework = await prisma.$transaction(async (tx) => {
      // 1. Create the cloned framework with reference to source
      const newFramework = await tx.framework.create({
        data: {
          customerAccountId,
          code: sourceFramework.code,
          name: sourceFramework.name,
          description: sourceFramework.description,
          version: sourceFramework.version,
          type: sourceFramework.type,
          status: frameworkStatus,
          country: sourceFramework.country,
          industry: sourceFramework.industry,
          isCustom: false,
          isMasterTemplate: false, // Customer copies are never master templates
          sourceFrameworkId: sourceFramework.id, // Link back to source for tracking
          logo: sourceFramework.logo,
          supportDocumentUrl: sourceFramework.supportDocumentUrl,
          compliancePercentage: 0, // Start fresh for customer
          policyPercentage: 0,
          evidencePercentage: 0,
        },
      });

      // 2. Clone requirement categories (map old ID -> new ID)
      const categoryIdMap = new Map<string, string>();
      for (const cat of sourceFramework.requirementCategories) {
        const newCat = await tx.requirementCategory.create({
          data: {
            customerAccountId,
            name: cat.name,
            code: cat.code,
            description: cat.description,
            sortOrder: cat.sortOrder,
            frameworkId: newFramework.id,
          },
        });
        categoryIdMap.set(cat.id, newCat.id);
      }

      // 3. Collect ALL controls - from direct links, requirements, and evidences
      // This ensures we don't miss controls that are only linked via RequirementControl or EvidenceControl
      const allControlsMap = new Map<string, typeof sourceFramework.controls[0]>();

      // Add controls directly linked to framework
      for (const ctrl of sourceFramework.controls) {
        allControlsMap.set(ctrl.id, ctrl);
      }

      // Add controls linked through requirements (via RequirementControl)
      for (const req of sourceFramework.requirements) {
        for (const rc of req.controls) {
          if (rc.control && !allControlsMap.has(rc.control.id)) {
            allControlsMap.set(rc.control.id, rc.control as typeof sourceFramework.controls[0]);
          }
        }
      }

      // Add controls linked through evidences (via EvidenceControl)
      for (const ev of sourceFramework.evidences) {
        for (const ec of ev.evidenceControls) {
          if (ec.control && !allControlsMap.has(ec.control.id)) {
            // Fetch full control details if needed (ec.control only has basic info)
            const fullControl = await tx.control.findUnique({
              where: { id: ec.control.id },
              include: {
                domain: true,
                policyControls: {
                  include: {
                    policy: true,
                  },
                },
              },
            });
            if (fullControl) {
              allControlsMap.set(ec.control.id, fullControl as typeof sourceFramework.controls[0]);
            }
          }
        }
      }

      const allControls = Array.from(allControlsMap.values());

      // 4. Clone control domains (find or create in customer's account)
      const domainIdMap = new Map<string, string>();
      for (const ctrl of allControls) {
        if (ctrl.domain && ctrl.domainId && !domainIdMap.has(ctrl.domainId)) {
          // Try to find existing domain with same name in customer's account
          let existingDomain = await tx.controlDomain.findFirst({
            where: {
              customerAccountId,
              name: ctrl.domain.name,
            },
          });
          if (!existingDomain) {
            existingDomain = await tx.controlDomain.create({
              data: {
                customerAccountId,
                code: ctrl.domain.code,
                name: ctrl.domain.name,
              },
            });
          }
          domainIdMap.set(ctrl.domainId, existingDomain.id);
        }
      }

      // 5. Clone or reuse controls linked to this framework (map old ID -> new ID)
      // If control with same code exists (from previous subscription), reuse it
      const controlIdMap = new Map<string, string>();
      for (const ctrl of allControls) {
        // Check if control with same code already exists for this customer
        const existingCtrl = await tx.control.findFirst({
          where: {
            customerAccountId,
            controlCode: ctrl.controlCode,
          },
        });

        if (existingCtrl) {
          // Reuse existing control - update its framework reference
          await tx.control.update({
            where: { id: existingCtrl.id },
            data: {
              frameworkId: newFramework.id,
              domainId: ctrl.domainId ? domainIdMap.get(ctrl.domainId) || existingCtrl.domainId : existingCtrl.domainId,
            },
          });
          controlIdMap.set(ctrl.id, existingCtrl.id);
        } else {
          // Create new control
          const newCtrl = await tx.control.create({
            data: {
              customerAccountId,
              controlCode: ctrl.controlCode,
              name: ctrl.name,
              description: ctrl.description,
              controlQuestion: ctrl.controlQuestion,
              functionalGrouping: ctrl.functionalGrouping,
              status: ctrl.status,
              entities: ctrl.entities,
              isControlList: ctrl.isControlList,
              relativeControlWeighting: ctrl.relativeControlWeighting,
              scope: ctrl.scope,
              notPerformed: ctrl.notPerformed,
              performedInformally: ctrl.performedInformally,
              plannedAndTracked: ctrl.plannedAndTracked,
              wellDefined: ctrl.wellDefined,
              quantitativelyControlled: ctrl.quantitativelyControlled,
              continuouslyImproving: ctrl.continuouslyImproving,
              frameworkId: newFramework.id,
              domainId: ctrl.domainId ? domainIdMap.get(ctrl.domainId) || null : null,
            },
          });
          controlIdMap.set(ctrl.id, newCtrl.id);
        }
      }

      // 6. Clone requirements - first pass without parentId
      const requirementIdMap = new Map<string, string>();
      for (const req of sourceFramework.requirements) {
        const newReq = await tx.requirement.create({
          data: {
            customerAccountId,
            code: req.code,
            name: req.name,
            description: req.description,
            requirementType: req.requirementType,
            chapterType: req.chapterType,
            sortOrder: req.sortOrder,
            level: req.level,
            frameworkId: newFramework.id,
            categoryId: req.categoryId
              ? categoryIdMap.get(req.categoryId) || null
              : null,
            applicability: req.applicability,
            justification: req.justification,
            implementationStatus: req.implementationStatus,
            controlCompliance: req.controlCompliance,
          },
        });
        requirementIdMap.set(req.id, newReq.id);
      }

      // Second pass: wire up parentId references for hierarchy
      for (const req of sourceFramework.requirements) {
        if (req.parentId) {
          const newParentId = requirementIdMap.get(req.parentId);
          const newReqId = requirementIdMap.get(req.id);
          if (newParentId && newReqId) {
            await tx.requirement.update({
              where: { id: newReqId },
              data: { parentId: newParentId },
            });
          }
        }
      }

      // 7. Clone RequirementControl join records
      for (const req of sourceFramework.requirements) {
        const newReqId = requirementIdMap.get(req.id);
        if (!newReqId) continue;

        for (const rc of req.controls) {
          const newCtrlId = controlIdMap.get(rc.controlId);
          if (newCtrlId) {
            await tx.requirementControl.create({
              data: {
                requirementId: newReqId,
                controlId: newCtrlId,
              },
            });
          }
        }
      }

      // 8. Clone or reuse evidences linked to this framework
      // If evidence with same code exists (from previous subscription), reuse it
      const evidenceIdMap = new Map<string, string>();
      for (const ev of sourceFramework.evidences) {
        // Check if evidence with same code already exists for this customer
        const existingEvidence = await tx.evidence.findFirst({
          where: {
            customerAccountId,
            evidenceCode: ev.evidenceCode,
          },
        });

        if (existingEvidence) {
          // Reuse existing evidence - update its framework reference
          await tx.evidence.update({
            where: { id: existingEvidence.id },
            data: {
              frameworkId: newFramework.id,
              controlId: ev.controlId ? controlIdMap.get(ev.controlId) || existingEvidence.controlId : existingEvidence.controlId,
            },
          });
          evidenceIdMap.set(ev.id, existingEvidence.id);
        } else {
          // Create new evidence
          const newEvidence = await tx.evidence.create({
            data: {
              customerAccountId,
              evidenceCode: ev.evidenceCode,
              name: ev.name,
              description: ev.description,
              domain: ev.domain,
              frameworkId: newFramework.id,
              controlId: ev.controlId ? controlIdMap.get(ev.controlId) || null : null,
              recurrence: ev.recurrence,
              status: ev.status,
              kpiRequired: ev.kpiRequired,
              kpiObjective: ev.kpiObjective,
              kpiDataSource: ev.kpiDataSource,
              kpiExpectedScore: ev.kpiExpectedScore,
              kpiDescription: ev.kpiDescription,
              kpiCalculationFormula: ev.kpiCalculationFormula,
            },
          });
          evidenceIdMap.set(ev.id, newEvidence.id);
        }
      }

      // 9. Clone EvidenceControl join records
      for (const ev of sourceFramework.evidences) {
        const newEvId = evidenceIdMap.get(ev.id);
        if (!newEvId) continue;

        for (const ec of ev.evidenceControls) {
          const newCtrlId = controlIdMap.get(ec.controlId);
          if (newCtrlId) {
            // Avoid duplicate entries when reusing existing evidences/controls
            const existingEc = await tx.evidenceControl.findFirst({
              where: { evidenceId: newEvId, controlId: newCtrlId },
            });
            if (!existingEc) {
              await tx.evidenceControl.create({
                data: {
                  evidenceId: newEvId,
                  controlId: newCtrlId,
                },
              });
            }
          }
        }
      }

      // 10. Clone or reuse policies linked to this framework's controls
      // If policy with same code exists (from previous subscription), reuse it
      const policyIdMap = new Map<string, string>();
      const policyControlPairs: { oldPolicyId: string; oldControlId: string }[] = [];

      for (const ctrl of allControls) {
        for (const pc of ctrl.policyControls) {
          // Track all policy-control pairs
          policyControlPairs.push({
            oldPolicyId: pc.policyId,
            oldControlId: pc.controlId,
          });

          // Clone or reuse each policy only once
          if (!policyIdMap.has(pc.policyId)) {
            const sourcePolicy = pc.policy;

            // Check if policy with same code already exists for this customer
            const existingPolicy = await tx.policy.findFirst({
              where: {
                customerAccountId,
                code: sourcePolicy.code,
              },
            });

            if (existingPolicy) {
              // Reuse existing policy
              policyIdMap.set(pc.policyId, existingPolicy.id);
            } else {
              // Create new policy
              const newPolicy = await tx.policy.create({
                data: {
                  customerAccountId,
                  code: sourcePolicy.code,
                  name: sourcePolicy.name,
                  version: sourcePolicy.version,
                  documentType: sourcePolicy.documentType,
                  recurrence: sourcePolicy.recurrence,
                  status: sourcePolicy.status,
                  content: sourcePolicy.content,
                },
              });
              policyIdMap.set(pc.policyId, newPolicy.id);
            }
          }
        }
      }

      // 11. Clone PolicyControl join records
      for (const pair of policyControlPairs) {
        const newPolicyId = policyIdMap.get(pair.oldPolicyId);
        const newCtrlId = controlIdMap.get(pair.oldControlId);
        if (newPolicyId && newCtrlId) {
          // Avoid duplicate entries
          const existing = await tx.policyControl.findFirst({
            where: { policyId: newPolicyId, controlId: newCtrlId },
          });
          if (!existing) {
            await tx.policyControl.create({
              data: {
                policyId: newPolicyId,
                controlId: newCtrlId,
              },
            });
          }
        }
      }

      // Log summary of what was created
      console.log(`Subscription completed for ${newFramework.name}:`);
      console.log(`  - Categories created: ${categoryIdMap.size}`);
      console.log(`  - Controls processed: ${controlIdMap.size}`);
      console.log(`  - Requirements created: ${requirementIdMap.size}`);
      console.log(`  - Evidences processed: ${evidenceIdMap.size}`);
      console.log(`  - Policies processed: ${policyIdMap.size}`);

      return newFramework;
    });

    return NextResponse.json(
      {
        message: `Framework "${sourceFramework.name}" ${action === "subscribe" ? "subscribed" : "added to suggestions"} successfully`,
        framework: clonedFramework,
        stats: {
          categories: sourceFramework.requirementCategories.length,
          requirements: sourceFramework.requirements.length,
          controls: sourceFramework.controls.length,
          evidences: sourceFramework.evidences.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error subscribing framework:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
