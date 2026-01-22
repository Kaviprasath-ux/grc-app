import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// Audit-related roles that can be assigned
const AUDIT_ROLES = ["AuditHead", "AuditManager", "Auditor", "Auditee"];

// GET single audit user
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const user = await prisma.user.findFirst({
        where: { id, ...tenantFilter },
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

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Remove password from response
      const { password, ...safeUser } = user;
      return NextResponse.json({
        ...safeUser,
        role: user.userRoles.map((ur) => ur.role.name).join(", "),
      });
    } catch (error) {
      console.error("Error fetching audit user:", error);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update audit user
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();

      const {
        userName,
        email,
        firstName,
        lastName,
        fullName,
        designation,
        role,
        departmentId,
      } = body;

      // Verify user exists and belongs to tenant
      const existingUser = await prisma.user.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

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

      // Delete existing user roles and create new ones
      await prisma.userRole.deleteMany({
        where: { userId: id },
      });

      if (roleRecords.length > 0) {
        await prisma.userRole.createMany({
          data: roleRecords.map((r) => ({
            userId: id,
            roleId: r.id,
          })),
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          userName,
          email,
          firstName,
          lastName,
          fullName: fullName || (firstName && lastName ? `${firstName} ${lastName}` : undefined),
          designation: designation || null,
          function: "Audit",
          role: role || "User",
          departmentId: departmentId || null,
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

      const { password: _, ...safeUser } = user;
      return NextResponse.json({
        ...safeUser,
        role: user.userRoles.map((ur) => ur.role.name).join(", "),
      });
    } catch (error: unknown) {
      console.error("Error updating audit user:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// DELETE audit user
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify user exists and belongs to tenant
      const existingUser = await prisma.user.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Delete user roles first
      await prisma.userRole.deleteMany({
        where: { userId: id },
      });

      await prisma.user.delete({ where: { id } });

      return NextResponse.json({ message: "User deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting audit user:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "delete" }
);
