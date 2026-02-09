import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST - Bootstrap the superadmin user if it doesn't exist
// This ensures there's always a way to access the system
export async function POST() {
  try {
    // Check if superadmin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { userName: "superadmin" },
    });

    if (existingUser) {
      let needsUpdate = false;
      const updateData: { password?: string; isActive?: boolean; isBlocked?: boolean } = {};

      // Check if password is properly hashed (bcrypt hashes start with $2)
      if (!existingUser.password.startsWith("$2")) {
        updateData.password = await bcrypt.hash("Baarez@2025", 10);
        needsUpdate = true;
      }

      // Ensure user is active and not blocked
      if (!existingUser.isActive || existingUser.isBlocked) {
        updateData.isActive = true;
        updateData.isBlocked = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
        console.log("✅ Bootstrap: Superadmin user fixed");
      }

      // Ensure GRCAdministrator role is assigned
      let grcAdminRole = await prisma.role.findUnique({
        where: { name: "GRCAdministrator" },
      });

      if (!grcAdminRole) {
        grcAdminRole = await prisma.role.create({
          data: {
            name: "GRCAdministrator",
            description: "Full system access, all modules, all data",
            isSystem: true,
          },
        });
      }

      // Check if role is assigned
      const existingUserRole = await prisma.userRole.findFirst({
        where: {
          userId: existingUser.id,
          roleId: grcAdminRole.id,
        },
      });

      if (!existingUserRole) {
        await prisma.userRole.create({
          data: {
            userId: existingUser.id,
            roleId: grcAdminRole.id,
          },
        });
        console.log("✅ Bootstrap: GRCAdministrator role assigned to superadmin");
        needsUpdate = true;
      }

      return NextResponse.json({
        message: needsUpdate ? "Superadmin user fixed" : "Superadmin already exists",
        created: false,
        updated: needsUpdate
      });
    }

    // Check if GRCAdministrator role exists, create if not
    let grcAdminRole = await prisma.role.findUnique({
      where: { name: "GRCAdministrator" },
    });

    if (!grcAdminRole) {
      grcAdminRole = await prisma.role.create({
        data: {
          name: "GRCAdministrator",
          description: "Full system access, all modules, all data",
          isSystem: true,
        },
      });
    }

    // Check if a CustomerAccount exists for GRC Admin, create if not
    let grcAdminCustomerAccount = await prisma.customerAccount.findFirst({
      where: { code: "GRC_ADMIN" },
    });

    if (!grcAdminCustomerAccount) {
      grcAdminCustomerAccount = await prisma.customerAccount.create({
        data: {
          code: "GRC_ADMIN",
          name: "GRC Administration",
          isActive: true,
        },
      });
    }

    // Hash the password for secure storage
    const hashedPassword = await bcrypt.hash("Baarez@2025", 10);

    // Create the superadmin user
    const superadminUser = await prisma.user.create({
      data: {
        userId: "SUPERADMIN-001",
        userName: "superadmin",
        email: "superadmin@baarez.com",
        password: hashedPassword,
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
        designation: "System Administrator",
        role: "GRCAdministrator",
        function: "Administration",
        isActive: true,
        isBlocked: false,
        customerAccountId: grcAdminCustomerAccount.id,
      },
    });

    // Assign GRCAdministrator role to superadmin
    await prisma.userRole.create({
      data: {
        userId: superadminUser.id,
        roleId: grcAdminRole.id,
      },
    });

    console.log("✅ Bootstrap: Superadmin user created (superadmin / Baarez@2025)");

    return NextResponse.json({
      message: "Superadmin user created successfully",
      created: true
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap superadmin user" },
      { status: 500 }
    );
  }
}

// GET - Check if superadmin exists (for debugging)
export async function GET() {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { userName: "superadmin" },
      select: {
        id: true,
        userName: true,
        email: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      exists: !!existingUser,
      user: existingUser
    });
  } catch (error) {
    console.error("Bootstrap check error:", error);
    return NextResponse.json(
      { error: "Failed to check superadmin status" },
      { status: 500 }
    );
  }
}
