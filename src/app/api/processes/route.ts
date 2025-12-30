import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all processes
export async function GET() {
  try {
    const processes = await prisma.process.findMany({
      include: {
        department: true,
        owner: true,
      },
      orderBy: { processCode: "asc" },
    });
    return NextResponse.json(processes);
  } catch (error) {
    console.error("Error fetching processes:", error);
    return NextResponse.json(
      { error: "Failed to fetch processes" },
      { status: 500 }
    );
  }
}

// POST create new process
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, name, description, processType, departmentId, ownerId, status } = body;

    if (!processCode || !name) {
      return NextResponse.json(
        { error: "Process code and name are required" },
        { status: 400 }
      );
    }

    // Check if process code already exists
    const existingProcess = await prisma.process.findUnique({
      where: { processCode },
    });

    if (existingProcess) {
      return NextResponse.json(
        { error: "Process code already exists" },
        { status: 400 }
      );
    }

    const process = await prisma.process.create({
      data: {
        processCode,
        name,
        description,
        processType: processType || "Primary",
        departmentId,
        ownerId,
        status: status || "Active",
      },
      include: {
        department: true,
        owner: true,
      },
    });

    return NextResponse.json(process, { status: 201 });
  } catch (error) {
    console.error("Error creating process:", error);
    return NextResponse.json(
      { error: "Failed to create process" },
      { status: 500 }
    );
  }
}
