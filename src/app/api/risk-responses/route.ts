import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// Helper function to generate response ID
async function generateResponseId(): Promise<string> {
  const count = await prisma.riskResponse.count();
  return `RR-${String(count + 1).padStart(4, "0")}`;
}

// GET all risk responses - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const riskId = searchParams.get("riskId");
      const status = searchParams.get("status");
      const responseType = searchParams.get("responseType");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };
      if (riskId) where.riskId = riskId;
      if (status) where.status = status;
      if (responseType) where.responseType = responseType;

      const [responses, total] = await Promise.all([
        prisma.riskResponse.findMany({
          where,
          include: {
            risk: {
              select: {
                id: true,
                riskId: true,
                name: true,
                riskRating: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.riskResponse.count({ where }),
      ]);

      return NextResponse.json({
        data: responses,
        pagination: {
          total,
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + responses.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching risk responses:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk responses" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "view" }
);

// POST create a new risk response - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        riskId,
        responseType = "Mitigate",
        actionTitle,
        actionDescription,
        assignee,
        dueDate,
        status = "Open",
        notes,
      } = body;

      if (!riskId) {
        return NextResponse.json(
          { error: "Risk ID is required" },
          { status: 400 }
        );
      }

      if (!actionTitle) {
        return NextResponse.json(
          { error: "Action title is required" },
          { status: 400 }
        );
      }

      // Check if risk exists
      const risk = await prisma.risk.findUnique({ where: { id: riskId } });
      if (!risk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const responseId = await generateResponseId();

      const response = await prisma.riskResponse.create({
        data: {
          customerAccountId,
          responseId,
          riskId,
          responseType,
          actionTitle,
          actionDescription,
          assignee,
          dueDate: dueDate ? new Date(dueDate) : null,
          status,
          notes,
        },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
            },
          },
        },
      });

      // Update the risk's response strategy if not already set
      if (!risk.responseStrategy) {
        await prisma.risk.update({
          where: { id: riskId },
          data: { responseStrategy: responseType },
        });
      }

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error("Error creating risk response:", error);
      return NextResponse.json(
        { error: "Failed to create risk response" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "create" }
);
