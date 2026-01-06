import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GRC Administrator Bootstrapping Script
 *
 * This script manages the creation of the GRCAdministrator superadmin account.
 *
 * Configuration Options:
 * - FORCE_CREATE_MODE: When true, always creates/ensures the superadmin account exists
 * - CONDITIONAL_CREATE_MODE: When true, only creates if no GRCAdministrator exists
 *
 * Current Phase: FORCE_CREATE_MODE (Transitional)
 * Future Phase: CONDITIONAL_CREATE_MODE (switch BOOTSTRAP_MODE to 'conditional')
 */

// Configuration flag - change this to switch between modes
const BOOTSTRAP_MODE: 'force' | 'conditional' = 'force';

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
  console.log(`   Mode: ${BOOTSTRAP_MODE.toUpperCase()}`);

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

    if (BOOTSTRAP_MODE === 'conditional') {
      // CONDITIONAL MODE: Only create if no GRCAdministrator exists
      const existingGRCAdmin = await prisma.userRole.findFirst({
        where: {
          role: {
            name: 'GRCAdministrator',
          },
        },
        include: {
          user: true,
        },
      });

      if (existingGRCAdmin) {
        console.log(`   ℹ GRCAdministrator already exists: ${existingGRCAdmin.user.userName}`);
        console.log("   Skipping superadmin creation (conditional mode)");
        return;
      }

      console.log("   No existing GRCAdministrator found, creating superadmin...");
    } else {
      // FORCE MODE: Always ensure superadmin exists
      console.log("   Force mode: Ensuring superadmin account exists...");
    }

    // Check if superadmin user already exists
    const existingSuperadmin = await prisma.user.findUnique({
      where: { userName: SUPERADMIN_CONFIG.userName },
    });

    let superadminUser;

    if (existingSuperadmin) {
      console.log("   ✓ Superadmin user already exists (not overriding)");
      superadminUser = existingSuperadmin;
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

    // Ensure the user has the GRCAdministrator role
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
export { bootstrapGRCAdministrator, BOOTSTRAP_MODE, SUPERADMIN_CONFIG };

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
