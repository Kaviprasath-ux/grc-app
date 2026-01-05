import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all periodicities
export async function GET() {
  try {
    const periodicities = await prisma.auditPeriodicity.findMany({
      orderBy: { months: "asc" },
    });

    return NextResponse.json(periodicities);
  } catch (error) {
    console.error("Error fetching periodicities:", error);
    return NextResponse.json(
      { error: "Failed to fetch periodicities" },
      { status: 500 }
    );
  }
}

// POST create a new periodicity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interval, months } = body;

    if (!interval) {
      return NextResponse.json(
        { error: "Interval is required" },
        { status: 400 }
      );
    }

    // Check for duplicate interval
    const existing = await prisma.auditPeriodicity.findUnique({
      where: { interval },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Periodicity with this interval already exists" },
        { status: 400 }
      );
    }

    const periodicity = await prisma.auditPeriodicity.create({
      data: { interval, months: months || 1 },
    });

    return NextResponse.json(periodicity, { status: 201 });
  } catch (error) {
    console.error("Error creating periodicity:", error);
    return NextResponse.json(
      { error: "Failed to create periodicity" },
      { status: 500 }
    );
  }
}
