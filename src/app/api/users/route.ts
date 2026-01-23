import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all users (with optional role, department, and auditHeadId filters)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const departmentId = searchParams.get("departmentId");
    const auditHeadId = searchParams.get("auditHeadId");
    const forAuditHead = searchParams.get("forAuditHead"); // 'auditees' or 'auditors'

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

    // Filter by auditHeadId - get users managed by this audit head
    if (auditHeadId) {
      where.auditHeadId = auditHeadId;
    }

    // Special filter for Audit Head: get auditees or auditors associated with them
    if (forAuditHead && session?.user?.id) {
      const currentUserId = session.user.id;
      const currentUserRoles = session.user.roles || [];
      const isAuditHead = currentUserRoles.includes("AuditHead");

      if (isAuditHead) {
        if (forAuditHead === "auditees") {
          // Get all auditees in the same customer account
          where.userRoles = {
            some: {
              role: {
                name: "Auditee",
              },
            },
          };
        } else if (forAuditHead === "auditors") {
          // Get audit team members (AuditHead, AuditManager, Auditor) in the same customer account
          // This allows Audit Head to assign themselves or any audit team member
          where.userRoles = {
            some: {
              role: {
                name: { in: ["AuditHead", "AuditManager", "Auditor"] },
              },
            },
          };
        }
      }
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
        reportingManager: {
          select: {
            id: true,
            fullName: true,
            designation: true,
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
      reportingManagerId,
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
        departmentId,
        reportingManagerId: reportingManagerId || null,
        customerAccountId, // Multi-tenant: Link user to same customer account as creator
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
        reportingManager: {
          select: {
            id: true,
            fullName: true,
            designation: true,
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
