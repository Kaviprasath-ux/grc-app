import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureComplimentarySubscription, type ModuleCode } from "../src/lib/customer-complimentary";

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
  { name: "AccountManager", description: "Vendor-side Account Manager" },
] as const;

type RoleName = typeof TPRM_ROLES[number]["name"];

interface UserSpec {
  userName: string;
  email: string;
  fullName: string;
  role: RoleName;
  /** Stored on User.tprmRole — different field from the system Role. */
  tprmRole?: string;
}

interface VendorSpec {
  code: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  amUserName: string; // links to one of the AccountManagers in the same account
  serviceCategory: string;
  status: "Onboarding" | "Active" | "Inactive" | "Offboarding" | "Offboarded";
  vrr: "Critical" | "High" | "Moderate" | "Low" | "Nominal";
  contractStart?: string;
  contractEnd?: string;
  onboardedDaysAgo?: number;
  accessToNetwork?: boolean;
  cloud?: boolean;
  accessToData?: boolean;
  pii?: boolean;
}

interface AssessmentSpec {
  code: string;
  vendorCode: string;
  type: "Onboarding Assessment" | "Periodic Assessment" | "On-Demand Assessment" | "Assessment Factory";
  status:
    | "Draft"
    | "In-Progress"
    | "Submitted"
    | "Under Review"
    | "In-Progress(approver)"
    | "Returned"
    | "Reviewed"
    | "Approved"
    | "Rejected";
  initiatedBy: string; // userName
  assessor?: string; // userName
  approver?: string; // userName
  result?: "Satisfactory" | "Unsatisfactory" | "Deficient";
  daysAgo: number; // submission date offset from now
}

interface AccountSpec {
  code: string;
  name: string;
  isGrcAdded: boolean;
  admin: UserSpec;
  staff: UserSpec[];
  accountManagers: UserSpec[];
  plan: { maxFrameworks: number; maxAccounts: number; assessmentLimit: number; vendorLimit: number };
  serviceCategories: string[];
  disciplines: string[];
  domains: string[];
  vendors: VendorSpec[];
  assessments: AssessmentSpec[];
}

// Reused across all tenants — kept generic.
const COMMON_SERVICE_CATEGORIES = [
  "IT Services",
  "Cloud Infrastructure",
  "Cybersecurity",
  "Consulting",
  "Data Analytics",
  "Managed Services",
];
const COMMON_DISCIPLINES = ["Compliance", "Cyber", "Privacy", "Operations"];
const COMMON_DOMAINS = [
  "Information Security",
  "Data Privacy",
  "Business Continuity",
  "Access Control",
  "Vendor Risk Management",
];

const COMMON_ONBOARDING_QUESTIONS = [
  { title: "Access to Network", question: "Does the vendor require access to our internal network?", score: 15 },
  { title: "Cloud Service", question: "Does the vendor host data or services in the cloud?", score: 10 },
  { title: "Access to Data", question: "Will the vendor have access to our data?", score: 15 },
  { title: "PII / Sensitive Data", question: "Will the vendor process PII or other sensitive data?", score: 20 },
  { title: "Critical Business Function", question: "Does the vendor support a critical business function?", score: 10 },
];

const COMMON_MASTER_QUESTIONS: { domain: string; text: string; severity: "High" | "Medium" | "Low" }[] = [
  { domain: "Information Security", text: "Does the organization maintain a documented information security policy reviewed at least annually?", severity: "High" },
  { domain: "Information Security", text: "Are security incidents logged, investigated and reported to a defined response team?", severity: "High" },
  { domain: "Data Privacy", text: "Does the organization classify personal data and apply controls appropriate to each classification?", severity: "High" },
  { domain: "Data Privacy", text: "Is a Data Protection Officer (or equivalent role) appointed?", severity: "Medium" },
  { domain: "Business Continuity", text: "Do you have a documented and tested business continuity plan?", severity: "High" },
  { domain: "Business Continuity", text: "Are recovery time objectives (RTO) defined and validated for critical services?", severity: "Medium" },
  { domain: "Access Control", text: "Is multi-factor authentication enforced for all privileged accounts?", severity: "High" },
  { domain: "Access Control", text: "Are user access rights reviewed at least quarterly?", severity: "Medium" },
  { domain: "Vendor Risk Management", text: "Do you assess your own subcontractors for security and privacy risk?", severity: "Medium" },
  { domain: "Vendor Risk Management", text: "Are vendor contracts reviewed for security and compliance clauses?", severity: "Low" },
];

