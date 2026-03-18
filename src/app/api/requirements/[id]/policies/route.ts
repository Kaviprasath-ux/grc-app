import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET policies linked to a requirement (for gap assessment)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const requirement = await prisma.requirement.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!requirement) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, requirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      const links = await prisma.requirementPolicy.findMany({
        where: { requirementId: id },
        include: {
          policy: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              documentType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(links.map((l) => l.policy));
    } catch (error) {
      console.error("Error fetching requirement policies:", error);
      return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
    }
  },
  { resource: "compliance.framework", action: "view" }
);

// POST - link policies to a requirement
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const { policyIds } = await req.json();

      if (!Array.isArray(policyIds) || policyIds.length === 0) {
        return NextResponse.json({ error: "policyIds array required" }, { status: 400 });
      }

      const requirement = await prisma.requirement.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!requirement) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, requirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      // Create links, skip duplicates
      const results = await Promise.allSettled(
        policyIds.map((policyId: string) =>
          prisma.requirementPolicy.create({
            data: { requirementId: id, policyId },
          })
        )
      );

      const created = results.filter((r) => r.status === "fulfilled").length;

      return NextResponse.json({ message: `${created} policies linked`, created }, { status: 201 });
    } catch (error) {
      console.error("Error linking policies:", error);
      return NextResponse.json({ error: "Failed to link policies" }, { status: 500 });
    }
  },
  { resource: "compliance.framework", action: "edit" }
);

// DELETE - unlink a policy from a requirement
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const { searchParams } = new URL(req.url);
      const policyId = searchParams.get("policyId");

      if (!policyId) {
        return NextResponse.json({ error: "policyId required" }, { status: 400 });
      }

      const requirement = await prisma.requirement.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!requirement) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, requirement.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.requirementPolicy.deleteMany({
        where: { requirementId: id, policyId },
      });

      return NextResponse.json({ message: "Policy unlinked" });
    } catch (error) {
      console.error("Error unlinking policy:", error);
      return NextResponse.json({ error: "Failed to unlink policy" }, { status: 500 });
    }
  },
  { resource: "compliance.framework", action: "edit" }
);
