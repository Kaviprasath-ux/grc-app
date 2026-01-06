import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed RBAC (Role-Based Access Control) data
 *
 * This script creates:
 * 1. All 11 roles with descriptions
 * 2. Assigns roles to existing users
 */
async function main() {
  console.log("🔐 Seeding RBAC data...");

  // ==================== CREATE ROLES ====================
  const roles = [
    {
      name: "GRCAdministrator",
      description: "Full system access, all modules, all data",
      isSystem: true,
    },
    {
      name: "CustomerAdministrator",
      description: "Organization-level admin, manages users and settings",
      isSystem: true,
    },
    {
      name: "AuditHead",
      description: "Full access to Internal Audit module, all audit data",
      isSystem: true,
    },
    {
      name: "AuditManager",
      description: "Manages audits, assigns auditors, reviews findings",
      isSystem: true,
    },
    {
      name: "AuditUser",
      description: "Basic audit module access",
      isSystem: true,
    },
    {
      name: "Auditor",
      description: "Conducts audits, creates findings",
      isSystem: true,
    },
    {
      name: "Auditee",
      description: "Receives audit requests, responds to findings (permanent role)",
      isSystem: true,
    },
    {
      name: "Reviewer",
      description: "Reviews and approves across modules",
      isSystem: true,
    },
    {
      name: "Contributor",
      description: "Creates and edits content across modules",
      isSystem: true,
    },
    {
      name: "DepartmentReviewer",
      description: "Reviews content within own department",
      isSystem: true,
    },
    {
      name: "DepartmentContributor",
      description: "Creates/edits content within own department",
      isSystem: true,
    },
  ];

  const createdRoles: Record<string, string> = {};

  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        isSystem: role.isSystem,
      },
      create: role,
    });
    createdRoles[role.name] = created.id;
    console.log(`  ✓ Role: ${role.name}`);
  }

  console.log("✅ Roles created");

  // ==================== ASSIGN ROLES TO EXISTING USERS ====================
  // Map old role names to new RBAC roles

  const userRoleMappings: Record<string, string[]> = {
    // bts.admin - full admin
    "bts.admin": ["GRCAdministrator"],
    // john.doe - compliance manager
    "john.doe": ["CustomerAdministrator", "Reviewer"],
    // sarah.smith - lead auditor
    "sarah.smith": ["AuditHead"],
    // mike.wilson - risk analyst
    "mike.wilson": ["Contributor", "Reviewer"],
    // emily.brown - HR Manager (department level access)
    "emily.brown": ["DepartmentContributor", "Auditee"],
    // david.jones - IT Support
    "david.jones": ["DepartmentContributor", "Auditee"],
    // lisa.taylor - Product Manager
    "lisa.taylor": ["DepartmentContributor"],
    // james.anderson - Sales Director
    "james.anderson": ["DepartmentReviewer", "Auditee"],
  };

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, userName: true },
  });

  for (const user of users) {
    const roleNames = userRoleMappings[user.userName];
    if (!roleNames) continue;

    for (const roleName of roleNames) {
      const roleId = createdRoles[roleName];
      if (!roleId) continue;

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleId,
        },
      });
    }
    console.log(`  ✓ Assigned roles to ${user.userName}: ${roleNames.join(", ")}`);
  }

  console.log("✅ User roles assigned");

  // ==================== CREATE TEST USERS FOR EACH ROLE ====================
  // Create additional test users with specific roles for testing

  const testUsers = [
    {
      userName: "test.grcadmin",
      email: "grcadmin@test.com",
      firstName: "Test",
      lastName: "GRCAdmin",
      password: "test123",
      roles: ["GRCAdministrator"],
    },
    {
      userName: "test.customeradmin",
      email: "customeradmin@test.com",
      firstName: "Test",
      lastName: "CustomerAdmin",
      password: "test123",
      roles: ["CustomerAdministrator"],
    },
    {
      userName: "test.audithead",
      email: "audithead@test.com",
      firstName: "Test",
      lastName: "AuditHead",
      password: "test123",
      roles: ["AuditHead"],
    },
    {
      userName: "test.auditor",
      email: "auditor@test.com",
      firstName: "Test",
      lastName: "Auditor",
      password: "test123",
      roles: ["Auditor"],
    },
    {
      userName: "test.auditee",
      email: "auditee@test.com",
      firstName: "Test",
      lastName: "Auditee",
      password: "test123",
      roles: ["Auditee"],
    },
    {
      userName: "test.reviewer",
      email: "reviewer@test.com",
      firstName: "Test",
      lastName: "Reviewer",
      password: "test123",
      roles: ["Reviewer"],
    },
    {
      userName: "test.contributor",
      email: "contributor@test.com",
      firstName: "Test",
      lastName: "Contributor",
      password: "test123",
      roles: ["Contributor"],
    },
    {
      userName: "test.deptreviewer",
      email: "deptreviewer@test.com",
      firstName: "Test",
      lastName: "DeptReviewer",
      password: "test123",
      roles: ["DepartmentReviewer"],
    },
    {
      userName: "test.deptcontrib",
      email: "deptcontrib@test.com",
      firstName: "Test",
      lastName: "DeptContrib",
      password: "test123",
      roles: ["DepartmentContributor"],
    },
  ];

  // Get a department for test users
  const itDept = await prisma.department.findFirst({
    where: { name: "IT Operations" },
  });

  for (const testUser of testUsers) {
    const user = await prisma.user.upsert({
      where: { userName: testUser.userName },
      update: {},
      create: {
        userName: testUser.userName,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        fullName: `${testUser.firstName} ${testUser.lastName}`,
        password: testUser.password,
        departmentId: itDept?.id,
      },
    });

    // Assign roles
    for (const roleName of testUser.roles) {
      const roleId = createdRoles[roleName];
      if (!roleId) continue;

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleId,
        },
      });
    }
    console.log(`  ✓ Created test user: ${testUser.userName} with roles: ${testUser.roles.join(", ")}`);
  }

  console.log("✅ Test users created");

  console.log("\n🎉 RBAC seeding complete!");
  console.log("\nTest accounts (password: test123):");
  console.log("  - test.grcadmin (GRCAdministrator - full access)");
  console.log("  - test.customeradmin (CustomerAdministrator - org admin)");
  console.log("  - test.audithead (AuditHead - audit module admin)");
  console.log("  - test.auditor (Auditor - conduct audits)");
  console.log("  - test.auditee (Auditee - respond to audits)");
  console.log("  - test.reviewer (Reviewer - review & approve)");
  console.log("  - test.contributor (Contributor - create & edit)");
  console.log("  - test.deptreviewer (DepartmentReviewer - dept scope)");
  console.log("  - test.deptcontrib (DepartmentContributor - dept scope)");
}

main()
  .catch((e) => {
    console.error("Error seeding RBAC data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
