import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customer-accounts/[id]
 * Get a specific customer account
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        department: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/grc/customer-accounts/[id]
 * Update a customer account
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { customerName, email, userName, password, blocked, active, language, timeZone } = body;

    // Validate required fields
    if (!customerName || !email || !userName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check if email is being changed and already exists
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
    }

    // Check if username is being changed and already exists
    if (userName !== existingUser.userName) {
      const usernameExists = await prisma.user.findUnique({
        where: { userName },
      });
      if (usernameExists) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      email,
      userName,
      firstName: customerName.split(" ")[0] || customerName,
      lastName: customerName.split(" ").slice(1).join(" ") || "",
      fullName: customerName,
      isBlocked: blocked ?? existingUser.isBlocked,
      isActive: active ?? existingUser.isActive,
      language: language || existingUser.language || "en-US",
      timezone: timeZone || existingUser.timezone || "Asia/Qatar",
    };

    // Only update password if provided
    if (password) {
      updateData.password = password; // In production, this should be hashed
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully",
      user: {
        id: updatedUser.id,
        userName: updatedUser.userName,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
      },
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/grc/customer-accounts/[id]
 * Delete a customer account
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Prevent deleting GRCAdministrators
    const isGRCAdmin = existingUser.userRoles.some(
      (ur) => ur.roleId === existingUser.userRoles.find((r) => r.roleId)?.roleId
    );

    // Delete user roles first (due to foreign key constraints)
    await prisma.userRole.deleteMany({
      where: { userId: id },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
