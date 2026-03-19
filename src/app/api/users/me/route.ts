import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET current user profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        department: { select: { id: true, name: true } },
        customerAccount: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT update own profile (name, email) + optional password change
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, email, currentPassword, newPassword } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (fullName && fullName.trim()) {
      updateData.fullName = fullName.trim();
      const parts = fullName.trim().split(" ");
      updateData.firstName = parts[0] || "";
      updateData.lastName = parts.slice(1).join(" ") || "";
    }

    if (email && email.trim()) {
      // Check email uniqueness
      const existing = await prisma.user.findFirst({
        where: { email: email.trim(), id: { not: session.user.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updateData.email = email.trim();
    }

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      });
      if (user?.password) {
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        department: { select: { id: true, name: true } },
        customerAccount: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
