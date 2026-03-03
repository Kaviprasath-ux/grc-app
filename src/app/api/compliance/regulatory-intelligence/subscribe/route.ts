import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

/**
 * POST /api/compliance/regulatory-intelligence/subscribe
 * Subscribe a master framework for the current customer account.
 * This is the customer-facing version of the GRC admin subscribe endpoint.
 * It clones the master framework (with categories, requirements, controls) into the customer's account.
 *
 * Body: { frameworkId: string }
 */
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { frameworkId } = body;

      if (!frameworkId) {
        return NextResponse.json(
          { error: "frameworkId is required" },
          { status: 400 }
        );
      }

      // Fetch the source (master) framework with related data
      const sourceFramework = await prisma.framework.findUnique({
        where: { id: frameworkId },
        include: {
          requirementCategories: true,
          requirements: {
            include: {
              controls: {
                include: {
                  control: true,
                },
              },
            },
          },
          controls: true,
        },
      });

      if (!sourceFramework) {
        return NextResponse.json(
          { error: "Framework not found" },
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
          { error: "You have already subscribed to this framework" },
          { status: 409 }
        );
      }

      // Clone framework and related data in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create cloned framework
        const newFramework = await tx.framework.create({
          data: {
            customerAccountId,
            code: sourceFramework.code,
            name: sourceFramework.name,
            description: sourceFramework.description,
            version: sourceFramework.version,
            type: sourceFramework.type,
            status: "Subscribed",
            isMasterTemplate: false,
            sourceFrameworkId: sourceFramework.id,
          },
        });

        // 2. Clone requirement categories
        const categoryMap = new Map<string, string>();
        for (const cat of sourceFramework.requirementCategories) {
          const newCat = await tx.requirementCategory.create({
            data: {
              customerAccountId,
              frameworkId: newFramework.id,
              name: cat.name,
              description: cat.description,
              sortOrder: cat.sortOrder,
            },
          });
          categoryMap.set(cat.id, newCat.id);
        }

        // 3. Clone requirements (handle parent hierarchy)
        const requirementMap = new Map<string, string>();
        // First pass: create requirements without parentId
        const sortedReqs = [...sourceFramework.requirements].sort(
          (a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0)
        );

        for (const req of sortedReqs) {
          const newReq = await tx.requirement.create({
            data: {
              customerAccountId,
              frameworkId: newFramework.id,
              categoryId: req.categoryId ? categoryMap.get(req.categoryId) || null : null,
              parentId: req.parentId ? requirementMap.get(req.parentId) || null : null,
              code: req.code,
              name: req.name,
              description: req.description,
              sortOrder: req.sortOrder,
            },
          });
          requirementMap.set(req.id, newReq.id);
        }

        // 4. Clone controls and create RequirementControl links
        const controlMap = new Map<string, string>();
        for (const req of sourceFramework.requirements) {
          for (const rc of req.controls) {
            const srcCtrl = rc.control;
            if (!controlMap.has(srcCtrl.id)) {
              // Check if customer already has a control with the same code
              const existingCtrl = srcCtrl.controlCode
                ? await tx.control.findFirst({
                    where: { customerAccountId, controlCode: srcCtrl.controlCode },
                  })
                : null;

              if (existingCtrl) {
                controlMap.set(srcCtrl.id, existingCtrl.id);
              } else {
                const newCtrl = await tx.control.create({
                  data: {
                    customerAccountId,
                    frameworkId: newFramework.id,
                    controlCode: srcCtrl.controlCode,
                    name: srcCtrl.name,
                    description: srcCtrl.description,
                    status: srcCtrl.status,
                    domainId: null,
                  },
                });
                controlMap.set(srcCtrl.id, newCtrl.id);
              }
            }

            // Create RequirementControl link
            const newReqId = requirementMap.get(req.id);
            const newCtrlId = controlMap.get(srcCtrl.id);
            if (newReqId && newCtrlId) {
              await tx.requirementControl.create({
                data: {
                  requirementId: newReqId,
                  controlId: newCtrlId,
                },
              }).catch(() => {
                // Ignore duplicate link errors
              });
            }
          }
        }

        return newFramework;
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      console.error("Error subscribing framework:", error);
      return NextResponse.json(
        { error: "Failed to subscribe framework" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.regulatory-intelligence", action: "create" }
);
