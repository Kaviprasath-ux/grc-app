import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { isValidEmailFormat } from "@/lib/validations/email";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update user - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        userName,
        email,
        firstName,
        lastName,
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

      // Verify the user belongs to the same customer account
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { customerAccountId: true, email: true },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingUser.customerAccountId)) {
        return forbidden("Access denied to this user");
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

      // If role is being updated, also update the UserRole junction table
      if (role) {
        let roleRecord = await prisma.role.findFirst({
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

        // Delete existing user roles and create new one
        await prisma.userRole.deleteMany({
          where: { userId: id }
        });
        await prisma.userRole.create({
          data: {
            userId: id,
            roleId: roleRecord.id,
          }
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          userName,
          email,
          firstName,
          lastName,
          fullName: firstName && lastName ? `${firstName} ${lastName}` : undefined,
          designation,
          function: userFunction,
          role,
          language,
          timezone,
          isActive,
          isBlocked,
          departmentId,
          reportingManagerId: reportingManagerId !== undefined ? (reportingManagerId || null) : undefined,
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

      if (existingUser.customerAccountId) void translateRecord(existingUser.customerAccountId, 'User', user.id, { fullName: user.fullName, firstName: user.firstName, lastName: user.lastName, designation: user.designation });

      const { password: _, ...safeUser } = user;
      return NextResponse.json(safeUser);
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  },
  { resource: "organization.users", action: "edit" }
);

// DELETE user - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify the user belongs to the same customer account
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingUser.customerAccountId)) {
        return forbidden("Access denied to this user");
      }

      // Prevent deleting yourself
      if (id === session.id) {
        return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
      }

      await prisma.user.delete({ where: { id } });

      if (existingUser.customerAccountId) void deleteRecordTranslations(existingUser.customerAccountId, 'User', id);

      // Decrement accountsUsed in active subscription plan
      if (existingUser.customerAccountId) {
        const now = new Date();
        const activePlan = await prisma.subscriptionPlan.findFirst({
          where: {
            customerAccountId: existingUser.customerAccountId,
            status: "Active",
            expiryDate: { gte: now },
          },
        });
        if (activePlan && activePlan.accountsUsed > 0) {
          await prisma.subscriptionPlan.update({
            where: { id: activePlan.id },
            data: { accountsUsed: { decrement: 1 } },
          });
        }
      }

      return NextResponse.json({ message: "User deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
  },
  { resource: "organization.users", action: "delete" }
);
