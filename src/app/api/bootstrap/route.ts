import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST - Bootstrap the superadmin user if it doesn't exist
// This ensures there's always a way to access the system
export async function POST() {
  try {
    // Check if superadmin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { userName: "superadmin" },
    });

    if (existingUser) {
      return NextResponse.json({
        message: "Superadmin already exists",
        created: false
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

    // Create the superadmin user
    const superadminUser = await prisma.user.create({
      data: {
        userId: "SUPERADMIN-001",
        userName: "superadmin",
        email: "superadmin@baarez.com",
        password: "Baarez@2025",
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
