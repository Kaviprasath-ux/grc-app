import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TPRM_ROLES = [
  { name: "CustomerAdministrator", description: "Organization-level admin (GRC + TPRM)" },
  { name: "TPRMCustomerAdmin", description: "Customer-level TPRM administrator" },
  { name: "FactoryAdmin", description: "Assessment Factory administrator" },
  { name: "TPRMAdmin", description: "TPRM super administrator" },
  { name: "BusinessOwner", description: "Business Owner role in TPRM" },
  { name: "RelationshipManager", description: "Relationship Manager role in TPRM" },
  { name: "TPRMAssessor", description: "Assessor role in TPRM" },
  { name: "TPRMApprover", description: "Approver role in TPRM" },
  { name: "TPRMAuditor", description: "Auditor role in TPRM" },
] as const;

interface UserSpec {
  userName: string;
  email: string;
  fullName: string;
  role: typeof TPRM_ROLES[number]["name"];
}

interface AccountSpec {
  code: string;
  name: string;
  isGrcAdded: boolean;
  admin: UserSpec;
  users: UserSpec[];
  plan: {
    maxFrameworks: number;
    maxAccounts: number;
    assessmentLimit: number;
    vendorLimit: number;
  };
}

const ACCOUNTS: AccountSpec[] = [
  {
    code: "GRC_101",
    name: "Acme Corporation",
    isGrcAdded: false,
    admin: { userName: "acme.admin", email: "admin@acme.example", fullName: "Anna Walker", role: "CustomerAdministrator" },
    users: [
      { userName: "acme.assessor", email: "assessor@acme.example", fullName: "Carlos Mendez", role: "TPRMAssessor" },
      { userName: "acme.approver", email: "approver@acme.example", fullName: "Priya Iyer", role: "TPRMApprover" },
      { userName: "acme.bo", email: "bo@acme.example", fullName: "Marcus Hill", role: "BusinessOwner" },
      { userName: "acme.rm", email: "rm@acme.example", fullName: "Sofia Rossi", role: "RelationshipManager" },
      { userName: "acme.auditor", email: "auditor@acme.example", fullName: "Daniel Brooks", role: "TPRMAuditor" },
    ],
    plan: { maxFrameworks: 5, maxAccounts: 20, assessmentLimit: 50, vendorLimit: 25 },
  },
  {
    code: "GRC_102",
    name: "Sentinel Bank",
    isGrcAdded: true,
    admin: { userName: "sentinel.admin", email: "admin@sentinelbank.example", fullName: "Naomi Patel", role: "CustomerAdministrator" },
    users: [
      { userName: "sentinel.assessor", email: "assessor@sentinelbank.example", fullName: "Henry Okafor", role: "TPRMAssessor" },
      { userName: "sentinel.approver", email: "approver@sentinelbank.example", fullName: "Elena Garcia", role: "TPRMApprover" },
      { userName: "sentinel.bo", email: "bo@sentinelbank.example", fullName: "Liam Chen", role: "BusinessOwner" },
      { userName: "sentinel.rm", email: "rm@sentinelbank.example", fullName: "Aisha Kareem", role: "RelationshipManager" },
    ],
    plan: { maxFrameworks: 10, maxAccounts: 50, assessmentLimit: 200, vendorLimit: 100 },
  },
  {
    code: "GRC_103",
    name: "Nimbus Cloud Co",
    isGrcAdded: false,
    admin: { userName: "nimbus.admin", email: "admin@nimbus.example", fullName: "Jordan Lee", role: "CustomerAdministrator" },
    users: [
      { userName: "nimbus.assessor", email: "assessor@nimbus.example", fullName: "Ravi Nair", role: "TPRMAssessor" },
      { userName: "nimbus.approver", email: "approver@nimbus.example", fullName: "Beatrice Lin", role: "TPRMApprover" },
      { userName: "nimbus.bo", email: "bo@nimbus.example", fullName: "Theo Andersson", role: "BusinessOwner" },
    ],
    plan: { maxFrameworks: 3, maxAccounts: 10, assessmentLimit: 25, vendorLimit: 15 },
  },
];

async function main() {
  console.log("Seeding TPRM customer accounts...");

  const password = await bcrypt.hash("1", 10);

  // 1. Ensure roles exist
  const roleMap: Record<string, string> = {};
  for (const r of TPRM_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, isSystem: true },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`   Roles ready (${Object.keys(roleMap).length})`);

  for (const acc of ACCOUNTS) {
    // 2. Create customer account
    const existing = await prisma.customerAccount.findUnique({ where: { code: acc.code } });
    if (existing) {
      console.log(`   Skipping ${acc.code} — already exists`);
      continue;
    }

    const ca = await prisma.customerAccount.create({
      data: {
        code: acc.code,
        name: acc.name,
        isActive: true,
        isGrcAdded: acc.isGrcAdded,
        isTprmAdded: true,
      },
    });

    // 3. Create subscription plan
    const start = new Date();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    await prisma.subscriptionPlan.create({
      data: {
        customerAccountId: ca.id,
        startDate: start,
        expiryDate: expiry,
        maxFrameworksAllowed: acc.plan.maxFrameworks,
        maxAccountsAllowed: acc.plan.maxAccounts,
        assessmentLimit: acc.plan.assessmentLimit,
        vendorLimit: acc.plan.vendorLimit,
        status: "Active",
        moduleCode: "TPRM",
      },
    });

    // 4. Create admin + users
    const allUsers = [acc.admin, ...acc.users];
    for (const u of allUsers) {
      const [firstName, ...rest] = u.fullName.split(/\s+/);
      const lastName = rest.join(" ") || firstName;

      const user = await prisma.user.create({
        data: {
          userId: `USR-${acc.code}-${u.userName.toUpperCase()}`,
          userName: u.userName,
          email: u.email,
          password,
          firstName,
          lastName,
          fullName: u.fullName,
          role: u.role,
          customerCode: acc.code,
          customerAccountId: ca.id,
          isActive: true,
          isBlocked: false,
          language: "en-US",
          timezone: "Asia/Qatar",
        },
      });

      await prisma.userRole.create({
        data: { userId: user.id, roleId: roleMap[u.role], moduleCode: "TPRM" },
      });
    }

    console.log(`   ${acc.code} ${acc.name} -> ${allUsers.length} users`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