const ACCOUNTS: AccountSpec[] = [
  {
    code: "GRC_101",
    name: "Acme Corporation",
    isGrcAdded: false,
    admin: { userName: "acme.admin", email: "admin@acme.example", fullName: "Anna Walker", role: "CustomerAdministrator" },
    staff: [
      { userName: "acme.assessor", email: "assessor@acme.example", fullName: "Carlos Mendez", role: "TPRMAssessor", tprmRole: "Assessor" },
      { userName: "acme.approver", email: "approver@acme.example", fullName: "Priya Iyer", role: "TPRMApprover", tprmRole: "Approver" },
      { userName: "acme.bo", email: "bo@acme.example", fullName: "Marcus Hill", role: "BusinessOwner", tprmRole: "BusinessOwner" },
      { userName: "acme.rm", email: "rm@acme.example", fullName: "Sofia Rossi", role: "RelationshipManager", tprmRole: "RelationshipManager" },
      { userName: "acme.auditor", email: "auditor@acme.example", fullName: "Daniel Brooks", role: "TPRMAuditor", tprmRole: "Auditor" },
    ],
    accountManagers: [
      { userName: "acme.am1", email: "am1@vendors.acme.example", fullName: "Rahul Mehta", role: "AccountManager", tprmRole: "Account Manager" },
      { userName: "acme.am2", email: "am2@vendors.acme.example", fullName: "Linda Chen", role: "AccountManager", tprmRole: "Account Manager" },
    ],
    plan: { maxFrameworks: 5, maxAccounts: 20, assessmentLimit: 50, vendorLimit: 25 },
    serviceCategories: COMMON_SERVICE_CATEGORIES,
    disciplines: COMMON_DISCIPLINES,
    domains: COMMON_DOMAINS,
    vendors: [
      { code: "VEN001", name: "Fortinet", contactEmail: "contact@fortinet.example", contactPhone: "+1-408-235-7700", amUserName: "acme.am1", serviceCategory: "Cybersecurity", status: "Active", vrr: "High", contractStart: "2025-01-15", contractEnd: "2026-01-14", onboardedDaysAgo: 120, accessToNetwork: true, cloud: true, accessToData: true, pii: false },
      { code: "VEN002", name: "Cloudsync Pro", contactEmail: "support@cloudsyncpro.example", contactPhone: "+1-650-555-0142", amUserName: "acme.am1", serviceCategory: "Cloud Infrastructure", status: "Active", vrr: "Critical", contractStart: "2025-03-01", contractEnd: "2026-02-28", onboardedDaysAgo: 80, accessToNetwork: false, cloud: true, accessToData: true, pii: true },
      { code: "VEN003", name: "Damien Vendor", contactEmail: "info@damienvendor.example", contactPhone: "+1-415-555-0199", amUserName: "acme.am2", serviceCategory: "Consulting", status: "Onboarding", vrr: "Moderate" },
      { code: "VEN004", name: "Palo Networks", contactEmail: "sales@palonetworks.example", contactPhone: "+1-408-555-0188", amUserName: "acme.am2", serviceCategory: "Cybersecurity", status: "Inactive", vrr: "High" },
      { code: "VEN005", name: "NetSense CyberSecurity", contactEmail: "ops@netsense.example", contactPhone: "+1-212-555-0177", amUserName: "acme.am1", serviceCategory: "Cybersecurity", status: "Offboarding", vrr: "Moderate", onboardedDaysAgo: 400 },
    ],
    assessments: [
      { code: "ASM-ACME-001", vendorCode: "VEN001", type: "Onboarding Assessment", status: "Approved", initiatedBy: "acme.admin", assessor: "acme.assessor", approver: "acme.approver", result: "Satisfactory", daysAgo: 90 },
      { code: "ASM-ACME-002", vendorCode: "VEN002", type: "Periodic Assessment", status: "Under Review", initiatedBy: "acme.admin", assessor: "acme.assessor", daysAgo: 14 },
      { code: "ASM-ACME-003", vendorCode: "VEN003", type: "Onboarding Assessment", status: "In-Progress", initiatedBy: "acme.rm", daysAgo: 5 },
      { code: "ASM-ACME-004", vendorCode: "VEN004", type: "On-Demand Assessment", status: "Returned", initiatedBy: "acme.admin", assessor: "acme.assessor", approver: "acme.approver", daysAgo: 21 },
      { code: "ASM-ACME-005", vendorCode: "VEN005", type: "On-Demand Assessment", status: "Submitted", initiatedBy: "acme.admin", assessor: "acme.assessor", daysAgo: 7 },
    ],
  },
  {
    code: "GRC_102",
    name: "Sentinel Bank",
    isGrcAdded: true,
    admin: { userName: "sentinel.admin", email: "admin@sentinelbank.example", fullName: "Naomi Patel", role: "CustomerAdministrator" },
    staff: [
      { userName: "sentinel.assessor", email: "assessor@sentinelbank.example", fullName: "Henry Okafor", role: "TPRMAssessor", tprmRole: "Assessor" },
      { userName: "sentinel.approver", email: "approver@sentinelbank.example", fullName: "Elena Garcia", role: "TPRMApprover", tprmRole: "Approver" },
      { userName: "sentinel.bo", email: "bo@sentinelbank.example", fullName: "Liam Chen", role: "BusinessOwner", tprmRole: "BusinessOwner" },
      { userName: "sentinel.rm", email: "rm@sentinelbank.example", fullName: "Aisha Kareem", role: "RelationshipManager", tprmRole: "RelationshipManager" },
    ],
    accountManagers: [
      { userName: "sentinel.am1", email: "am1@vendors.sentinelbank.example", fullName: "Marcus Okonkwo", role: "AccountManager", tprmRole: "Account Manager" },
      { userName: "sentinel.am2", email: "am2@vendors.sentinelbank.example", fullName: "Yuki Tanaka", role: "AccountManager", tprmRole: "Account Manager" },
    ],
    plan: { maxFrameworks: 10, maxAccounts: 50, assessmentLimit: 200, vendorLimit: 100 },
    serviceCategories: COMMON_SERVICE_CATEGORIES,
    disciplines: COMMON_DISCIPLINES,
    domains: COMMON_DOMAINS,
    vendors: [
      { code: "VEN001", name: "Refinitiv Data Services", contactEmail: "support@refinitiv.example", contactPhone: "+1-646-223-4000", amUserName: "sentinel.am1", serviceCategory: "Data Analytics", status: "Active", vrr: "Critical", contractStart: "2025-02-01", contractEnd: "2027-01-31", onboardedDaysAgo: 110, accessToNetwork: true, cloud: true, accessToData: true, pii: true },
      { code: "VEN002", name: "BlackRock Aladdin", contactEmail: "aladdin@blackrock.example", contactPhone: "+1-212-810-5300", amUserName: "sentinel.am1", serviceCategory: "Cloud Infrastructure", status: "Active", vrr: "High", contractStart: "2024-06-01", contractEnd: "2026-05-31", onboardedDaysAgo: 350, accessToNetwork: false, cloud: true, accessToData: true, pii: false },
      { code: "VEN003", name: "Cloudflare Inc", contactEmail: "enterprise@cloudflare.example", contactPhone: "+1-415-555-0123", amUserName: "sentinel.am2", serviceCategory: "Cybersecurity", status: "Onboarding", vrr: "High" },
      { code: "VEN004", name: "PwC Advisory", contactEmail: "advisory@pwc.example", contactPhone: "+1-646-555-0166", amUserName: "sentinel.am2", serviceCategory: "Consulting", status: "Inactive", vrr: "Moderate" },
    ],
    assessments: [
      { code: "ASM-SEN-001", vendorCode: "VEN001", type: "Onboarding Assessment", status: "Approved", initiatedBy: "sentinel.admin", assessor: "sentinel.assessor", approver: "sentinel.approver", result: "Satisfactory", daysAgo: 100 },
      { code: "ASM-SEN-002", vendorCode: "VEN002", type: "Periodic Assessment", status: "In-Progress(approver)", initiatedBy: "sentinel.admin", assessor: "sentinel.assessor", approver: "sentinel.approver", daysAgo: 30 },
      { code: "ASM-SEN-003", vendorCode: "VEN003", type: "Onboarding Assessment", status: "Submitted", initiatedBy: "sentinel.rm", daysAgo: 3 },
      { code: "ASM-SEN-004", vendorCode: "VEN004", type: "On-Demand Assessment", status: "Draft", initiatedBy: "sentinel.admin", daysAgo: 1 },
    ],
  },
  {
    code: "GRC_103",
    name: "Nimbus Cloud Co",
    isGrcAdded: false,
    admin: { userName: "nimbus.admin", email: "admin@nimbus.example", fullName: "Jordan Lee", role: "CustomerAdministrator" },
    staff: [
      { userName: "nimbus.assessor", email: "assessor@nimbus.example", fullName: "Ravi Nair", role: "TPRMAssessor", tprmRole: "Assessor" },
      { userName: "nimbus.approver", email: "approver@nimbus.example", fullName: "Beatrice Lin", role: "TPRMApprover", tprmRole: "Approver" },
      { userName: "nimbus.bo", email: "bo@nimbus.example", fullName: "Theo Andersson", role: "BusinessOwner", tprmRole: "BusinessOwner" },
    ],
    accountManagers: [
      { userName: "nimbus.am1", email: "am1@vendors.nimbus.example", fullName: "Camila Vega", role: "AccountManager", tprmRole: "Account Manager" },
    ],
    plan: { maxFrameworks: 3, maxAccounts: 10, assessmentLimit: 25, vendorLimit: 15 },
    serviceCategories: COMMON_SERVICE_CATEGORIES.slice(0, 4),
    disciplines: COMMON_DISCIPLINES.slice(0, 3),
    domains: COMMON_DOMAINS.slice(0, 4),
    vendors: [
      { code: "VEN001", name: "Datadog Inc", contactEmail: "enterprise@datadog.example", contactPhone: "+1-866-329-4466", amUserName: "nimbus.am1", serviceCategory: "Cloud Infrastructure", status: "Active", vrr: "Moderate", contractStart: "2025-04-01", contractEnd: "2026-03-31", onboardedDaysAgo: 60, cloud: true, accessToData: true },
      { code: "VEN002", name: "Snyk Ltd", contactEmail: "sales@snyk.example", contactPhone: "+1-833-555-0144", amUserName: "nimbus.am1", serviceCategory: "Cybersecurity", status: "Onboarding", vrr: "Low" },
      { code: "VEN003", name: "Stripe Payments", contactEmail: "support@stripe.example", contactPhone: "+1-888-555-0177", amUserName: "nimbus.am1", serviceCategory: "IT Services", status: "Inactive", vrr: "High" },
    ],
    assessments: [
      { code: "ASM-NIM-001", vendorCode: "VEN001", type: "Onboarding Assessment", status: "Reviewed", initiatedBy: "nimbus.admin", assessor: "nimbus.assessor", result: "Satisfactory", daysAgo: 50 },
      { code: "ASM-NIM-002", vendorCode: "VEN002", type: "Onboarding Assessment", status: "In-Progress", initiatedBy: "nimbus.admin", daysAgo: 4 },
      { code: "ASM-NIM-003", vendorCode: "VEN003", type: "On-Demand Assessment", status: "Returned", initiatedBy: "nimbus.admin", assessor: "nimbus.assessor", approver: "nimbus.approver", daysAgo: 15 },
    ],
  },
];

