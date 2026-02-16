import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { isValidEmailFormat } from "@/lib/validations/email";

// Audit-related roles that can be assigned
const AUDIT_ROLES = ["AuditHead", "AuditManager", "Auditor", "Auditee"];

/**
 * Build filter for audit head isolation
 * - AuditHead can only access users they manage (auditHeadId = session.id) or themselves
 * - Admins can access all users within their tenant
 */
function getAuditUserFilter(session: { id: string; roles: string[] }): Record<string, unknown> | undefined {
  const isAuditHead = session.roles.includes('AuditHead');
  const isAdmin = session.roles.includes('GRCAdministrator') || session.roles.includes('CustomerAdministrator');

  if (isAuditHead && !isAdmin) {
    // AuditHead can only access their managed users or themselves
    return {
      OR: [
        { auditHeadId: session.id },
        { id: session.id },
      ],
    };
  }

  // Admins see all users within tenant (handled by tenantFilter)
  return undefined;
}

// GET single audit user
// Requires 'edit' action so only AuditHead can access (CustomerAdmin has only 'view')
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditUserFilter = getAuditUserFilter(session);

      const whereClause: Record<string, unknown> = { id, ...tenantFilter };
      if (auditUserFilter) {
        whereClause.AND = [auditUserFilter];
      }

      // Note: User model doesn't have auditHead relation - removed
      const user = await prisma.user.findFirst({
        where: whereClause,
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
// AuditHead can only update users they manage
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditUserFilter = getAuditUserFilter(session);
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
        auditHeadId: requestedAuditHeadId, // For admin to reassign users
      } = body;

      // Build where clause with audit isolation
      const whereClause: Record<string, unknown> = { id, ...tenantFilter };
      if (auditUserFilter) {
        whereClause.AND = [auditUserFilter];
      }

      // Verify user exists and user has access
      const existingUser = await prisma.user.findFirst({
        where: whereClause,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Validate email format if provided
      if (email && !isValidEmailFormat(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Check email uniqueness if email is being changed
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists) {
          return NextResponse.json({ error: "Email already exists" }, { status: 409 });
        }
      }

      // Parse roles (comma-separated string)
      const roleNames: string[] = role ? role.split(",").map((r: string) => r.trim()).filter(Boolean) : [];

      // Determine auditHeadId update
      // Rules:
      // - If changing TO AuditHead role, clear auditHeadId
      // - If AuditHead is updating, keep their own ID as auditHeadId
      // - Admin can explicitly set auditHeadId
      let auditHeadIdToSet: string | null | undefined = undefined; // undefined = don't change
      const isCreatingAuditHead = roleNames.includes('AuditHead');
      const wasAuditHead = existingUser.userRoles.some(ur => ur.role.name === 'AuditHead');
      const isAuditHead = session.roles.includes('AuditHead');
      const isAdmin = session.roles.includes('GRCAdministrator') || session.roles.includes('CustomerAdministrator');

      if (isCreatingAuditHead && !wasAuditHead) {
        // Promoting to AuditHead - clear auditHeadId
        auditHeadIdToSet = null;
      } else if (!isCreatingAuditHead && wasAuditHead) {
        // Demoting from AuditHead - need to set auditHeadId
        if (isAdmin && requestedAuditHeadId) {
          auditHeadIdToSet = requestedAuditHeadId;
        } else if (isAuditHead && !isAdmin) {
          auditHeadIdToSet = session.id;
        }
      } else if (isAdmin && requestedAuditHeadId !== undefined) {
        // Admin explicitly setting auditHeadId
        auditHeadIdToSet = requestedAuditHeadId;
      }

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

      // Build update data
      const updateData: Record<string, unknown> = {
        userName,
        email,
        firstName,
        lastName,
        fullName: fullName || (firstName && lastName ? `${firstName} ${lastName}` : undefined),
        designation: designation || null,
        function: "Audit",
        role: role || "User",
        departmentId: departmentId || null,
      };

      if (auditHeadIdToSet !== undefined) {
        updateData.auditHeadId = auditHeadIdToSet;
      }

      // Note: User model doesn't have auditHead relation - removed
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
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
// AuditHead can only delete users they manage
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);
      const auditUserFilter = getAuditUserFilter(session);

      // Build where clause with audit isolation
      const whereClause: Record<string, unknown> = { id, ...tenantFilter };
      if (auditUserFilter) {
        whereClause.AND = [auditUserFilter];
      }

      // Verify user exists and user has access
      const existingUser = await prisma.user.findFirst({
        where: whereClause,
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Prevent deleting yourself
      if (id === session.id) {
        return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
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
