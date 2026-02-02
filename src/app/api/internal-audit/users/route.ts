import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId } from "@/lib/api-auth";

// Audit-related roles that can be assigned in Internal Audit user management
// Auditor role is removed - only AuditHead, AuditManager, and Auditee are available
const AUDIT_ROLES = ["AuditHead", "AuditManager", "Auditee"];

// GET all audit users - filtered by tenant and audit head
// AuditHead can only see their own managed users (AuditManager/Auditee)
// CustomerAdmin/GRCAdmin can see all audit users
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Build the where clause
      const whereClause: Record<string, unknown> = {
        ...tenantFilter,
        // Only show users with audit roles
        userRoles: {
          some: {
            role: {
              name: { in: AUDIT_ROLES },
            },
          },
        },
      };

      // For AuditHead, only show users they manage (users with their ID as auditHeadId)
      // CustomerAdmin/GRCAdmin can see all audit users within their tenant
      const isAuditHead = session.roles.includes('AuditHead');
      const isAdmin = session.roles.includes('GRCAdministrator') || session.roles.includes('CustomerAdministrator');

      if (isAuditHead && !isAdmin) {
        // AuditHead sees only their managed users + themselves
        whereClause.OR = [
          { auditHeadId: session.id },  // Users managed by this AuditHead
          { id: session.id },            // Include themselves
        ];
      }

      // Note: User model doesn't have auditHead relation - removed
      const users = await prisma.user.findMany({
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
  { resource: "audit.settings", action: "view" }
);

// POST create new audit user
// AuditHead creates users under their management (sets auditHeadId to their ID)
// CustomerAdmin can create AuditHead users (no auditHeadId) or assign to existing AuditHead
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
        auditHeadId: requestedAuditHeadId, // Explicitly set by CustomerAdmin (optional)
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
      const roleNames: string[] = role ? role.split(",").map((r: string) => r.trim()).filter(Boolean) : [];

      // Determine the auditHeadId for this new user
      // Rules:
      // 1. If creating an AuditHead, no auditHeadId is set (they are their own head)
      // 2. If AuditHead is creating AuditManager/Auditee, set auditHeadId to session.id
      // 3. If CustomerAdmin is creating and provides auditHeadId, use that
      // 4. If CustomerAdmin is creating without auditHeadId for non-AuditHead role, require it
      let auditHeadIdToSet: string | null = null;
      const isCreatingAuditHead = roleNames.includes('AuditHead');
      const isAuditHead = session.roles.includes('AuditHead');
      const isAdmin = session.roles.includes('GRCAdministrator') || session.roles.includes('CustomerAdministrator');

      if (isCreatingAuditHead) {
        // AuditHead users don't have an auditHeadId (they are the head)
        auditHeadIdToSet = null;
      } else if (isAuditHead && !isAdmin) {
        // AuditHead creating subordinates - they manage these users
        auditHeadIdToSet = session.id;
      } else if (isAdmin) {
        // Admin can explicitly assign to an AuditHead
        if (requestedAuditHeadId) {
          auditHeadIdToSet = requestedAuditHeadId;
        }
        // If not provided, leave null (admin will need to assign later)
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

      // Note: User model doesn't have auditHeadId field - removed
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
