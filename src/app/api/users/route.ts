import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all users
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: { department: true },
      orderBy: { fullName: "asc" },
    });
    // Remove password from response
    const safeUsers = users.map(({ password, ...user }) => user);
    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userName,
      email,
      password,
      firstName,
      lastName,
      fullName,
      designation,
      function: userFunction,
      role,
      language,
      timezone,
      isActive,
      isBlocked,
      departmentId,
    } = body;

    if (!userId || !userName || !email || !password || !firstName || !lastName || !fullName) {
      return NextResponse.json(
        { error: "userId, userName, email, password, firstName, lastName, and fullName are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        userId,
        userName,
        email,
        password, // In production, hash this password!
        firstName,
        lastName,
        fullName,
        designation,
        function: userFunction,
        role: role || "User",
        language: language || "English",
        timezone: timezone || "UTC",
        isActive: isActive ?? true,
        isBlocked: isBlocked ?? false,
        departmentId,
      },
      include: { department: true },
    });

    // Remove password from response
    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "User with this username or email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