async function main() {
  console.log("Seeding TPRM customer accounts (extended)...");

  const password = await bcrypt.hash("1", 10);

  // ─── 1. Roles ────────────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {};
  for (const r of TPRM_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, isSystem: true },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`  Roles ready (${Object.keys(roleMap).length})`);

  for (const acc of ACCOUNTS) {
    console.log(`\n[${acc.code}] ${acc.name}`);

    // ─── 2. Customer Account ───────────────────────────────────────────────
    let ca = await prisma.customerAccount.findUnique({ where: { code: acc.code } });
    if (!ca) {
      ca = await prisma.customerAccount.create({
        data: {
          code: acc.code,
          name: acc.name,
          isActive: true,
          isGrcAdded: acc.isGrcAdded,
          isTprmAdded: true,
        },
      });
      console.log(`  Account created`);
    } else {
      console.log(`  Account exists (id=${ca.id})`);
    }

    // ─── 3. Subscription Plan (legacy table — drives in-app limits) ────────
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: { customerAccountId: ca.id, moduleCode: "TPRM" },
    });
    if (!existingPlan) {
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
      console.log(`  Subscription plan created`);
    }

    // ─── 3b. Subscription + ModuleSubscription (module access gate) ────────
    // Required by getAccessSnapshot() — without this the layout gate sends
    // every login to /subscription-required even though the legacy
    // SubscriptionPlan row above exists. Idempotent: skips already-active rows.
    const enabledModules: ModuleCode[] = ["TPRM"];
    if (acc.isGrcAdded) enabledModules.push("GRC");
    const subResult = await ensureComplimentarySubscription(ca.id, enabledModules);
    console.log(`  Module access ensured: [${subResult.ensured.join(", ") || "all already active"}]`);

    // ─── 4. Users ──────────────────────────────────────────────────────────
    const userIdByUserName: Record<string, string> = {};
    const allUsers: UserSpec[] = [acc.admin, ...acc.staff, ...acc.accountManagers];
    for (const u of allUsers) {
      const [firstName, ...rest] = u.fullName.split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      const existingUser = await prisma.user.findFirst({ where: { userName: u.userName } });
      const user = existingUser
        ? existingUser
        : await prisma.user.create({
            data: {
              userId: `USR-${acc.code}-${u.userName.toUpperCase()}`,
              userName: u.userName,
              email: u.email,
              password,
              firstName,
              lastName,
              fullName: u.fullName,
              role: u.role,
              tprmRole: u.tprmRole ?? null,
              tprmFunctionCategory: u.tprmRole === "Account Manager" ? "TPRM Team" : null,
              customerCode: acc.code,
              customerAccountId: ca.id,
              isActive: true,
              isBlocked: false,
              language: "en-US",
              timezone: "Asia/Qatar",
            },
          });
      userIdByUserName[u.userName] = user.id;
      const link = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: roleMap[u.role], moduleCode: "TPRM" },
      });
      if (!link) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: roleMap[u.role], moduleCode: "TPRM" },
        });
      }
    }
    console.log(`  Users: ${allUsers.length} (${acc.staff.length} staff + ${acc.accountManagers.length} AMs + 1 admin)`);

    // ─── 5. TPRMConfiguration (defaults) ───────────────────────────────────
    await prisma.tPRMConfiguration.upsert({
      where: { customerAccountId: ca.id },
      update: {},
      create: { customerAccountId: ca.id },
    });

    // ─── 6. Service Categories ─────────────────────────────────────────────
    for (const cat of acc.serviceCategories) {
      await prisma.tPRMServiceCategory.upsert({
        where: { customerAccountId_name: { customerAccountId: ca.id, name: cat } },
        update: {},
        create: { customerAccountId: ca.id, name: cat },
      });
    }

    // ─── 7. Disciplines ────────────────────────────────────────────────────
    for (const d of acc.disciplines) {
      const exists = await prisma.tPRMDiscipline.findFirst({ where: { customerAccountId: ca.id, name: d } });
      if (!exists) {
        await prisma.tPRMDiscipline.create({ data: { customerAccountId: ca.id, name: d } });
      }
    }

    // ─── 8. Domains ────────────────────────────────────────────────────────
    const domainIdByName: Record<string, string> = {};
    for (let i = 0; i < acc.domains.length; i++) {
      const name = acc.domains[i];
      const dom = await prisma.tPRMDomain.upsert({
        where: { customerAccountId_name: { customerAccountId: ca.id, name } },
        update: {},
        create: { customerAccountId: ca.id, name, sortOrder: i },
      });
      domainIdByName[name] = dom.id;
    }

    // ─── 9. Onboarding Questions ───────────────────────────────────────────
    for (let i = 0; i < COMMON_ONBOARDING_QUESTIONS.length; i++) {
      const q = COMMON_ONBOARDING_QUESTIONS[i];
      const exists = await prisma.tPRMOnboardingQuestion.findFirst({
        where: { customerAccountId: ca.id, title: q.title },
      });
      if (!exists) {
        await prisma.tPRMOnboardingQuestion.create({
          data: {
            customerAccountId: ca.id,
            title: q.title,
            question: q.question,
            score: q.score,
            responseType: "Yes/No",
            sortOrder: i,
          },
        });
      }
    }

    // ─── 10. Master Questions ──────────────────────────────────────────────
    const masterQuestions: { id: string; text: string }[] = [];
    for (let i = 0; i < COMMON_MASTER_QUESTIONS.length; i++) {
      const q = COMMON_MASTER_QUESTIONS[i];
      const domainId = domainIdByName[q.domain];
      if (!domainId) continue; // domain not in this account's subset
      const exists = await prisma.tPRMMasterQuestion.findFirst({
        where: { customerAccountId: ca.id, questionText: q.text },
      });
      const mq = exists
        ? exists
        : await prisma.tPRMMasterQuestion.create({
            data: {
              customerAccountId: ca.id,
              domainId,
              questionText: q.text,
              severity: q.severity,
              sortOrder: i,
            },
          });
      masterQuestions.push({ id: mq.id, text: mq.questionText });
    }

    // ─── 11. Questionnaire Template ────────────────────────────────────────
    const templateName = "Standard Vendor Assessment";
    let tpl = await prisma.tPRMQuestionnaireTemplate.findFirst({
      where: { customerAccountId: ca.id, templateName },
    });
    if (!tpl) {
      tpl = await prisma.tPRMQuestionnaireTemplate.create({
        data: {
          customerAccountId: ca.id,
          templateName,
          templateCategory: "Default",
          frameworkName: "Custom",
          isActive: true,
        },
      });
    }
    for (let i = 0; i < masterQuestions.length; i++) {
      const mq = masterQuestions[i];
      const linkExists = await prisma.tPRMQuestionnaireQuestion.findFirst({
        where: { templateId: tpl.id, questionId: mq.id },
      });
      if (!linkExists) {
        await prisma.tPRMQuestionnaireQuestion.create({
          data: {
            customerAccountId: ca.id,
            templateId: tpl.id,
            questionId: mq.id,
            sortOrder: i,
          },
        });
      }
    }

    console.log(`  Configuration: ${acc.serviceCategories.length} categories, ${acc.domains.length} domains, ${COMMON_ONBOARDING_QUESTIONS.length} onboarding qs, ${masterQuestions.length} master qs in template`);

    // ─── 12. Vendors ───────────────────────────────────────────────────────
    const vendorIdByCode: Record<string, string> = {};
    for (const v of acc.vendors) {
      const amUser = allUsers.find((u) => u.userName === v.amUserName);
      const existing = await prisma.tPRMVendor.findFirst({
        where: { customerAccountId: ca.id, vendorCode: { startsWith: v.code } },
      });
      if (existing) {
        vendorIdByCode[v.code] = existing.id;
        continue;
      }
      const onboarded = v.onboardedDaysAgo
        ? new Date(Date.now() - v.onboardedDaysAgo * 24 * 60 * 60 * 1000)
        : null;
      const vendor = await prisma.tPRMVendor.create({
        data: {
          customerAccountId: ca.id,
          vendorCode: `${v.code}.1`,
          engagementId: `${v.code}.1`,
          name: v.name,
          contactEmail: v.contactEmail,
          contactPhone: v.contactPhone,
          accountManagerName: amUser?.fullName ?? null,
          accountManagerEmail: amUser?.email ?? null,
          serviceCategory: v.serviceCategory,
          status: v.status,
          vrr: v.vrr,
          contractStartDate: v.contractStart ? new Date(v.contractStart) : null,
          contractEndDate: v.contractEnd ? new Date(v.contractEnd) : null,
          onboardedDate: onboarded,
          accessToNetwork: v.accessToNetwork ?? false,
          cloud: v.cloud ?? false,
          accessToData: v.accessToData ?? false,
          pii: v.pii ?? false,
        },
      });
      vendorIdByCode[v.code] = vendor.id;
    }
    console.log(`  Vendors: ${acc.vendors.length}`);

    // ─── 13. Assessments ───────────────────────────────────────────────────
    let createdAssessments = 0;
    for (const a of acc.assessments) {
      const vendorId = vendorIdByCode[a.vendorCode];
      if (!vendorId) continue;
      const exists = await prisma.tPRMAssessment.findFirst({
        where: { customerAccountId: ca.id, assessmentCode: a.code },
      });
      if (exists) continue;

      const submissionDate = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1000);
      const isFinal = a.status === "Approved" || a.status === "Reviewed";
      await prisma.tPRMAssessment.create({
        data: {
          customerAccountId: ca.id,
          assessmentCode: a.code,
          vendorId,
          assessmentType: a.type,
          status: a.status,
          assessmentResult: a.result ?? null,
          initiatedById: userIdByUserName[a.initiatedBy] ?? null,
          assessorId: a.assessor ? userIdByUserName[a.assessor] ?? null : null,
          approverId: a.approver ? userIdByUserName[a.approver] ?? null : null,
          questionnaireTemplate: templateName,
          vendorSubmissionDate: submissionDate,
          assessorCompletionDate: isFinal ? new Date(submissionDate.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
          approvalDate: a.status === "Approved" ? new Date(submissionDate.getTime() + 8 * 24 * 60 * 60 * 1000) : null,
          completionDate: isFinal ? new Date(submissionDate.getTime() + 8 * 24 * 60 * 60 * 1000) : null,
          approverComment: a.status === "Returned" ? "Please clarify the encryption controls and resubmit." : null,
          dueDate: new Date(submissionDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        },
      });
      createdAssessments++;
    }
    console.log(`  Assessments: ${createdAssessments} created (${acc.assessments.length} total spec'd)`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
