import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId, getTenantFilter } from "@/lib/api-auth";

// GET all frameworks
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const type = searchParams.get("type");

      const isGRCAdmin = session.roles.includes("GRCAdministrator");

      // For GRC Administrator: return only their own frameworks
      if (isGRCAdmin) {
        const tenantFilter = getTenantFilter(session);
        const where: Record<string, unknown> = { ...tenantFilter };
        if (status) where.status = status;
        if (type) where.type = type;

        const frameworks = await prisma.framework.findMany({
          where,
          include: {
            _count: {
              select: { controls: true, evidences: true, requirements: true },
            },
          },
          orderBy: { name: "asc" },
        });
        return NextResponse.json(frameworks);
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
      const allFrameworks = [...customerFrameworks];

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

      const customerAccountId = getCustomerAccountId(session);

      const framework = await prisma.framework.create({
        data: {
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
      return NextResponse.json(
        { error: "Failed to create framework" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "create" }
);
