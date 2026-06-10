import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

async function handler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
  session: AuthenticatedRequest["user"]
) {
  const { id: frameworkId } = await context.params;
  const customerAccountId = session.customerAccountId;

  if (!customerAccountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify framework belongs to this tenant
  const framework = await prisma.framework.findFirst({
    where: { id: frameworkId, customerAccountId },
    select: { id: true, name: true, status: true },
  });

  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  // Single query: traverse Framework → Requirements → RequirementControls → Controls → PolicyControls → Policies
  const policies = await prisma.policy.findMany({
    where: {
      customerAccountId,
      policyControls: {
        some: {
          control: {
            requirements: {
              some: {
                requirement: { frameworkId },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      version: true,
      documentType: true,
      status: true,
      effectiveDate: true,
      reviewDate: true,
      department: { select: { id: true, name: true } },
      assignee: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ policies, framework });
}

export const GET = withAuthOnly(handler);
