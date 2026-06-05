import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId, getTenantFilter } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all QPost frameworks
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

        const frameworks = await prisma.qPostFramework.findMany({
          where,
          orderBy: { name: "asc" },
        });

        return NextResponse.json(frameworks);
      }

      // For Customer Admin and other roles:
      // 1. Fetch their own frameworks (subscribed)
      // 2. Fetch master frameworks from GRC Admin accounts (for "Not Subscribed" filter)

      // Special handling for DepartmentReviewer and DepartmentContributor:
      // They should see the same frameworks as their creator
      const isDepartmentRole = session.roles?.some((role: string) =>
        ['DepartmentContributor', 'DepartmentReviewer'].includes(role)
      );

      let customerAccountId = session.customerAccountId;

      // For DR/DC users, check if they have a creator and use the creator's customer account
      if (isDepartmentRole && session.id) {
        const currentUser = await prisma.user.findUnique({
          where: { id: session.id },
          select: {
            createdById: true,
            createdBy: {
              select: {
                customerAccountId: true,
              },
            },
          },
        });

        // If the user was created by someone, use the creator's customer account
        if (currentUser?.createdBy?.customerAccountId) {
          customerAccountId = currentUser.createdBy.customerAccountId;
        }
      }

      if (!customerAccountId) {
        return NextResponse.json([]);
      }

      // Get customer's own frameworks
      const customerFrameworks = await prisma.qPostFramework.findMany({
        where: {
          customerAccountId,
          ...(type ? { type } : {}),
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
      const masterFrameworks = await prisma.qPostFramework.findMany({
        where: {
          customerAccountId: { in: grcAdminAccountIds },
          ...(type ? { type } : {}),
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

      // Combine: customer frameworks + master frameworks (marked as "Not Subscribed")
      let allFrameworks = [...customerFrameworks];

      if (masterFrameworks.length > 0) {
        for (const master of masterFrameworks) {
          // Check if customer already has this framework (by name or code)
          const isSubscribed =
            subscribedNames.has(master.name.toLowerCase()) ||
            (master.code && subscribedCodes.has(master.code.toLowerCase()));

          if (!isSubscribed) {
            // Add master framework as "Not Subscribed" for customer view
            allFrameworks.push({
              ...master,
              status: "Not Subscribed",
            });
          }
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
      console.error("Error fetching QPost frameworks:", error);
      return NextResponse.json(
        { error: "Failed to fetch frameworks" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.framework", action: "view" }
);

// POST create new QPost framework
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

      // Get customerAccountId from session, with fallback DB lookup
      let customerAccountId = session.customerAccountId;

      if (!customerAccountId && session.id) {
        const currentUser = await prisma.user.findUnique({
          where: { id: session.id },
          select: { customerAccountId: true, customerCode: true },
        });

        customerAccountId = currentUser?.customerAccountId || null;

        if (!customerAccountId && currentUser?.customerCode) {
          const account = await prisma.customerAccount.findUnique({
            where: { code: currentUser.customerCode },
            select: { id: true },
          });
          customerAccountId = account?.id || null;
        }
      }

      if (!customerAccountId) {
        console.error("User does not have a customer account assigned:", session.id, session.roles);
        return NextResponse.json(
          { error: "User does not have a customer account assigned. Please contact an administrator." },
          { status: 400 }
        );
      }

      // Check if user is GRC Administrator - they bypass subscription checks
      const isGRCAdmin = session.roles?.includes("GRCAdministrator");

      // Check subscription plan limits before creating framework (skip for GRC Admins)
      let activePlan = null;
      if (!isGRCAdmin) {
        // V2: ModuleSubscription with unlimited frameworks (null or >= 999_999) bypasses V1 check
        const v2Module = await prisma.moduleSubscription.findFirst({
          where: { subscription: { customerAccountId }, moduleCode: "GRC" },
          select: { frameworkLimit: true },
        });
        const hasUnlimitedFrameworks =
          v2Module !== null &&
          (v2Module.frameworkLimit === null || v2Module.frameworkLimit >= 999_999);

        if (!hasUnlimitedFrameworks) {
          const now = new Date();
          activePlan = await prisma.subscriptionPlan.findFirst({
            where: {
              customerAccountId,
              status: "Active",
              expiryDate: { gte: now },
            },
          });

          if (!activePlan) {
            // Auto-create a subscription plan if none exists
            console.log(`[QPost Frameworks API] No active subscription plan found for customerAccountId: ${customerAccountId}. Auto-creating one.`);
            activePlan = await prisma.subscriptionPlan.create({
              data: {
                customerAccountId,
                startDate: new Date(),
                expiryDate: new Date("2030-12-31"),
                maxFrameworksAllowed: 100,
                maxAccountsAllowed: 50,
                assessmentLimit: 100,
                vendorLimit: 100,
                frameworksUsed: 0,
                accountsUsed: 0,
                status: "Active",
              },
            });
            console.log(`[QPost Frameworks API] Auto-created subscription plan: ${activePlan.id}`);
          }

          if (activePlan.frameworksUsed >= activePlan.maxFrameworksAllowed) {
            return NextResponse.json(
              { error: `Maximum frameworks limit reached. Your plan allows ${activePlan.maxFrameworksAllowed} frameworks.` },
              { status: 403 }
            );
          }
        }
      }

      const framework = await prisma.qPostFramework.create({
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

      // Fire-and-forget translation
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'QPostFramework', framework.id, {
          name: framework.name,
          description: framework.description,
          country: framework.country,
          industry: framework.industry,
        });
      }

      // Increment frameworksUsed in the active subscription plan
      if (status === "Subscribed" && activePlan) {
        await prisma.subscriptionPlan.update({
          where: { id: activePlan.id },
          data: { frameworksUsed: { increment: 1 } },
        });
      }

      return NextResponse.json(framework, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating QPost framework:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Framework with this name already exists" },
          { status: 409 }
        );
      }
      // Return more detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.framework", action: "create" }
);
