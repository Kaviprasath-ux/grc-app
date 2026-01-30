import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all users (with optional role and department filters)
// Note: User model doesn't have auditHeadId or reportingManagerId fields - those filters removed
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const departmentId = searchParams.get("departmentId");

    // Build where clause for role filtering and multi-tenant isolation
    const where: any = {};
    if (role) {
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    // Filter by department if provided
    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Multi-tenant: Filter users by customerAccountId if user is not GRCAdministrator
    const userRoles = session?.user?.roles || [];
    if (!userRoles.includes("GRCAdministrator") && session?.user?.customerAccountId) {
      where.customerAccountId = session.user.customerAccountId;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        department: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
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
// Note: User model doesn't have reportingManagerId field - removed
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
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

    // Find or create the role in the Role table (for UserRole junction)
    let roleRecord = null;
    if (role) {
      roleRecord = await prisma.role.findFirst({
        where: { name: role }
      });

      // If role doesn't exist, create it (this handles cases where seeding wasn't run)
      if (!roleRecord) {
        roleRecord = await prisma.role.create({
          data: {
            name: role,
            description: `${role} role`,
            isSystem: false,
          },
        });
      }
    }

    // Multi-tenant: Get customerAccountId from session (users created by CustomerAdmin belong to same account)
    const customerAccountId = session?.user?.customerAccountId || null;

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
        // Use relation connect syntax for foreign keys
        ...(departmentId && {
          department: { connect: { id: departmentId } },
        }),
        ...(customerAccountId && {
          customerAccount: { connect: { id: customerAccountId } },
        }),
        // Create UserRole entry if role exists in Role table
        ...(roleRecord && {
          userRoles: {
            create: {
              roleId: roleRecord.id,
            },
          },
        }),
      },
      include: {
        department: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
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
