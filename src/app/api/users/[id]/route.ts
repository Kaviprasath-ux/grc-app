import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      userName,
      email,
      firstName,
      lastName,
      designation,
      function: userFunction,
      role,
      language,
      timezone,
      isActive,
      isBlocked,
      departmentId,
    } = body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        userName,
        email,
        firstName,
        lastName,
        fullName: firstName && lastName ? `${firstName} ${lastName}` : undefined,
        designation,
        function: userFunction,
        role,
        language,
        timezone,
        isActive,
        isBlocked,
        departmentId,
      },
      include: { department: true },
    });

    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
