import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST link control to policy
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { controlId } = body;

    if (!controlId) {
      return NextResponse.json(
        { error: "Control ID is required" },
        { status: 400 }
      );
    }

    // Check if policy exists
    const policy = await prisma.policy.findUnique({
      where: { id },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    // Check if control exists
    const control = await prisma.control.findUnique({
      where: { id: controlId },
    });

    if (!control) {
      return NextResponse.json(
        { error: "Control not found" },
        { status: 404 }
      );
    }

    // Check if already linked
    const existingLink = await prisma.policyControl.findFirst({
      where: {
        policyId: id,
        controlId,
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "Control is already linked to this policy" },
        { status: 409 }
      );
    }

    // Create the link
    const policyControl = await prisma.policyControl.create({
      data: {
        policyId: id,
        controlId,
      },
      include: {
        control: {
          include: {
            domain: true,
          },
        },
      },
    });

    return NextResponse.json(policyControl, { status: 201 });
  } catch (error) {
    console.error("Error linking control to policy:", error);
    return NextResponse.json(
      { error: "Failed to link control" },
      { status: 500 }
    );
  }
}

// GET all controls linked to policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const policyControls = await prisma.policyControl.findMany({
      where: { policyId: id },
      include: {
        control: {
          include: {
            domain: true,
          },
        },
      },
    });

    return NextResponse.json(policyControls);
  } catch (error) {
    console.error("Error fetching policy controls:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy controls" },
      { status: 500 }
    );
  }
}
