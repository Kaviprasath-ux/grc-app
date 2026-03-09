import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST link exception to policy
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { exceptionId } = body;

    if (!exceptionId) {
      return NextResponse.json(
        { error: "Exception ID is required" },
        { status: 400 }
      );
    }

    // Check if policy exists
    const policy = await prisma.qPostPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    // Check if exception exists
    const exception = await prisma.qPostException.findUnique({
      where: { id: exceptionId },
    });

    if (!exception) {
      return NextResponse.json(
        { error: "Exception not found" },
        { status: 404 }
      );
    }

    // Check if already linked
    const existingLink = await prisma.qPostPolicyException.findFirst({
      where: {
        policyId: id,
        exceptionId,
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "Exception is already linked to this policy" },
        { status: 409 }
      );
    }

    // Create the link
    const policyException = await prisma.qPostPolicyException.create({
      data: {
        policyId: id,
        exceptionId,
      },
      include: {
        exception: true,
      },
    });

    return NextResponse.json(policyException, { status: 201 });
  } catch (error) {
    console.error("Error linking exception to policy:", error);
    return NextResponse.json(
      { error: "Failed to link exception" },
      { status: 500 }
    );
  }
}

// GET all exceptions linked to policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const policyExceptions = await prisma.qPostPolicyException.findMany({
      where: { policyId: id },
      include: {
        exception: true,
      },
    });

    return NextResponse.json(policyExceptions);
  } catch (error) {
    console.error("Error fetching policy exceptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy exceptions" },
      { status: 500 }
    );
  }
}
