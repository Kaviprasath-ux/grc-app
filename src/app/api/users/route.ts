import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { isValidEmailFormat } from '@/lib/validations/email';
import { translateRecord } from '@/lib/translation-service';
import { assignRoleByName, RoleAssignmentError } from '@/lib/customer-role-validator';
import { assertUserGloballyUnique } from '@/lib/user-uniqueness';
import type { RoleName } from '@/lib/permissions';

// GET all users (with optional role and department filters)
// Note: User model doesn't have auditHeadId or reportingManagerId fields - those filters removed
//
// Query params:
//   role           - filter to users holding a specific role name
//   departmentId   - filter to a department
//   moduleCode     - filter to users holding at least one role in the given
//                    module (GRC | TPRM | INTERNAL_AUDIT). Used by the
//                    per-module "User Management" and "Account Overview" tabs
//                    to hide users that belong only to other platforms.
//   includeModules - when "true", each user includes a roleModules: ModuleCode[]
//                    array (distinct UserRole.moduleCode values, null excluded).
//                    Used by the "All Users" tab to render module badges.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const departmentId = searchParams.get("departmentId");
    const moduleCode = searchParams.get("moduleCode");
    const includeModules = searchParams.get("includeModules") === "true";

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

    // Filter by module — only users with a UserRole row tagged to this platform.
    if (moduleCode === "GRC" || moduleCode === "TPRM" || moduleCode === "INTERNAL_AUDIT") {
      where.userRoles = {
        ...(where.userRoles ?? {}),
        some: {
          ...(where.userRoles?.some ?? {}),
          moduleCode,
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
    // Remove password from response and (optionally) attach roleModules
    const safeUsers = users.map(({ password, ...user }) => {
      if (!includeModules) return user;
      const roleModules = Array.from(
        new Set(
          user.userRoles
            .map((r) => r.moduleCode)
            .filter((m): m is "GRC" | "TPRM" | "INTERNAL_AUDIT" =>
              m === "GRC" || m === "TPRM" || m === "INTERNAL_AUDIT",
            ),
        ),
      );
      return { ...user, roleModules };
    });
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

    if (!userName || !email || !password || !firstName || !lastName || !fullName) {
      return NextResponse.json(
        { error: "userName, email, password, firstName, lastName, and fullName are required" },
        { status: 400 }
      );
    }

    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
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
    let customerAccountId = session?.user?.customerAccountId || null;
    // Track who created this user (for DR/DC framework visibility)
    const createdById = session?.user?.id || null;

    // Fallback: if customerAccountId is not on session, look up via user record
    if (!customerAccountId && session?.user?.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { customerAccountId: true, customerCode: true },
      });

      customerAccountId = currentUser?.customerAccountId || null;

      if (!customerAccountId && currentUser?.customerCode) {
        const account = await prisma.customerAccount.findUnique({
          where: { code: currentUser.customerCode },
          select: { id: true },
        });
        customerAccountId = account?.id || null;
      }
    }

    // Auto-generate clean sequential userId server-side (USR0001, USR0002, etc.)
    // userId is unique per customer account
    const existingUSRUsers = await prisma.user.findMany({
      where: {
        userId: { startsWith: "USR" },
        ...(customerAccountId ? { customerAccountId } : {}),
      },
      select: { userId: true },
    });
    const maxUSRId = existingUSRUsers.reduce((max: number, u) => {
      const match = u.userId?.match(/^USR(\d+)$/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    const finalUserId = `USR${String(maxUSRId + 1).padStart(4, "0")}`;

    // Phase 10 — global uniqueness (userName + email).
    const unique = await assertUserGloballyUnique({ userName, email });
    if (!unique.ok) {
      return NextResponse.json({ error: unique.message, field: unique.field }, { status: 409 });
    }

    // Check subscription plan limits before creating user
    if (customerAccountId) {
      const now = new Date();
      const activePlan = await prisma.subscriptionPlan.findFirst({
        where: {
          customerAccountId,
          status: "Active",
          expiryDate: { gte: now },
        },
      });

      if (!activePlan) {
        return NextResponse.json(
          { error: "Subscription plan has expired or is inactive" },
          { status: 403 }
        );
      }

      if (activePlan.accountsUsed >= activePlan.maxAccountsAllowed) {
        return NextResponse.json(
          { error: `Maximum accounts limit reached. Your plan allows ${activePlan.maxAccountsAllowed} accounts.` },
          { status: 403 }
        );
      }
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Use transaction to ensure user creation, role assignment, and subscription
    // update are atomic. Role assignment runs through assignRoleByName which
    // enforces the platform rules (subscription gating + one role per module — 4 platforms).
    const user = await prisma.$transaction(async (tx) => {
      // Create the user (without UserRole — that comes next so we can validate).
      const newUser = await tx.user.create({
        data: {
          userId: finalUserId,
          userName,
          email,
          password: hashedPassword,
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
          ...(departmentId && {
            department: { connect: { id: departmentId } },
          }),
          ...(customerAccountId && {
            customerAccount: { connect: { id: customerAccountId } },
          }),
          ...(createdById && {
            createdBy: { connect: { id: createdById } },
          }),
        },
      });

      // Assign role(s) — derives moduleCode(s) from the role-module map and
      // runs subscription/one-per-module validators. Throws RoleAssignmentError
      // on violation, which rolls back the transaction.
      if (roleRecord && customerAccountId) {
        await assignRoleByName({
          userId: newUser.id,
          roleName: role as RoleName,
          roleId: roleRecord.id,
          customerAccountId,
          tx: tx as unknown as typeof prisma,
        });
      }

      // Increment accountsUsed in the active subscription plan (within same transaction)
      if (customerAccountId) {
        const now = new Date();
        const activePlan = await tx.subscriptionPlan.findFirst({
          where: {
            customerAccountId,
            status: "Active",
            expiryDate: { gte: now },
          },
        });
        if (activePlan) {
          await tx.subscriptionPlan.update({
            where: { id: activePlan.id },
            data: { accountsUsed: { increment: 1 } },
          });
        }
      }

      // Re-fetch with userRoles populated (assignRoleByName ran after create).
      return tx.user.findUniqueOrThrow({
        where: { id: newUser.id },
        include: {
          department: true,
          userRoles: { include: { role: true } },
        },
      });
    });

    // Remove password from response BEFORE sending notification
    const { password: _, ...safeUser } = user;

    // Fire-and-forget translation
    if (customerAccountId) {
      void translateRecord(customerAccountId, 'User', user.id, {
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        designation: user.designation,
      });
    }

    // Send welcome notification ONLY after transaction succeeds
    // This is outside the transaction to ensure DB operations completed successfully
    if (customerAccountId && createdById) {
      // Don't await - send notification in background to avoid blocking response
      // If notification fails, user is still created successfully
      notificationService.notifyUserCreated({
        customerAccountId,
        actorId: createdById,
        newUserId: user.id,
        userName: user.fullName,
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      }).catch((err) => {
        console.error("Failed to send user creation notification:", err);
      });
    }

    return NextResponse.json(safeUser, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof RoleAssignmentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 }
      );
    }
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
