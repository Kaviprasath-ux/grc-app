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
    const sourceFramework = await prisma.framework.findUnique({
      where: { id: frameworkId },
      include: {
        requirementCategories: true,
        requirements: {
          include: {
            controls: true, // RequirementControl join records
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
            evidenceControls: true,
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
      // 1. Create the cloned framework
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
          logo: sourceFramework.logo,
          supportDocumentUrl: sourceFramework.supportDocumentUrl,
          compliancePercentage: sourceFramework.compliancePercentage,
          policyPercentage: sourceFramework.policyPercentage,
          evidencePercentage: sourceFramework.evidencePercentage,
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

      // 3. Clone control domains (find or create in customer's account)
      const domainIdMap = new Map<string, string>();
      for (const ctrl of sourceFramework.controls) {
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

      // 4. Clone controls linked to this framework (map old ID -> new ID)
      const controlIdMap = new Map<string, string>();
      for (const ctrl of sourceFramework.controls) {
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

      // 5. Clone requirements - first pass without parentId
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

      // 6. Clone RequirementControl join records
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

      // 7. Clone evidences linked to this framework
      const evidenceIdMap = new Map<string, string>();
      for (const ev of sourceFramework.evidences) {
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

      // 8. Clone EvidenceControl join records
      for (const ev of sourceFramework.evidences) {
        const newEvId = evidenceIdMap.get(ev.id);
        if (!newEvId) continue;

        for (const ec of ev.evidenceControls) {
          const newCtrlId = controlIdMap.get(ec.controlId);
          if (newCtrlId) {
            await tx.evidenceControl.create({
              data: {
                evidenceId: newEvId,
                controlId: newCtrlId,
              },
            });
          }
        }
      }

      // 9. Clone policies linked to this framework's controls
      const policyIdMap = new Map<string, string>();
      const policyControlPairs: { oldPolicyId: string; oldControlId: string }[] = [];

      for (const ctrl of sourceFramework.controls) {
        for (const pc of ctrl.policyControls) {
          // Track all policy-control pairs
          policyControlPairs.push({
            oldPolicyId: pc.policyId,
            oldControlId: pc.controlId,
          });

          // Clone each policy only once
          if (!policyIdMap.has(pc.policyId)) {
            const sourcePolicy = pc.policy;
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

      // 10. Clone PolicyControl join records
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

      return newFramework;
    });

    return NextResponse.json(
      {
        message: `Framework "${sourceFramework.name}" ${action === "subscribe" ? "subscribed" : "added to suggestions"} successfully`,
        framework: clonedFramework,
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
