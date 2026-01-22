import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// Audit-related roles that can be assigned by AuditHead in Internal Audit user management
// AuditHead can only manage AuditManager and Auditee roles
const AUDIT_ROLES = ["AuditManager", "Auditee"];

// GET all audit users - filtered by tenant and audit roles
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Get users that have AuditManager or Auditee roles only
      const users = await prisma.user.findMany({
        where: {
          ...tenantFilter,
          // Only show users with AuditManager or Auditee roles
          userRoles: {
            some: {
              role: {
                name: { in: AUDIT_ROLES },
              },
            },
          },
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { fullName: "asc" },
      });

      // Transform to remove password and format response
      const safeUsers = users.map(({ password, ...user }) => ({
        ...user,
        role: user.userRoles.map((ur) => ur.role.name).join(", "),
      }));

      return NextResponse.json(safeUsers);
    } catch (error) {
      console.error("Error fetching audit users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create new audit user
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const {
        userId,
        userName,
        email,
        password,
        firstName,
        lastName,
        fullName,
        designation,
        role,
        departmentId,
      } = body;

      if (!userId || !userName || !email || !password || !firstName || !lastName || !fullName) {
        return NextResponse.json(
          { error: "userId, userName, email, password, firstName, lastName, and fullName are required" },
          { status: 400 }
        );
      }

      // Get customer account ID for multi-tenant isolation
      const customerAccountId = getCustomerAccountId(session);

      // Parse roles (comma-separated string)
      const roleNames = role ? role.split(",").map((r: string) => r.trim()).filter(Boolean) : [];

      // Find or create roles in the Role table
      const roleRecords = [];
      for (const roleName of roleNames) {
        if (AUDIT_ROLES.includes(roleName)) {
          let roleRecord = await prisma.role.findFirst({
            where: { name: roleName },
          });

          if (!roleRecord) {
            roleRecord = await prisma.role.create({
              data: {
                name: roleName,
                description: `${roleName} role`,
                isSystem: false,
              },
            });
          }
          roleRecords.push(roleRecord);
        }
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
          designation: designation || null,
          function: "Audit",
          role: role || "User",
          language: "English",
          timezone: "UTC",
          isActive: true,
          isBlocked: false,
          departmentId: departmentId || null,
          customerAccountId,
          // Create UserRole entries for each role
          userRoles: {
            create: roleRecords.map((r) => ({
              roleId: r.id,
            })),
          },
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      // Remove password from response
      const { password: _, ...safeUser } = user;
      return NextResponse.json(
        { ...safeUser, role: roleRecords.map((r) => r.name).join(", ") },
        { status: 201 }
      );
    } catch (error: unknown) {
      console.error("Error creating audit user:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "User with this username or email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
