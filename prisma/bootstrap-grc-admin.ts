import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GRC Administrator Bootstrapping Script
 *
 * This script ensures a superadmin account with GRCAdministrator role exists.
 * It checks if a user with username "superadmin" has the GRCAdministrator role.
 * If not, it creates the account and assigns the role.
 */

// Superadmin credentials
const SUPERADMIN_CONFIG = {
  userName: 'superadmin',
  password: 'Baarez@2025',
  email: 'superadmin@baarez.com',
  firstName: 'Super',
  lastName: 'Admin',
  fullName: 'Super Admin',
  role: 'GRCAdministrator',
};

async function bootstrapGRCAdministrator() {
  console.log("🔐 Running GRC Administrator Bootstrapping...");

  try {
    // First, ensure the GRCAdministrator role exists
    const grcAdminRole = await prisma.role.upsert({
      where: { name: 'GRCAdministrator' },
      update: {},
      create: {
        name: 'GRCAdministrator',
        description: 'Full system access, all modules, all data',
        isSystem: true,
      },
    });
    console.log("   ✓ GRCAdministrator role ensured");

    // Check if superadmin user with GRCAdministrator role exists
    const existingSuperadminWithRole = await prisma.user.findFirst({
      where: {
        userName: SUPERADMIN_CONFIG.userName,
        userRoles: {
          some: {
            role: {
              name: 'GRCAdministrator',
            },
          },
        },
      },
    });

    if (existingSuperadminWithRole) {
      console.log("   ✓ Superadmin with GRCAdministrator role already exists");
      console.log("\n✅ GRC Administrator Bootstrapping complete (no action needed)");
      return;
    }

    console.log("   ℹ Superadmin with GRCAdministrator role not found, creating...");

    // Check if superadmin user exists (without the role)
    let superadminUser = await prisma.user.findUnique({
      where: { userName: SUPERADMIN_CONFIG.userName },
    });

    if (superadminUser) {
      console.log("   ✓ Superadmin user exists, assigning GRCAdministrator role...");
    } else {
      // Create the superadmin user
      superadminUser = await prisma.user.create({
        data: {
          userName: SUPERADMIN_CONFIG.userName,
          password: SUPERADMIN_CONFIG.password,
          email: SUPERADMIN_CONFIG.email,
          firstName: SUPERADMIN_CONFIG.firstName,
          lastName: SUPERADMIN_CONFIG.lastName,
          fullName: SUPERADMIN_CONFIG.fullName,
          role: SUPERADMIN_CONFIG.role,
        },
      });
      console.log("   ✓ Superadmin user created");
    }

    // Assign the GRCAdministrator role to superadmin
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superadminUser.id,
          roleId: grcAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: superadminUser.id,
        roleId: grcAdminRole.id,
      },
    });
    console.log("   ✓ GRCAdministrator role assigned to superadmin");

    console.log("\n✅ GRC Administrator Bootstrapping complete!");
    console.log("\n   Superadmin Credentials:");
    console.log(`   User: ${SUPERADMIN_CONFIG.userName}`);
    console.log(`   Pass: ${SUPERADMIN_CONFIG.password}`);
    console.log(`   Role: ${SUPERADMIN_CONFIG.role}`);

  } catch (error) {
    console.error("❌ Error during bootstrapping:", error);
    throw error;
  }
}

// Export for use in other scripts
export { bootstrapGRCAdministrator, SUPERADMIN_CONFIG };

// Run if executed directly
if (require.main === module) {
  bootstrapGRCAdministrator()
    .catch((e) => {
      console.error("Bootstrap failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
