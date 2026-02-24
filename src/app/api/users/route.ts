import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { isValidEmailFormat } from '@/lib/validations/email';
import { translateRecord } from '@/lib/translation-service';

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

    // Use transaction to ensure user creation and subscription update are atomic
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          userId,
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
          // Use relation connect syntax for foreign keys
          ...(departmentId && {
            department: { connect: { id: departmentId } },
          }),
          ...(customerAccountId && {
            customerAccount: { connect: { id: customerAccountId } },
          }),
          // Track creator for DR/DC framework visibility
          ...(createdById && {
            createdBy: { connect: { id: createdById } },
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

      return newUser;
    });

    // Remove password from response BEFORE sending notification
    const { password: _, ...safeUser } = user;

    // Fire-and-forget translation
    if (customerAccountId) {
      void translateRecord(customerAccountId, 'User', user.id, {
        fullName: user.fullName,
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
