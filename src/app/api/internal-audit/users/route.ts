import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId } from "@/lib/api-auth";
import { isValidEmailFormat } from "@/lib/validations/email";
import { translateRecord } from "@/lib/translation-service";

// Audit-related roles that can be assigned in Internal Audit user management
const AUDIT_ROLES = ["AuditHead", "Auditor", "Auditee"];

// Roles that CustomerAdmin can create (AuditHead, Auditor, Auditee)
const CUSTOMER_ADMIN_ALLOWED_ROLES = ["AuditHead", "Auditor", "Auditee"];

// Roles that AuditHead can create (Auditor and Auditee - NOT AuditHead)
const AUDIT_HEAD_ALLOWED_ROLES = ["Auditor", "Auditee"];

// GET all audit users - filtered by tenant and audit head
// AuditHead can only see their own managed users (Auditor/Auditee)
// CustomerAdmin/GRCAdmin can see all audit users
// Query params:
//   ?role=Auditee - Returns only auditees associated with the current audit head
//   ?role=auditors - Returns the audit head and their audit managers (for auditor dropdown)
//   ?role=Auditor - Returns only audit managers associated with the current audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const { searchParams } = new URL(req.url);
      const roleFilter = searchParams.get("role");
      const departmentIdFilter = searchParams.get("departmentId");

      // Determine audit head context
      const isAuditHead = session.roles.includes('AuditHead');
      const isAdmin = session.roles.includes('GRCAdministrator') || session.roles.includes('CustomerAdministrator');
      const auditHeadId = getAuditHeadId(session);

      // Build the where clause based on role filter
      let whereClause: Record<string, unknown> = {
        ...tenantFilter,
      };

      // Filter by department if provided
      if (departmentIdFilter) {
        whereClause.departmentId = departmentIdFilter;
      }

      if (roleFilter === "Auditee") {
        // Return only auditees associated with this audit head
        whereClause = {
          ...whereClause,
          userRoles: {
            some: {
              role: { name: "Auditee" },
            },
          },
        };
        if (auditHeadId) {
          whereClause.auditHeadId = auditHeadId;
        }
      } else if (roleFilter === "auditors") {
        // Return audit head + audit managers for auditor dropdown
        // This includes the audit head themselves and their audit managers
        if (auditHeadId) {
          whereClause.OR = [
            { id: auditHeadId }, // Include the audit head themselves
            {
              auditHeadId: auditHeadId,
              userRoles: {
                some: {
                  role: { name: "Auditor" },
                },
              },
            }, // Include audit managers under this audit head
          ];
        } else {
          // If no audit head context, return users with AuditHead or Auditor roles
          whereClause.userRoles = {
            some: {
              role: { name: { in: ["AuditHead", "Auditor"] } },
            },
          };
        }
      } else if (roleFilter === "Auditor") {
        // Return only audit managers associated with this audit head
        whereClause = {
          ...whereClause,
          userRoles: {
            some: {
              role: { name: "Auditor" },
            },
          },
        };
        if (auditHeadId) {
          whereClause.auditHeadId = auditHeadId;
        }
      } else {
        // Default: return all audit users
        whereClause.userRoles = {
          some: {
            role: {
              name: { in: AUDIT_ROLES },
            },
          },
        };

        // AuditHead/Auditor see all audit users within their tenant (same as CustomerAdmin)
        // Tenant isolation is already handled by getTenantFilter above
      }

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
// Role creation restrictions:
// - CustomerAdmin can ONLY create AuditHead users
// - AuditHead can ONLY create Auditor and Auditee users (associated with themselves)
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

      if (!isValidEmailFormat(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      // Determine who is creating the user
      const isAuditHead = session.roles.includes('AuditHead');
      const isCustomerAdmin = session.roles.includes('CustomerAdministrator');
      const isGRCAdmin = session.roles.includes('GRCAdministrator');

      // Parse roles (comma-separated string)
      const roleNames: string[] = role ? role.split(",").map((r: string) => r.trim()).filter(Boolean) : [];

      // Validate role restrictions based on who is creating
      if (isCustomerAdmin && !isGRCAdmin) {
        // CustomerAdmin can ONLY create AuditHead users
        const invalidRoles = roleNames.filter(r => !CUSTOMER_ADMIN_ALLOWED_ROLES.includes(r));
        if (invalidRoles.length > 0) {
          return NextResponse.json(
            { error: `Customer Administrator can only create Audit Head users. Cannot assign roles: ${invalidRoles.join(', ')}` },
            { status: 403 }
          );
        }
      } else if (isAuditHead && !isCustomerAdmin && !isGRCAdmin) {
        // AuditHead can ONLY create Auditor and Auditee users
        const invalidRoles = roleNames.filter(r => !AUDIT_HEAD_ALLOWED_ROLES.includes(r));
        if (invalidRoles.length > 0) {
          return NextResponse.json(
            { error: `Audit Head can only create Audit Manager and Auditee users. Cannot assign roles: ${invalidRoles.join(', ')}` },
            { status: 403 }
          );
        }
      }

      // Determine the auditHeadId for this new user
      // Rules:
      // 1. If creating an AuditHead, no auditHeadId is set (they are their own head)
      // 2. If AuditHead is creating Auditor/Auditee, set auditHeadId to session.id (automatic association)
      let auditHeadIdToSet: string | null = null;
      const isCreatingAuditHead = roleNames.includes('AuditHead');

      if (isCreatingAuditHead) {
        // AuditHead users don't have an auditHeadId (they are the head)
        auditHeadIdToSet = null;
      } else if (isAuditHead && !isCustomerAdmin && !isGRCAdmin) {
        // AuditHead creating subordinates - automatically associate with themselves
        auditHeadIdToSet = session.id;
      }

      // Get customer account ID for multi-tenant isolation
      const customerAccountId = getCustomerAccountId(session);

      // Auto-generate userId server-side to avoid race conditions
      // userId is unique per customer account
      const existingBAUsers = await prisma.user.findMany({
        where: {
          userId: { startsWith: "BA" },
          ...(customerAccountId ? { customerAccountId } : {}),
        },
        select: { userId: true },
      });
      const maxBAId = existingBAUsers.reduce((max: number, u) => {
        const match = u.userId?.match(/^BA(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const generatedUserId = `BA${String(maxBAId + 1).padStart(4, "0")}`;
      // Use server-generated ID (ignore client-sent userId)
      const finalUserId = generatedUserId;

      const existingByUserName = await prisma.user.findFirst({
        where: { userName, customerAccountId: customerAccountId || undefined },
        select: { id: true },
      });
      if (existingByUserName) {
        return NextResponse.json(
          { error: `Username "${userName}" is already taken. Please choose a different username.` },
          { status: 409 }
        );
      }

      const existingByEmail = await prisma.user.findFirst({
        where: { email, customerAccountId: customerAccountId || undefined },
        select: { id: true },
      });
      if (existingByEmail) {
        return NextResponse.json(
          { error: `Email "${email}" is already taken. Please choose a different email.` },
          { status: 409 }
        );
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

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          userId: finalUserId,
          userName,
          email,
          password: hashedPassword,
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
          // Set auditHeadId for Auditor/Auditee users created by AuditHead
          auditHeadId: auditHeadIdToSet,
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
          auditHead: {
            select: { id: true, fullName: true },
          },
        },
      });

      // Trigger translation for the new user
      if (customerAccountId) void translateRecord(customerAccountId, 'User', user.id, { fullName: user.fullName, firstName: user.firstName, lastName: user.lastName, designation: user.designation });

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
