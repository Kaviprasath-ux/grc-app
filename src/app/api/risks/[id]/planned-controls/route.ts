import { NextRequest, NextResponse } from "next/server";

// In-memory storage for planned controls (in production, use a database)
const plannedControlsStore: Map<string, PlannedControl[]> = new Map();

interface PlannedControl {
  id: string;
  controlId: string;
  name: string;
  description: string;
  domain?: string;
  functionalGrouping?: string;
  department?: string;
  assignedTo?: string;
  createdAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riskId } = await params;
    const controls = plannedControlsStore.get(riskId) || [];

    return NextResponse.json({
      success: true,
      data: controls,
    });
  } catch (error) {
    console.error("Error fetching planned controls:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch planned controls" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riskId } = await params;
    const body = await request.json();

    const newControl: PlannedControl = {
      id: crypto.randomUUID(),
      controlId: body.controlId || `CTRL-${Date.now().toString(36).toUpperCase()}`,
      name: body.name,
      description: body.description || "",
      domain: body.domain,
      functionalGrouping: body.functionalGrouping,
      department: body.department,
      assignedTo: body.assignedTo,
      createdAt: new Date().toISOString(),
    };

    const existingControls = plannedControlsStore.get(riskId) || [];
    existingControls.push(newControl);
    plannedControlsStore.set(riskId, existingControls);

    return NextResponse.json({
      success: true,
      data: newControl,
    });
  } catch (error) {
    console.error("Error adding planned control:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add planned control" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: riskId } = await params;
    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("controlId");

    if (!controlId) {
      return NextResponse.json(
        { success: false, error: "Control ID is required" },
        { status: 400 }
      );
    }

    const existingControls = plannedControlsStore.get(riskId) || [];
    const updatedControls = existingControls.filter(c => c.id !== controlId);
    plannedControlsStore.set(riskId, updatedControls);

    return NextResponse.json({
      success: true,
      message: "Control removed successfully",
    });
  } catch (error) {
    console.error("Error removing planned control:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove planned control" },
      { status: 500 }
    );
  }
}
