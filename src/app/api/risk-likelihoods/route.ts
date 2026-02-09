import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all risk likelihoods - with tenant filtering
// GRC Admins get global access to view all settings across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const likelihoods = await prisma.riskLikelihood.findMany({
        where: tenantFilter,
        orderBy: { score: "asc" },
      });
      return NextResponse.json(likelihoods);
    } catch (error) {
      console.error("Error fetching risk likelihoods:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk likelihoods" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create risk likelihood - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { title, score, timeFrame, probability } = body;

      if (!title?.trim()) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.riskLikelihood.findFirst({
        where: {
          customerAccountId,
          title: title.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Likelihood with this title already exists" },
          { status: 409 }
        );
      }

      const likelihood = await prisma.riskLikelihood.create({
        data: {
          customerAccountId,
          title: title.trim(),
          score: parseInt(score) || 0,
          timeFrame: timeFrame?.trim() || null,
          probability: probability?.trim() || null,
        },
      });

      return NextResponse.json(likelihood, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating risk likelihood:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Likelihood with this title already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create risk likelihood" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
