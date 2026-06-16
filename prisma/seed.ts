import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedEmailTemplates } from "./seed-email-templates";
import { seedSubscriptionCatalog } from "./seed-subscription-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Hash password
  const hashedPassword = await bcrypt.hash("1", 10);

  // ==================== SUPERADMIN CUSTOMER ACCOUNT ====================
  const superadminCustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "SUPERADMIN_001" },
    update: {},
    create: {
      id: "superadmin-account-1",
      code: "SUPERADMIN_001",
      name: "Super Admin Account",
      isActive: true,
      isGrcAdded: true,
      isTprmAdded: true,
    },
  });
  console.log("✅ Superadmin Customer Account created");

  // ==================== SUBSCRIPTION PLAN ====================
  await prisma.subscriptionPlan.upsert({
    where: { id: "subscription-plan-superadmin" },
    update: {
      expiryDate: new Date("2030-12-31"),
      status: "Active",
    },
    create: {
      id: "subscription-plan-superadmin",
      customerAccountId: superadminCustomerAccount.id,
      startDate: new Date(),
      expiryDate: new Date("2030-12-31"),
      maxFrameworksAllowed: 999,
      maxAccountsAllowed: 999,
      assessmentLimit: 999,
      vendorLimit: 999,
      frameworksUsed: 0,
      accountsUsed: 0,
      status: "Active",
    },
  });
  console.log("✅ Subscription Plan created");

  // ==================== RBAC ROLES ====================
  const roleDefinitions = [
    { name: "GRCAdministrator", description: "Full system access, all modules, all data", isSystem: true },
    { name: "CustomerAdministrator", description: "Organization-level admin, manages users and settings", isSystem: true },
    { name: "AuditHead", description: "Full access to Internal Audit module, all audit data", isSystem: true },
    { name: "AuditManager", description: "Manages audits, assigns auditors, reviews findings", isSystem: true },
    { name: "Auditor", description: "Conducts audits, creates findings", isSystem: true },
    { name: "Auditee", description: "Receives audit requests, responds to findings", isSystem: true },
    { name: "Reviewer", description: "Reviews and approves compliance, risk, and asset content", isSystem: true },
    { name: "Contributor", description: "Creates and edits content across modules", isSystem: true },
    { name: "DepartmentReviewer", description: "Reviews content within own department", isSystem: true },
    { name: "DepartmentContributor", description: "Creates/edits content within own department", isSystem: true },
    // TPRM Module roles
    { name: "TPRMCustomerAdmin", description: "Customer-level TPRM administrator", isSystem: true },
    { name: "FactoryAdmin", description: "Assessment Factory administrator", isSystem: true },
    { name: "TPRMAdmin", description: "TPRM super administrator", isSystem: true },
    { name: "BusinessOwner", description: "Business Owner role in TPRM", isSystem: true },
    { name: "RelationshipManager", description: "Relationship Manager role in TPRM", isSystem: true },
    { name: "TPRMAssessor", description: "Assessor role in TPRM", isSystem: true },
    { name: "TPRMApprover", description: "Approver role in TPRM", isSystem: true },
    { name: "TPRMAuditor", description: "Auditor role in TPRM", isSystem: true },
    // Support Ticketing roles
    { name: "SupportAgentL1", description: "Level 1 support agent — handles assigned tickets, escalates to L2", isSystem: true },
    { name: "SupportSpecialistL2", description: "Level 2 functional/domain specialist", isSystem: true },
    { name: "SupportEngineerL3", description: "Level 3 engineering support", isSystem: true },
    { name: "SupportManager", description: "Support manager — full ticket access and routing settings", isSystem: true },
  ];

  const createdRoles: { [key: string]: string } = {};
  for (const roleDef of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: roleDef,
    });
    createdRoles[roleDef.name] = role.id;
  }
  console.log("✅ RBAC Roles created");

  // ==================== SUPERADMIN USER ====================
  const superadminUser = await prisma.user.upsert({
    where: { customerAccountId_userId: { customerAccountId: superadminCustomerAccount.id, userId: "SUPERADMIN-001" } },
    update: {
      password: hashedPassword,
    },
    create: {
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
      customerAccountId: superadminCustomerAccount.id,
    },
  });

  // Assign GRCAdministrator role to superadmin (system-wide, moduleCode = null).
  // Prisma upsert() can't accept null in a compound unique, so we use findFirst + create.
  const existingSuperadminRole = await prisma.userRole.findFirst({
    where: {
      userId: superadminUser.id,
      roleId: createdRoles["GRCAdministrator"],
      moduleCode: null,
    },
  });
  if (!existingSuperadminRole) {
    await prisma.userRole.create({
      data: {
        userId: superadminUser.id,
        roleId: createdRoles["GRCAdministrator"],
        moduleCode: null,
      },
    });
  }
  console.log("✅ Superadmin user created (superadmin / 1)");

  // ==================== SEED EMAIL TEMPLATES ====================
  await seedEmailTemplates();
  console.log("✅ Email templates seeded");

  // ==================== SEED SUBSCRIPTION CATALOG ====================
  await seedSubscriptionCatalog(prisma);
  console.log("✅ Subscription catalog seeded");

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Login Credentials:");
  console.log("   Username: superadmin");
  console.log("   Password: 1");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
