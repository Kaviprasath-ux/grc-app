import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update service
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, serviceUser, serviceCategory, serviceItem } = body;

    const service = await prisma.service.update({
      where: { id },
      data: {
        title,
        description,
        serviceUser,
        serviceCategory,
        serviceItem,
      },
    });

    return NextResponse.json(service);
  } catch (error: unknown) {
    console.error("Error updating service:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ message: "Service deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting service:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
