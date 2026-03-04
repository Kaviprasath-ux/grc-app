import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedEmailTemplates } from "./seed-email-templates";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Hash passwords upfront
  const hashedPassword1 = await bcrypt.hash("1", 10);
  const hashedPasswordBaarez = await bcrypt.hash("Baarez@2025", 10);

  // ==================== CUSTOMER ACCOUNT (MULTI-TENANT) ====================

  // Create default CustomerAccount for all seeded data
  const defaultCustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "GRC_001" },
    update: {},
    create: {
      id: "customer-account-1",
      code: "GRC_001",
      name: "Baarez Technology Solutions",
      isActive: true,
    },
  });
  console.log("✅ Customer Account created");

  // Store customerAccountId for use in all entity creations
  const customerAccountId = defaultCustomerAccount.id;

  // Create CustomerAccount for GRC Administrator (for GRC Admin data isolation)
  const grcAdminCustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "GRC_ADMIN_001" },
    update: {},
    create: {
      id: "grc-admin-account-1",
      code: "GRC_ADMIN_001",
      name: "GRC Administrator Account",
      isActive: true,
    },
  });
  console.log("✅ GRC Admin Customer Account created");
  const grcAdminCustomerAccountId = grcAdminCustomerAccount.id;

  // Create Second CustomerAccount for testing GRC Admin data isolation
  const grcAdmin2CustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "GRC_ADMIN_002" },
    update: {},
    create: {
      id: "grc-admin-account-2",
      code: "GRC_ADMIN_002",
      name: "GRC Administrator 2 Account",
      isActive: true,
    },
  });
  console.log("✅ GRC Admin 2 Customer Account created");
  const grcAdmin2CustomerAccountId = grcAdmin2CustomerAccount.id;

  // ==================== ORGANIZATION MODULE ====================

  // Create Organization with complete profile data
  const organization = await prisma.organization.upsert({
    where: { id: "org-1" },
    update: {
      customerAccountId,
      email: "info@baarez.com",
      phone: "+974 4444 1234",
      logo: "/uploads/baarez-logo.png",
      value: "We believe in integrity, innovation, and excellence. Our core values drive us to deliver the highest quality solutions while maintaining ethical business practices and fostering continuous improvement.",
      ceoMessage: "Welcome to Baarez Technology Solutions. Our commitment to excellence in GRC solutions has made us a trusted partner for organizations worldwide. We continue to innovate and expand our offerings to meet the evolving needs of our clients in an increasingly complex regulatory landscape.",
      facebook: "https://facebook.com/baareztechnology",
      youtube: "https://youtube.com/@baareztechnology",
      twitter: "https://twitter.com/baareztechnology",
      linkedin: "https://linkedin.com/company/baarez-technology-solutions",
      brochure: "/uploads/baarez-brochure.pdf",
    },
    create: {
      id: "org-1",
      customerAccountId,
      name: "Baarez Technology Solutions",
      email: "info@baarez.com",
      phone: "+974 4444 1234",
      logo: "/uploads/baarez-logo.png",
      establishedDate: "09/08/2017",
      employeeCount: 80,
      branchCount: 2,
      headOfficeLocation: "Doha, Qatar",
      headOfficeAddress: "Office No.15, 2nd Floor, Building no. 226, Street No 230, C-Ring Road",
      website: "https://www.baarez.com",
      description: "Founded in 2017, Baarez Technology Solutions is a leading technology company specializing in GRC solutions and digital transformation services. We help organizations navigate complex regulatory requirements and build robust governance frameworks.",
      vision: "To become the preferred Technology partner for organizations seeking innovative GRC solutions that drive sustainable growth and ensure regulatory compliance.",
      mission: "At Baarez Technology Solutions, we are committed to delivering cutting-edge technology solutions that help organizations manage their governance, risk, and compliance needs effectively while fostering a culture of continuous improvement.",
      value: "We believe in integrity, innovation, and excellence. Our core values drive us to deliver the highest quality solutions while maintaining ethical business practices and fostering continuous improvement.",
      ceoMessage: "Welcome to Baarez Technology Solutions. Our commitment to excellence in GRC solutions has made us a trusted partner for organizations worldwide. We continue to innovate and expand our offerings to meet the evolving needs of our clients in an increasingly complex regulatory landscape.",
      facebook: "https://facebook.com/baareztechnology",
      youtube: "https://youtube.com/@baareztechnology",
      twitter: "https://twitter.com/baareztechnology",
      linkedin: "https://linkedin.com/company/baarez-technology-solutions",
      brochure: "/uploads/baarez-brochure.pdf",
    },
  });

  // Create Branch Offices
  await prisma.branch.deleteMany({ where: { organizationId: organization.id } });
  const branches = [
    { location: "Dubai, UAE", address: "Dubai Internet City, Building 1, Office 301, Sheikh Zayed Road" },
    { location: "Riyadh, Saudi Arabia", address: "King Fahd Road, Al Olaya District, Tower 5, Floor 12" },
    { location: "Mumbai, India", address: "Bandra Kurla Complex, One BKC, Tower A, 15th Floor" },
  ];
  for (const branch of branches) {
    await prisma.branch.create({
      data: {
        location: branch.location,
        address: branch.address,
        organizationId: organization.id,
      },
    });
  }
  console.log("✅ Branch offices created");

  // Create Data Centers
  await prisma.dataCenter.deleteMany({ where: { organizationId: organization.id } });
  const dataCenters = [
    { locationType: "On-Prem", address: "Doha Primary Data Center, West Bay, Building 45" },
    { locationType: "Outsourced", vendor: "Microsoft Azure (Qatar Region)" },
    { locationType: "Outsourced", vendor: "Amazon Web Services (Bahrain Region)" },
  ];
  for (const dc of dataCenters) {
    await prisma.dataCenter.create({
      data: {
        locationType: dc.locationType,
        address: dc.address || null,
        vendor: dc.vendor || null,
        organizationId: organization.id,
      },
    });
  }
  console.log("✅ Data centers created");

  // Create Cloud Providers
  await prisma.cloudProvider.deleteMany({ where: { organizationId: organization.id } });
  const cloudProviders = [
    { name: "Microsoft Azure", serviceType: "IaaS" },
    { name: "Amazon Web Services", serviceType: "PaaS" },
    { name: "Google Cloud Platform", serviceType: "SaaS" },
    { name: "Salesforce", serviceType: "SaaS" },
  ];
  for (const cp of cloudProviders) {
    await prisma.cloudProvider.create({
      data: {
        name: cp.name,
        serviceType: cp.serviceType,
        organizationId: organization.id,
      },
    });
  }
  console.log("✅ Cloud providers created");

  // Create Departments
  const departments = [
    "Human Resources",
    "Revenue",
    "IT Operations",
    "IT Support",
    "Product Development",
    "Compliance",
    "Procurement",
    "Operations",
    "Risk Management",
    "Quality Assurance",
    "Internal Audit",
  ];

  const createdDepts: { [key: string]: string } = {};
  for (const name of departments) {
    // Use findFirst to check if department exists for this customer
    const existing = await prisma.department.findFirst({
      where: { customerAccountId, name },
    });
    if (existing) {
      createdDepts[name] = existing.id;
    } else {
      const dept = await prisma.department.create({
        data: { customerAccountId, name },
      });
      createdDepts[name] = dept.id;
    }
  }
  console.log("✅ Departments created");

  // Create Users
  const users = [
    { userId: "USR-001", userName: "bts.admin", email: "admin@baarez.com", firstName: "BTS", lastName: "Admin", department: "IT Operations", designation: "System Administrator", role: "Administrator", function: "Security" },
    { userId: "USR-002", userName: "john.doe", email: "john.doe@baarez.com", firstName: "John", lastName: "Doe", department: "Compliance", designation: "Compliance Manager", role: "GRC Admin", function: "Audit" },
    { userId: "USR-003", userName: "sarah.smith", email: "sarah.smith@baarez.com", firstName: "Sarah", lastName: "Smith", department: "Internal Audit", designation: "Lead Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-004", userName: "mike.wilson", email: "mike.wilson@baarez.com", firstName: "Mike", lastName: "Wilson", department: "Risk Management", designation: "Risk Analyst", role: "Risk Manager", function: "Security" },
    { userId: "USR-005", userName: "Gauri", email: "gauri@baarez.com", firstName: "Gauri", lastName: "S", department: "Human Resources", designation: "HR Manager", role: "User", function: "Business" },
    { userId: "USR-006", userName: "david.jones", email: "david.jones@baarez.com", firstName: "David", lastName: "Jones", department: "IT Support", designation: "Support Specialist", role: "User", function: "Security" },
    { userId: "USR-007", userName: "lisa.taylor", email: "lisa.taylor@baarez.com", firstName: "Lisa", lastName: "Taylor", department: "Product Development", designation: "Product Manager", role: "User", function: "Business" },
    { userId: "USR-008", userName: "james.anderson", email: "james.anderson@baarez.com", firstName: "James", lastName: "Anderson", department: "Revenue", designation: "Sales Director", role: "User", function: "Business" },
    { userId: "USR-009", userName: "deepika.kumar", email: "deepika.kumar@baarez.com", firstName: "Deepika", lastName: "K", department: "Internal Audit", designation: "Senior Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-010", userName: "anamika.sharma", email: "anamika.sharma@baarez.com", firstName: "Anamika", lastName: "Sharma", department: "Internal Audit", designation: "Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-011", userName: "abhishek", email: "abhishek@baarez.com", firstName: "Abhishek", lastName: "R", department: "Internal Audit", designation: "Audit Head", role: "AuditHead", function: "Audit" },
    { userId: "USR-012", userName: "kudiarasan.tdev", email: "kudiarasan.t@baarez.com", firstName: "Kudiarasan", lastName: "T", department: "Internal Audit", designation: "Lead Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-013", userName: "prakash.loganathan", email: "prakash.l@baarez.com", firstName: "Prakash", lastName: "L", department: "Internal Audit", designation: "IT Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-014", userName: "navita.singh", email: "navita.singh@baarez.com", firstName: "Navita", lastName: "S", department: "Internal Audit", designation: "Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-015", userName: "avinash.kumar", email: "avinash.kumar@baarez.com", firstName: "Avinash", lastName: "Kumar", department: "Internal Audit", designation: "Junior Auditor", role: "Auditor", function: "Audit" },
    { userId: "USR-016", userName: "auditm", email: "auditm@baarez.com", firstName: "Audit", lastName: "Manager", department: "Internal Audit", designation: "Audit Manager", role: "AuditManager", function: "Audit" },
  ];

  const createdUsers: { [key: string]: string } = {};
  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        customerAccountId, // Update existing users with customer account
        password: hashedPassword1, // Ensure password is updated for existing users
      },
      create: {
        customerAccountId,
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        password: hashedPassword1,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        designation: user.designation,
        role: user.role,
        function: user.function,
        departmentId: createdDepts[user.department],
      },
    });
    createdUsers[user.userName] = created.id;
  }
  console.log("✅ Users created");

  // Create RBAC Roles
  const roleDefinitions = [
    { name: "GRCAdministrator", description: "Full system access, all modules, all data", isSystem: true },
    { name: "CustomerAdministrator", description: "Organization-level admin, manages users and settings", isSystem: true },
    { name: "AuditHead", description: "Full access to Internal Audit module, all audit data", isSystem: true },
    { name: "AuditManager", description: "Manages audits, assigns auditors, reviews findings", isSystem: true },
    { name: "AuditUser", description: "Basic audit module access", isSystem: true },
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
    { name: "BusinessOwner", description: "Business Owner role in TPRM, manages relationship managers and vendor assessments", isSystem: true },
    { name: "RelationshipManager", description: "Relationship Manager role in TPRM, manages vendor relationships", isSystem: true },
    { name: "TPRMAssessor", description: "Assessor role in TPRM, performs vendor assessments and reviews task queue", isSystem: true },
    { name: "TPRMApprover", description: "Approver role in TPRM, reviews and approves vendor assessments", isSystem: true },
    { name: "TPRMAuditor", description: "Auditor role in TPRM, audits vendor assessments and compliance", isSystem: true },
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

  // Assign roles to users based on their role field
  const roleMapping: { [key: string]: string } = {
    "Administrator": "CustomerAdministrator",
    "GRC Admin": "GRCAdministrator",
    "AuditHead": "AuditHead",
    "AuditManager": "AuditManager",
    "Auditor": "Auditor",
    "Risk Manager": "Contributor",
    "User": "Contributor",
  };

  for (const user of users) {
    const rbacRoleName = roleMapping[user.role] || "Contributor";
    const roleId = createdRoles[rbacRoleName];

    if (roleId) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: createdUsers[user.userName],
            roleId: roleId,
          },
        },
        update: {},
        create: {
          userId: createdUsers[user.userName],
          roleId: roleId,
        },
      });
    }
  }
  console.log("✅ User roles assigned");

  // Create Superadmin user (GRCAdministrator) with their own CustomerAccount for data isolation
  const superadminUser = await prisma.user.upsert({
    where: { userId: "SUPERADMIN-001" },
    update: {
      customerAccountId: grcAdminCustomerAccountId, // Ensure existing superadmin gets the account
      password: hashedPasswordBaarez, // Ensure password is updated for existing users
    },
    create: {
      userId: "SUPERADMIN-001",
      userName: "superadmin",
      email: "superadmin@baarez.com",
      password: hashedPasswordBaarez,
      firstName: "Super",
      lastName: "Admin",
      fullName: "Super Admin",
      designation: "System Administrator",
      role: "GRCAdministrator",
      function: "Administration",
      isActive: true,
      isBlocked: false,
      customerAccountId: grcAdminCustomerAccountId, // GRC Admin data isolation
    },
  });

  // Assign GRCAdministrator role to superadmin
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superadminUser.id,
        roleId: createdRoles["GRCAdministrator"],
      },
    },
    update: {},
    create: {
      userId: superadminUser.id,
      roleId: createdRoles["GRCAdministrator"],
    },
  });
  console.log("✅ Superadmin user created (superadmin / Baarez@2025)");

  // Create Second GRC Admin user for testing data isolation
  const grcAdmin2User = await prisma.user.upsert({
    where: { userId: "GRCADMIN2-001" },
    update: {
      customerAccountId: grcAdmin2CustomerAccountId,
      password: hashedPasswordBaarez, // Ensure password is updated for existing users
    },
    create: {
      userId: "GRCADMIN2-001",
      userName: "grcadmin2",
      email: "grcadmin2@baarez.com",
      password: hashedPasswordBaarez,
      firstName: "GRC",
      lastName: "Admin2",
      fullName: "GRC Admin 2",
      designation: "GRC Administrator",
      role: "GRCAdministrator",
      function: "Administration",
      isActive: true,
      isBlocked: false,
      customerAccountId: grcAdmin2CustomerAccountId,
    },
  });

  // Assign GRCAdministrator role to grcadmin2
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: grcAdmin2User.id,
        roleId: createdRoles["GRCAdministrator"],
      },
    },
    update: {},
    create: {
      userId: grcAdmin2User.id,
      roleId: createdRoles["GRCAdministrator"],
    },
  });
  console.log("✅ GRC Admin 2 user created (grcadmin2 / Baarez@2025)");

  // Create TPRM Admin user (CustomerAdministrator with TPRM access)
  const tprmAdminCustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "TPRM_ADMIN_001" },
    update: { isTprmAdded: true },
    create: {
      id: "tprm-admin-account-1",
      code: "TPRM_ADMIN_001",
      name: "TPRM Admin Account",
      isActive: true,
      isGrcAdded: false,
      isTprmAdded: true,
    },
  });
  const tprmAdminCustomerAccountId = tprmAdminCustomerAccount.id;

  const tadmUser = await prisma.user.upsert({
    where: { userId: "TADM-001" },
    update: {
      customerAccountId: tprmAdminCustomerAccountId,
      password: hashedPasswordBaarez,
    },
    create: {
      userId: "TADM-001",
      userName: "tadm",
      email: "tadm@baarez.com",
      password: hashedPasswordBaarez,
      firstName: "TPRM",
      lastName: "Admin",
      fullName: "TPRM Admin",
      designation: "TPRM Administrator",
      role: "CustomerAdministrator",
      function: "Administration",
      isActive: true,
      isBlocked: false,
      customerAccountId: tprmAdminCustomerAccountId,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: tadmUser.id,
        roleId: createdRoles["CustomerAdministrator"],
      },
    },
    update: {},
    create: {
      userId: tadmUser.id,
      roleId: createdRoles["CustomerAdministrator"],
    },
  });
  console.log("✅ TPRM Admin user created (tadm / Baarez@2025)");

  // Create Stakeholders
  const stakeholders = [
    { name: "John Smith", email: "john.smith@example.com", type: "Internal", status: "Active" },
    { name: "Sarah Johnson", email: "sarah.j@partner.com", type: "External", status: "Active" },
    { name: "Mike Williams", email: "mike.w@vendor.com", type: "Third Party", status: "Active" },
    { name: "Emily Davis", email: "emily.d@baarez.com", type: "Internal", status: "Active" },
    { name: "Robert Brown", email: "robert.b@consultant.com", type: "External", status: "Active" },
    { name: "Jennifer Wilson", email: "jennifer.w@baarez.com", type: "Internal", status: "Inactive" },
    { name: "David Taylor", email: "david.t@partner.com", type: "Third Party", status: "Active" },
  ];

  for (const stakeholder of stakeholders) {
    await prisma.stakeholder.create({ data: { customerAccountId, ...stakeholder } });
  }
  console.log("✅ Stakeholders created");

  // Create Issues
  const issues = [
    { title: "Data Privacy Compliance Gap", department: "IT Operations", domain: "IT", category: "Data breach", status: "Open", dueDate: "2025-03-15" },
    { title: "Employee Training Delay", department: "Human Resources", domain: "Internal", category: "Human Resources", status: "In Progress", dueDate: "2025-02-28" },
    { title: "Budget Allocation Issue", department: "Revenue", domain: "Internal", category: "Finance", status: "Open", dueDate: "2025-04-01" },
    { title: "Third-Party Vendor Risk", department: "Procurement", domain: "External", category: "Finance", status: "Pending", dueDate: "2025-03-20" },
    { title: "System Downtime Incident", department: "IT Operations", domain: "IT", category: "Data breach", status: "Resolved", dueDate: "2025-02-15" },
    { title: "Access Control Weakness", department: "IT Operations", domain: "IT", category: "Data breach", status: "Open", dueDate: "2025-03-30" },
    { title: "Policy Update Required", department: "Compliance", domain: "GRC", category: "Finance", status: "In Progress", dueDate: "2025-04-15" },
    { title: "Recruitment Process Delay", department: "Human Resources", domain: "Internal", category: "Human Resources", status: "Open", dueDate: "2025-03-10" },
  ];

  for (const issue of issues) {
    await prisma.issue.create({
      data: {
        customerAccountId,
        title: issue.title,
        domain: issue.domain,
        category: issue.category,
        status: issue.status,
        dueDate: new Date(issue.dueDate),
        departmentId: createdDepts[issue.department],
      },
    });
  }
  console.log("✅ Issues created");

  // Create Services
  const services = [
    { title: "GRC Consulting", description: "Comprehensive GRC consulting services", serviceUser: "External", serviceCategory: "consulting", serviceItem: "Advisory" },
    { title: "Technology Solutions", description: "Custom technology solutions for enterprise", serviceUser: "External", serviceCategory: "Telecom", serviceItem: "Internet" },
    { title: "Internal Training", description: "Employee training and development programs", serviceUser: "Internal", serviceCategory: "consulting", serviceItem: "Advisory" },
  ];

  for (const service of services) {
    await prisma.service.create({ data: { customerAccountId, ...service } });
  }
  console.log("✅ Services created");

  // ==================== COMPLIANCE MODULE ====================

  // Create Frameworks with comprehensive realistic data
  const frameworks = [
    {
      name: "ISO 27001:2022",
      description: "ISO/IEC 27001:2022 is the international standard for information security management systems (ISMS). It provides a systematic approach to managing sensitive company information, ensuring it remains secure through risk management processes.",
      version: "2022",
      type: "Standard",
      status: "Subscribed",
      country: "International",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 78.5,
      policyPercentage: 85.0,
      evidencePercentage: 72.3,
    },
    {
      name: "SOC 2 Type II",
      description: "SOC 2 (Service Organization Control 2) is a compliance framework developed by the AICPA for service organizations. It focuses on five Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy.",
      version: "2017",
      type: "Framework",
      status: "Subscribed",
      country: "United States",
      industry: "Technology & Services",
      isCustom: false,
      compliancePercentage: 82.0,
      policyPercentage: 90.0,
      evidencePercentage: 75.0,
    },
    {
      name: "GDPR",
      description: "The General Data Protection Regulation is a comprehensive data privacy regulation in EU law. It regulates the processing of personal data of individuals in the European Union and European Economic Area.",
      version: "2018",
      type: "Regulation",
      status: "Subscribed",
      country: "European Union",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 88.0,
      policyPercentage: 95.0,
      evidencePercentage: 80.0,
    },
    {
      name: "PCI DSS v4.0",
      description: "Payment Card Industry Data Security Standard is a set of security standards designed to ensure that all companies that accept, process, store, or transmit credit card information maintain a secure environment.",
      version: "4.0",
      type: "Standard",
      status: "Subscribed",
      country: "International",
      industry: "Financial Services & Retail",
      isCustom: false,
      compliancePercentage: 65.0,
      policyPercentage: 70.0,
      evidencePercentage: 60.0,
    },
    {
      name: "HIPAA",
      description: "Health Insurance Portability and Accountability Act establishes national standards for the protection of sensitive patient health information. It applies to covered entities and their business associates.",
      version: "2013",
      type: "Regulation",
      status: "Subscribed",
      country: "United States",
      industry: "Healthcare",
      isCustom: false,
      compliancePercentage: 72.0,
      policyPercentage: 78.0,
      evidencePercentage: 68.0,
    },
    {
      name: "NIST CSF 2.0",
      description: "NIST Cybersecurity Framework provides a policy framework of computer security guidance for how private sector organizations can assess and improve their ability to prevent, detect, and respond to cyber attacks.",
      version: "2.0",
      type: "Framework",
      status: "Subscribed",
      country: "United States",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 58.0,
      policyPercentage: 65.0,
      evidencePercentage: 52.0,
    },
    {
      name: "ISO 27701:2019",
      description: "ISO/IEC 27701 specifies requirements and provides guidance for establishing, implementing, maintaining and continually improving a Privacy Information Management System (PIMS) as an extension to ISO 27001.",
      version: "2019",
      type: "Standard",
      status: "Subscribed",
      country: "International",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 45.0,
      policyPercentage: 55.0,
      evidencePercentage: 40.0,
    },
    {
      name: "NIS2 Directive",
      description: "The Network and Information Security Directive 2 is an EU-wide legislation on cybersecurity. It provides legal measures to boost the overall level of cybersecurity in the EU.",
      version: "2022",
      type: "Regulation",
      status: "Subscribed",
      country: "European Union",
      industry: "Critical Infrastructure",
      isCustom: false,
      compliancePercentage: 35.0,
      policyPercentage: 40.0,
      evidencePercentage: 30.0,
    },
    {
      name: "CIS Controls v8",
      description: "Center for Internet Security Controls are a prioritized set of actions that collectively form a defense-in-depth set of best practices that mitigate the most common attacks against systems and networks.",
      version: "8.0",
      type: "Framework",
      status: "Not Subscribed",
      country: "International",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 0,
      policyPercentage: 0,
      evidencePercentage: 0,
    },
    {
      name: "COBIT 2019",
      description: "Control Objectives for Information and Related Technologies is a framework for the governance and management of enterprise information and technology, aimed at the whole enterprise.",
      version: "2019",
      type: "Framework",
      status: "Not Subscribed",
      country: "International",
      industry: "All Industries",
      isCustom: false,
      compliancePercentage: 0,
      policyPercentage: 0,
      evidencePercentage: 0,
    },
    {
      name: "Qatar NIA",
      description: "Qatar National Information Assurance Policy provides cybersecurity requirements and guidelines for critical national infrastructure and government entities in the State of Qatar.",
      version: "2.0",
      type: "Regulation",
      status: "Subscribed",
      country: "Qatar",
      industry: "Government & Critical Infrastructure",
      isCustom: false,
      compliancePercentage: 55.0,
      policyPercentage: 60.0,
      evidencePercentage: 50.0,
    },
    {
      name: "Custom Security Framework",
      description: "Organization-specific security framework tailored to address unique business requirements, industry-specific threats, and regulatory obligations not covered by standard frameworks.",
      version: "1.0",
      type: "Framework",
      status: "Subscribed",
      country: "Qatar",
      industry: "Technology",
      isCustom: true,
      compliancePercentage: 90.0,
      policyPercentage: 92.0,
      evidencePercentage: 88.0,
    },
  ];

  const createdFrameworks: { [key: string]: string } = {};
  for (const framework of frameworks) {
    // Use findFirst to check if framework exists for this customer
    const existing = await prisma.framework.findFirst({
      where: { customerAccountId, name: framework.name },
    });
    if (existing) {
      // Update existing framework
      await prisma.framework.update({
        where: { id: existing.id },
        data: {
          description: framework.description,
          version: framework.version,
          type: framework.type,
          status: framework.status,
          country: framework.country,
          industry: framework.industry,
          isCustom: framework.isCustom,
          compliancePercentage: framework.compliancePercentage,
          policyPercentage: framework.policyPercentage,
          evidencePercentage: framework.evidencePercentage,
        },
      });
      createdFrameworks[framework.name] = existing.id;
    } else {
      const created = await prisma.framework.create({
        data: { customerAccountId, ...framework },
      });
      createdFrameworks[framework.name] = created.id;
    }
  }
  console.log("✅ Frameworks created (12 comprehensive frameworks)");

  // Create Requirement Categories (Domains/Chapters) for each framework
  const requirementCategories = [
    // ISO 27001:2022 Clauses
    { framework: "ISO 27001:2022", code: "4", name: "Context of the Organization", description: "Understanding the organization and its context, needs and expectations of interested parties", sortOrder: 1 },
    { framework: "ISO 27001:2022", code: "5", name: "Leadership", description: "Leadership and commitment, policy, organizational roles, responsibilities and authorities", sortOrder: 2 },
    { framework: "ISO 27001:2022", code: "6", name: "Planning", description: "Actions to address risks and opportunities, information security objectives", sortOrder: 3 },
    { framework: "ISO 27001:2022", code: "7", name: "Support", description: "Resources, competence, awareness, communication, documented information", sortOrder: 4 },
    { framework: "ISO 27001:2022", code: "8", name: "Operation", description: "Operational planning and control, information security risk assessment and treatment", sortOrder: 5 },
    { framework: "ISO 27001:2022", code: "9", name: "Performance Evaluation", description: "Monitoring, measurement, analysis, evaluation, internal audit, management review", sortOrder: 6 },
    { framework: "ISO 27001:2022", code: "10", name: "Improvement", description: "Nonconformity and corrective action, continual improvement", sortOrder: 7 },
    { framework: "ISO 27001:2022", code: "A.5", name: "Organizational Controls", description: "Policies, roles, responsibilities, segregation of duties, management responsibilities", sortOrder: 8 },
    { framework: "ISO 27001:2022", code: "A.6", name: "People Controls", description: "Screening, terms of employment, awareness, disciplinary process", sortOrder: 9 },
    { framework: "ISO 27001:2022", code: "A.7", name: "Physical Controls", description: "Physical security perimeters, entry controls, securing offices, equipment security", sortOrder: 10 },
    { framework: "ISO 27001:2022", code: "A.8", name: "Technological Controls", description: "User endpoint devices, privileged access, information access, source code", sortOrder: 11 },

    // SOC 2 Trust Service Criteria
    { framework: "SOC 2 Type II", code: "CC", name: "Common Criteria", description: "Common criteria related to security that apply to all TSC", sortOrder: 1 },
    { framework: "SOC 2 Type II", code: "A", name: "Availability", description: "The system is available for operation and use as committed or agreed", sortOrder: 2 },
    { framework: "SOC 2 Type II", code: "PI", name: "Processing Integrity", description: "System processing is complete, valid, accurate, timely, and authorized", sortOrder: 3 },
    { framework: "SOC 2 Type II", code: "C", name: "Confidentiality", description: "Information designated as confidential is protected as committed or agreed", sortOrder: 4 },
    { framework: "SOC 2 Type II", code: "P", name: "Privacy", description: "Personal information is collected, used, retained, disclosed, and disposed of properly", sortOrder: 5 },

    // GDPR Chapters
    { framework: "GDPR", code: "II", name: "Principles", description: "Principles relating to processing of personal data", sortOrder: 1 },
    { framework: "GDPR", code: "III", name: "Rights of Data Subject", description: "Transparency, access, rectification, erasure, portability", sortOrder: 2 },
    { framework: "GDPR", code: "IV", name: "Controller and Processor", description: "Obligations of controllers and processors", sortOrder: 3 },
    { framework: "GDPR", code: "V", name: "Transfers to Third Countries", description: "Transfers of personal data to third countries or international organisations", sortOrder: 4 },
    { framework: "GDPR", code: "VI", name: "Supervisory Authorities", description: "Independent supervisory authorities", sortOrder: 5 },
    { framework: "GDPR", code: "VIII", name: "Remedies and Penalties", description: "Remedies, liability and penalties", sortOrder: 6 },

    // PCI DSS Requirements
    { framework: "PCI DSS v4.0", code: "1", name: "Network Security Controls", description: "Install and maintain network security controls", sortOrder: 1 },
    { framework: "PCI DSS v4.0", code: "2", name: "Secure Configurations", description: "Apply secure configurations to all system components", sortOrder: 2 },
    { framework: "PCI DSS v4.0", code: "3", name: "Protect Account Data", description: "Protect stored account data", sortOrder: 3 },
    { framework: "PCI DSS v4.0", code: "4", name: "Cryptography", description: "Protect cardholder data with strong cryptography during transmission", sortOrder: 4 },
    { framework: "PCI DSS v4.0", code: "5", name: "Malware Protection", description: "Protect all systems and networks from malicious software", sortOrder: 5 },
    { framework: "PCI DSS v4.0", code: "6", name: "Secure Development", description: "Develop and maintain secure systems and software", sortOrder: 6 },
    { framework: "PCI DSS v4.0", code: "7", name: "Access Control", description: "Restrict access to system components and cardholder data", sortOrder: 7 },
    { framework: "PCI DSS v4.0", code: "8", name: "User Identification", description: "Identify users and authenticate access", sortOrder: 8 },
    { framework: "PCI DSS v4.0", code: "9", name: "Physical Access", description: "Restrict physical access to cardholder data", sortOrder: 9 },
    { framework: "PCI DSS v4.0", code: "10", name: "Logging and Monitoring", description: "Log and monitor all access to system components", sortOrder: 10 },
    { framework: "PCI DSS v4.0", code: "11", name: "Security Testing", description: "Test security of systems and networks regularly", sortOrder: 11 },
    { framework: "PCI DSS v4.0", code: "12", name: "Information Security Policy", description: "Support information security with organizational policies", sortOrder: 12 },

    // NIST CSF 2.0 Functions
    { framework: "NIST CSF 2.0", code: "GV", name: "Govern", description: "Establish and monitor the organization's cybersecurity risk management strategy", sortOrder: 1 },
    { framework: "NIST CSF 2.0", code: "ID", name: "Identify", description: "Understand the organization's current cybersecurity risks", sortOrder: 2 },
    { framework: "NIST CSF 2.0", code: "PR", name: "Protect", description: "Use safeguards to prevent or reduce cybersecurity risk", sortOrder: 3 },
    { framework: "NIST CSF 2.0", code: "DE", name: "Detect", description: "Find and analyze possible cybersecurity attacks and compromises", sortOrder: 4 },
    { framework: "NIST CSF 2.0", code: "RS", name: "Respond", description: "Take action regarding a detected cybersecurity incident", sortOrder: 5 },
    { framework: "NIST CSF 2.0", code: "RC", name: "Recover", description: "Restore assets and operations affected by a cybersecurity incident", sortOrder: 6 },

    // HIPAA Domains
    { framework: "HIPAA", code: "164.302", name: "Administrative Safeguards", description: "Administrative actions, policies, and procedures to manage the security program", sortOrder: 1 },
    { framework: "HIPAA", code: "164.310", name: "Physical Safeguards", description: "Physical measures, policies, and procedures to protect systems and facilities", sortOrder: 2 },
    { framework: "HIPAA", code: "164.312", name: "Technical Safeguards", description: "Technology and the policy and procedures for its use", sortOrder: 3 },
    { framework: "HIPAA", code: "164.314", name: "Organizational Requirements", description: "Standards for business associate contracts and other arrangements", sortOrder: 4 },
    { framework: "HIPAA", code: "164.316", name: "Policies and Procedures", description: "Documentation requirements for policies and procedures", sortOrder: 5 },
  ];

  const createdCategories: { [key: string]: string } = {};
  for (const category of requirementCategories) {
    const key = `${category.framework}-${category.code}`;
    if (createdFrameworks[category.framework]) {
      // Use findFirst to check if category exists for this customer
      const existing = await prisma.requirementCategory.findFirst({
        where: { customerAccountId, id: key },
      });
      if (existing) {
        createdCategories[key] = existing.id;
      } else {
        const created = await prisma.requirementCategory.create({
          data: {
            id: key,
            customerAccountId,
            code: category.code,
            name: category.name,
            description: category.description,
            sortOrder: category.sortOrder,
            frameworkId: createdFrameworks[category.framework],
          },
        });
        createdCategories[key] = created.id;
      }
    }
  }
  console.log("✅ Requirement Categories created (46 domains/chapters)");

  // Create Requirements for each category
  const requirements = [
    // ==================== ISO 27001:2022 Complete Requirements ====================

    // ISO 27001:2022 Requirements - Context of the Organization (Clause 4)
    { category: "ISO 27001:2022-4", code: "4.1", name: "Understanding the organization and its context", description: "The organization shall determine external and internal issues that are relevant to its purpose and that affect its ability to achieve the intended outcome(s) of its information security management system.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.2", name: "Understanding the needs and expectations of interested parties", description: "The organization shall determine interested parties that are relevant to the information security management system and their requirements relevant to information security.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.3", name: "Determining the scope of the information security management system", description: "The organization shall determine the boundaries and applicability of the information security management system to establish its scope.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.4", name: "Information security management system", description: "The organization shall establish, implement, maintain and continually improve an information security management system, in accordance with the requirements of this document.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // ISO 27001:2022 Requirements - Leadership (Clause 5)
    { category: "ISO 27001:2022-5", code: "5.1", name: "Leadership and commitment", description: "Top management shall demonstrate leadership and commitment with respect to the information security management system by ensuring policies and objectives are established and compatible with strategic direction.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-5", code: "5.2", name: "Policy", description: "Top management shall establish an information security policy that is appropriate to the purpose of the organization, includes commitment to continual improvement, and provides framework for setting objectives.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-5", code: "5.3", name: "Organizational roles, responsibilities and authorities", description: "Top management shall ensure that the responsibilities and authorities for roles relevant to information security are assigned and communicated within the organization.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },

    // ISO 27001:2022 Requirements - Planning (Clause 6)
    { category: "ISO 27001:2022-6", code: "6.1", name: "Actions to address risks and opportunities", description: "When planning for the information security management system, the organization shall consider the issues and requirements and determine the risks and opportunities that need to be addressed.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-6", code: "6.1.1", name: "General risk planning", description: "The organization shall plan actions to address risks and opportunities to ensure the ISMS can achieve intended outcomes and prevent undesired effects.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-6", code: "6.1.2", name: "Information security risk assessment", description: "The organization shall define and apply an information security risk assessment process that establishes and maintains risk criteria.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-6", code: "6.1.3", name: "Information security risk treatment", description: "The organization shall define and apply an information security risk treatment process to select appropriate risk treatment options.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-6", code: "6.2", name: "Information security objectives and planning to achieve them", description: "The organization shall establish information security objectives at relevant functions and levels. The objectives shall be measurable, monitored, communicated, and updated.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-6", code: "6.3", name: "Planning of changes", description: "When the organization determines the need for changes to the information security management system, the changes shall be carried out in a planned manner.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },

    // ISO 27001:2022 Requirements - Support (Clause 7)
    { category: "ISO 27001:2022-7", code: "7.1", name: "Resources", description: "The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the information security management system.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-7", code: "7.2", name: "Competence", description: "The organization shall determine the necessary competence of person(s) doing work under its control that affects its information security performance, and ensure these persons are competent.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-7", code: "7.3", name: "Awareness", description: "Persons doing work under the organization's control shall be aware of the information security policy, their contribution to ISMS effectiveness, and implications of not conforming.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-7", code: "7.4", name: "Communication", description: "The organization shall determine the need for internal and external communications relevant to the information security management system including what, when, with whom, and how to communicate.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },
    { category: "ISO 27001:2022-7", code: "7.5", name: "Documented information", description: "The organization's information security management system shall include documented information required by this document and determined by the organization as being necessary for effectiveness.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-7", code: "7.5.1", name: "General documentation requirements", description: "The ISMS documentation shall include documented information required by this document and that determined by the organization as necessary.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-7", code: "7.5.2", name: "Creating and updating", description: "When creating and updating documented information, the organization shall ensure appropriate identification, format, and review and approval for suitability.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-7", code: "7.5.3", name: "Control of documented information", description: "Documented information shall be controlled to ensure it is available and suitable for use, and adequately protected from loss of confidentiality, improper use, or loss of integrity.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // ISO 27001:2022 Requirements - Operation (Clause 8)
    { category: "ISO 27001:2022-8", code: "8.1", name: "Operational planning and control", description: "The organization shall plan, implement and control the processes needed to meet information security requirements, and to implement the actions determined in clause 6.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-8", code: "8.2", name: "Information security risk assessment", description: "The organization shall perform information security risk assessments at planned intervals or when significant changes are proposed or occur, taking account of established criteria.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-8", code: "8.3", name: "Information security risk treatment", description: "The organization shall implement the information security risk treatment plan and retain documented information of the results of the risk treatment.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // ISO 27001:2022 Requirements - Performance Evaluation (Clause 9)
    { category: "ISO 27001:2022-9", code: "9.1", name: "Monitoring, measurement, analysis and evaluation", description: "The organization shall determine what needs to be monitored and measured, including information security processes and controls, and the methods for monitoring and measurement.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-9", code: "9.2", name: "Internal audit", description: "The organization shall conduct internal audits at planned intervals to provide information on whether the ISMS conforms to requirements and is effectively implemented and maintained.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-9", code: "9.2.1", name: "Internal audit program", description: "The organization shall plan, establish, implement and maintain audit programmes, including frequency, methods, responsibilities, planning requirements and reporting.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-9", code: "9.2.2", name: "Internal audit execution", description: "The organization shall define audit criteria and scope for each audit, select auditors to ensure objectivity, ensure results are reported to relevant management.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-9", code: "9.3", name: "Management review", description: "Top management shall review the organization's information security management system at planned intervals to ensure its continuing suitability, adequacy and effectiveness.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-9", code: "9.3.1", name: "Management review inputs", description: "The management review shall be planned and carried out taking into consideration status of actions, changes in external and internal issues, and feedback on performance.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-9", code: "9.3.2", name: "Management review outputs", description: "The outputs of the management review shall include decisions related to continual improvement opportunities and any needs for changes to the ISMS.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // ISO 27001:2022 Requirements - Improvement (Clause 10)
    { category: "ISO 27001:2022-10", code: "10.1", name: "Continual improvement", description: "The organization shall continually improve the suitability, adequacy and effectiveness of the information security management system.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-10", code: "10.2", name: "Nonconformity and corrective action", description: "When a nonconformity occurs, the organization shall react to the nonconformity, take action to control and correct it, and deal with the consequences.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // SOC 2 Requirements - Common Criteria
    { category: "SOC 2 Type II-CC", code: "CC1.1", name: "COSO Principle 1", description: "The entity demonstrates a commitment to integrity and ethical values", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "SOC 2 Type II-CC", code: "CC1.2", name: "COSO Principle 2", description: "The board of directors demonstrates independence from management", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "SOC 2 Type II-CC", code: "CC2.1", name: "COSO Principle 13", description: "The entity obtains or generates and uses relevant, quality information", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "SOC 2 Type II-CC", code: "CC3.1", name: "COSO Principle 6", description: "The entity specifies objectives with sufficient clarity", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "SOC 2 Type II-CC", code: "CC4.1", name: "COSO Principle 16", description: "The entity selects, develops, and performs ongoing evaluations", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "SOC 2 Type II-CC", code: "CC5.1", name: "COSO Principle 10", description: "The entity selects and develops control activities", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // GDPR Requirements - Principles
    { category: "GDPR-II", code: "Art.5", name: "Principles relating to processing", description: "Lawfulness, fairness, transparency, purpose limitation, data minimisation", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "GDPR-II", code: "Art.6", name: "Lawfulness of processing", description: "Processing shall be lawful only if at least one legal basis applies", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "GDPR-II", code: "Art.7", name: "Conditions for consent", description: "Controller must be able to demonstrate that consent was given", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // GDPR Requirements - Rights of Data Subject
    { category: "GDPR-III", code: "Art.12", name: "Transparent information", description: "Transparent information, communication and modalities for exercising rights", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "GDPR-III", code: "Art.13", name: "Information to be provided", description: "Information to be provided where personal data are collected", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "GDPR-III", code: "Art.15", name: "Right of access", description: "The data subject shall have the right to obtain confirmation of processing", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "GDPR-III", code: "Art.17", name: "Right to erasure", description: "The data subject shall have the right to erasure of personal data", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // PCI DSS Requirements
    { category: "PCI DSS v4.0-1", code: "1.1", name: "Network security controls defined", description: "Processes and mechanisms for installing and maintaining network security controls", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "PCI DSS v4.0-1", code: "1.2", name: "Network security controls configured", description: "Network security controls are configured and maintained", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "PCI DSS v4.0-2", code: "2.1", name: "Secure configuration processes", description: "Processes and mechanisms for applying secure configurations", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "PCI DSS v4.0-3", code: "3.1", name: "Stored account data protection", description: "Processes and mechanisms for protecting stored account data", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },
    { category: "PCI DSS v4.0-3", code: "3.2", name: "Sensitive authentication data", description: "Sensitive authentication data is not stored after authorization", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // NIST CSF Requirements
    { category: "NIST CSF 2.0-GV", code: "GV.OC-01", name: "Organizational Context", description: "The organizational mission is understood and informs cybersecurity risk management", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "NIST CSF 2.0-GV", code: "GV.RM-01", name: "Risk Management Strategy", description: "Cybersecurity risk management objectives are established and communicated", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "NIST CSF 2.0-ID", code: "ID.AM-01", name: "Asset Inventory", description: "Inventories of hardware managed by the organization are maintained", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "NIST CSF 2.0-ID", code: "ID.AM-02", name: "Software Inventory", description: "Inventories of software and services managed by the organization", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "NIST CSF 2.0-PR", code: "PR.AA-01", name: "Access Control", description: "Identities and credentials for authorized users are managed", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "NIST CSF 2.0-DE", code: "DE.CM-01", name: "Continuous Monitoring", description: "Networks and network services are monitored", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },

    // HIPAA Requirements
    { category: "HIPAA-164.302", code: "164.308(a)(1)", name: "Security Management Process", description: "Implement policies and procedures to prevent, detect, contain, and correct security violations", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "HIPAA-164.302", code: "164.308(a)(2)", name: "Assigned Security Responsibility", description: "Identify the security official responsible for the security program", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "HIPAA-164.302", code: "164.308(a)(3)", name: "Workforce Security", description: "Implement policies and procedures to ensure appropriate access", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "HIPAA-164.310", code: "164.310(a)(1)", name: "Facility Access Controls", description: "Implement policies and procedures to limit physical access", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "HIPAA-164.312", code: "164.312(a)(1)", name: "Access Control", description: "Implement technical policies and procedures for electronic information systems", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
  ];

  for (const req of requirements) {
    const categoryId = createdCategories[req.category];
    if (categoryId) {
      const reqId = `${req.category}-${req.code}`;
      // Use findFirst to check if requirement exists for this customer
      const existing = await prisma.requirement.findFirst({
        where: { customerAccountId, id: reqId },
      });
      if (!existing) {
        await prisma.requirement.create({
          data: {
            id: reqId,
            customerAccountId,
            code: req.code,
            name: req.name,
            description: req.description,
            controlCompliance: req.compliance,
            applicability: req.applicability,
            implementationStatus: req.implementation,
            categoryId: categoryId,
            frameworkId: createdFrameworks[req.category.split("-")[0]],
          },
        });
      }
    }
  }
  console.log("✅ Requirements created (70+ comprehensive requirements)");

  // Create Regulations with comprehensive data
  const regulations = [
    {
      name: "ISO 27001:2022",
      version: "2022",
      scope: "Information Security Management System",
      status: "Subscribed",
      sa1Date: "2024-01-15",
      sa2Date: "2024-07-15",
    },
    {
      name: "GDPR",
      version: "2018",
      scope: "Data Protection and Privacy",
      status: "Subscribed",
      sa1Date: "2024-02-01",
      sa2Date: "2024-08-01",
    },
    {
      name: "SOC 2 Type II",
      version: "2017",
      scope: "Security, Availability, Processing Integrity",
      status: "Subscribed",
      sa1Date: "2024-03-10",
      sa2Date: "2024-09-10",
    },
    {
      name: "PCI DSS",
      version: "4.0",
      scope: "Payment Card Industry Data Security",
      status: "Subscribed",
      sa1Date: "2024-04-01",
      sa2Date: "2024-10-01",
    },
    {
      name: "HIPAA",
      version: "2013",
      scope: "Healthcare Information Privacy and Security",
      status: "Subscribed",
      sa1Date: "2024-05-15",
      sa2Date: "2024-11-15",
    },
    {
      name: "NIST CSF",
      version: "2.0",
      scope: "Cybersecurity Framework",
      status: "Subscribed",
      sa1Date: "2024-06-01",
      sa2Date: "2024-12-01",
    },
    {
      name: "CCPA",
      version: "2020",
      scope: "California Consumer Privacy Act",
      status: "Not Subscribed",
    },
    {
      name: "SOX",
      version: "2002",
      scope: "Financial Reporting and Internal Controls",
      status: "Not Subscribed",
    },
    {
      name: "FISMA",
      version: "2014",
      scope: "Federal Information Security Management",
      status: "Not Subscribed",
    },
    {
      name: "COBIT",
      version: "2019",
      scope: "IT Governance and Management",
      status: "Subscribed",
      sa1Date: "2024-07-01",
      sa2Date: "2025-01-01",
    },
  ];

  for (const reg of regulations) {
    // Regulation is shared master data (no customerAccountId)
    const existing = await prisma.regulation.findFirst({
      where: { name: reg.name },
    });
    if (existing) {
      await prisma.regulation.update({
        where: { id: existing.id },
        data: {
          version: reg.version,
          scope: reg.scope,
          status: reg.status,
          sa1Date: reg.sa1Date,
          sa2Date: reg.sa2Date,
        },
      });
    } else {
      await prisma.regulation.create({
        data: { ...reg },
      });
    }
  }
  console.log("✅ Regulations created (10 comprehensive regulations)");

  // Create Control Domains
  const controlDomains = [
    "Compliance",
    "Cybersecurity & Data Protection Governance",
    "Risk Management",
    "Technology Development & Acquisition",
    "Human Resources Security",
    "Asset Management",
    "Incident Response",
    "Vulnerability & Patch Management",
    "Threat Management",
    "Project & Resource Management",
    "Security Awareness & Training",
    "Business Continuity & Disaster Recovery",
    "Continuous Monitoring",
    "Maintenance",
    "Identification & Authentication",
    "Information Assurance",
    "Third-Party Management",
    "Data Classification & Handling",
    "Cloud Security",
    "Endpoint Security",
    "Mobile Device Management",
    "Network Security",
    "Configuration Management",
    "Data Privacy",
    "Secure Engineering & Architecture",
    "Capacity & Performance Planning",
    "Security Operations",
    "Physical & Environmental Security",
    "Cryptographic Protections",
    "Change Management",
  ];

  const createdDomains: { [key: string]: string } = {};
  for (const name of controlDomains) {
    // ControlDomain is shared master data (no customerAccountId)
    const existing = await prisma.controlDomain.findFirst({
      where: { name },
    });
    if (existing) {
      createdDomains[name] = existing.id;
    } else {
      const domain = await prisma.controlDomain.create({
        data: { name },
      });
      createdDomains[name] = domain.id;
    }
  }
  console.log("✅ Control Domains created");

  // Create Controls with realistic names and distribute across frameworks
  const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
  const controlStatuses = ["Non Compliant", "Compliant", "Not Applicable", "Partial Compliant"];

  // Realistic control definitions mapped to domains and frameworks
  const controlDefinitions = [
    // ISO 27001 Controls - Organizational
    { domain: "Compliance", framework: "ISO 27001:2022", name: "Information Security Policy", description: "Policies for information security shall be defined, approved by management, published and communicated", question: "Is there a documented information security policy approved by management?", functional: "Govern" },
    { domain: "Compliance", framework: "ISO 27001:2022", name: "Review of Information Security Policies", description: "Information security policies shall be reviewed at planned intervals", question: "Are information security policies reviewed regularly?", functional: "Govern" },
    { domain: "Compliance", framework: "ISO 27001:2022", name: "Segregation of Duties", description: "Conflicting duties and areas of responsibility shall be segregated", question: "Are conflicting duties properly segregated?", functional: "Protect" },

    // Cybersecurity Controls
    { domain: "Cybersecurity & Data Protection Governance", framework: "ISO 27001:2022", name: "Threat Intelligence", description: "Information about security threats shall be collected and analyzed", question: "Is threat intelligence collected and analyzed?", functional: "Identify" },
    { domain: "Cybersecurity & Data Protection Governance", framework: "NIST CSF 2.0", name: "Security Monitoring", description: "Continuous monitoring of security events and alerts", question: "Are security events monitored continuously?", functional: "Detect" },
    { domain: "Cybersecurity & Data Protection Governance", framework: "SOC 2 Type II", name: "Data Protection Controls", description: "Technical and organizational measures to protect data", question: "Are data protection controls implemented?", functional: "Protect" },

    // Risk Management Controls
    { domain: "Risk Management", framework: "ISO 27001:2022", name: "Risk Assessment Process", description: "A risk assessment process shall be defined and applied", question: "Is there a defined risk assessment process?", functional: "Identify" },
    { domain: "Risk Management", framework: "NIST CSF 2.0", name: "Risk Treatment Plan", description: "Risk treatment options shall be selected and a risk treatment plan formulated", question: "Is there a risk treatment plan?", functional: "Govern" },
    { domain: "Risk Management", framework: "ISO 27001:2022", name: "Risk Acceptance Criteria", description: "Risk acceptance criteria shall be defined", question: "Are risk acceptance criteria defined?", functional: "Govern" },

    // Human Resources Security
    { domain: "Human Resources Security", framework: "ISO 27001:2022", name: "Background Verification", description: "Background verification checks on candidates shall be carried out", question: "Are background checks performed on new hires?", functional: "Protect" },
    { domain: "Human Resources Security", framework: "HIPAA", name: "Security Awareness Training", description: "All employees shall receive appropriate awareness education and training", question: "Do all employees receive security awareness training?", functional: "Protect" },
    { domain: "Human Resources Security", framework: "SOC 2 Type II", name: "Disciplinary Process", description: "A formal disciplinary process shall be in place for security violations", question: "Is there a disciplinary process for security violations?", functional: "Respond" },

    // Asset Management
    { domain: "Asset Management", framework: "ISO 27001:2022", name: "Asset Inventory", description: "Assets associated with information shall be identified and an inventory maintained", question: "Is there a complete asset inventory?", functional: "Identify" },
    { domain: "Asset Management", framework: "NIST CSF 2.0", name: "Asset Classification", description: "Information shall be classified according to its sensitivity", question: "Is information properly classified?", functional: "Identify" },
    { domain: "Asset Management", framework: "PCI DSS v4.0", name: "Media Handling", description: "Procedures for handling removable media shall be implemented", question: "Are media handling procedures in place?", functional: "Protect" },

    // Incident Response
    { domain: "Incident Response", framework: "ISO 27001:2022", name: "Incident Response Procedure", description: "Procedures for responding to security incidents shall be documented", question: "Are incident response procedures documented?", functional: "Respond" },
    { domain: "Incident Response", framework: "NIST CSF 2.0", name: "Incident Communication", description: "Security incidents shall be communicated appropriately", question: "Is there an incident communication process?", functional: "Respond" },
    { domain: "Incident Response", framework: "SOC 2 Type II", name: "Incident Learning", description: "Lessons learned from incidents shall be used to improve controls", question: "Are lessons learned from incidents captured?", functional: "Recover" },

    // Network Security
    { domain: "Network Security", framework: "PCI DSS v4.0", name: "Firewall Configuration", description: "Network firewalls shall be configured according to security requirements", question: "Are firewalls properly configured?", functional: "Protect" },
    { domain: "Network Security", framework: "ISO 27001:2022", name: "Network Segmentation", description: "Networks shall be segmented appropriately", question: "Is network segmentation implemented?", functional: "Protect" },
    { domain: "Network Security", framework: "NIST CSF 2.0", name: "Intrusion Detection", description: "Intrusion detection systems shall be deployed", question: "Are intrusion detection systems in place?", functional: "Detect" },

    // Access Control
    { domain: "Identification & Authentication", framework: "ISO 27001:2022", name: "Access Control Policy", description: "An access control policy shall be established based on business requirements", question: "Is there an access control policy?", functional: "Protect" },
    { domain: "Identification & Authentication", framework: "PCI DSS v4.0", name: "Unique User IDs", description: "Each user shall have a unique identifier", question: "Do all users have unique IDs?", functional: "Protect" },
    { domain: "Identification & Authentication", framework: "HIPAA", name: "Multi-Factor Authentication", description: "MFA shall be required for privileged access", question: "Is MFA implemented for privileged access?", functional: "Protect" },

    // Data Privacy
    { domain: "Data Privacy", framework: "GDPR", name: "Consent Management", description: "Consent shall be obtained and documented for personal data processing", question: "Is consent properly obtained and documented?", functional: "Govern" },
    { domain: "Data Privacy", framework: "GDPR", name: "Data Subject Rights", description: "Procedures shall be in place to handle data subject requests", question: "Can data subject rights be fulfilled?", functional: "Protect" },
    { domain: "Data Privacy", framework: "GDPR", name: "Privacy Impact Assessment", description: "Privacy impact assessments shall be conducted for high-risk processing", question: "Are PIAs conducted for high-risk processing?", functional: "Identify" },

    // Business Continuity
    { domain: "Business Continuity & Disaster Recovery", framework: "ISO 27001:2022", name: "Business Continuity Plan", description: "Business continuity plans shall be documented and tested", question: "Is there a documented BCP?", functional: "Recover" },
    { domain: "Business Continuity & Disaster Recovery", framework: "SOC 2 Type II", name: "Disaster Recovery Testing", description: "Disaster recovery procedures shall be tested regularly", question: "Is DR testing performed regularly?", functional: "Recover" },
    { domain: "Business Continuity & Disaster Recovery", framework: "NIST CSF 2.0", name: "Recovery Time Objectives", description: "Recovery time objectives shall be defined and achievable", question: "Are RTOs defined and achievable?", functional: "Recover" },

    // Cryptography
    { domain: "Cryptographic Protections", framework: "ISO 27001:2022", name: "Encryption Policy", description: "A policy on the use of cryptographic controls shall be developed", question: "Is there an encryption policy?", functional: "Protect" },
    { domain: "Cryptographic Protections", framework: "PCI DSS v4.0", name: "Key Management", description: "Cryptographic keys shall be properly managed throughout their lifecycle", question: "Is key management properly implemented?", functional: "Protect" },
    { domain: "Cryptographic Protections", framework: "HIPAA", name: "Data Encryption at Rest", description: "Sensitive data shall be encrypted at rest", question: "Is data encrypted at rest?", functional: "Protect" },

    // Third Party Management
    { domain: "Third-Party Management", framework: "ISO 27001:2022", name: "Supplier Security Policy", description: "Security requirements for suppliers shall be defined", question: "Are supplier security requirements defined?", functional: "Govern" },
    { domain: "Third-Party Management", framework: "SOC 2 Type II", name: "Vendor Assessment", description: "Vendors shall be assessed for security compliance", question: "Are vendors assessed for security?", functional: "Identify" },
    { domain: "Third-Party Management", framework: "GDPR", name: "Data Processing Agreements", description: "Data processing agreements shall be in place with processors", question: "Are DPAs in place with all processors?", functional: "Govern" },

    // Physical Security
    { domain: "Physical & Environmental Security", framework: "ISO 27001:2022", name: "Physical Entry Controls", description: "Secure areas shall be protected by entry controls", question: "Are physical entry controls in place?", functional: "Protect" },
    { domain: "Physical & Environmental Security", framework: "PCI DSS v4.0", name: "Visitor Management", description: "Visitors shall be identified and escorted", question: "Is visitor access controlled?", functional: "Protect" },
    { domain: "Physical & Environmental Security", framework: "ISO 27001:2022", name: "Equipment Security", description: "Equipment shall be protected from physical and environmental threats", question: "Is equipment physically secured?", functional: "Protect" },

    // Vulnerability Management
    { domain: "Vulnerability & Patch Management", framework: "ISO 27001:2022", name: "Vulnerability Scanning", description: "Technical vulnerabilities shall be identified through regular scanning", question: "Is vulnerability scanning performed regularly?", functional: "Detect" },
    { domain: "Vulnerability & Patch Management", framework: "PCI DSS v4.0", name: "Patch Management", description: "Security patches shall be applied in a timely manner", question: "Are patches applied timely?", functional: "Protect" },
    { domain: "Vulnerability & Patch Management", framework: "NIST CSF 2.0", name: "Penetration Testing", description: "Penetration tests shall be conducted periodically", question: "Is penetration testing performed?", functional: "Detect" },

    // Change Management
    { domain: "Change Management", framework: "ISO 27001:2022", name: "Change Control Process", description: "Changes shall be controlled through a formal change management process", question: "Is there a change control process?", functional: "Protect" },
    { domain: "Change Management", framework: "SOC 2 Type II", name: "Change Authorization", description: "Changes shall be authorized before implementation", question: "Are changes properly authorized?", functional: "Protect" },
    { domain: "Change Management", framework: "PCI DSS v4.0", name: "Change Testing", description: "Changes shall be tested before deployment to production", question: "Are changes tested before deployment?", functional: "Protect" },

    // Continuous Monitoring
    { domain: "Continuous Monitoring", framework: "NIST CSF 2.0", name: "Log Management", description: "Security logs shall be collected and analyzed", question: "Are security logs collected and analyzed?", functional: "Detect" },
    { domain: "Continuous Monitoring", framework: "PCI DSS v4.0", name: "File Integrity Monitoring", description: "Critical files shall be monitored for unauthorized changes", question: "Is FIM implemented for critical files?", functional: "Detect" },
    { domain: "Continuous Monitoring", framework: "SOC 2 Type II", name: "Security Metrics", description: "Security metrics shall be collected and reported", question: "Are security metrics tracked?", functional: "Detect" },

    // Cloud Security
    { domain: "Cloud Security", framework: "ISO 27001:2022", name: "Cloud Security Architecture", description: "Security architecture for cloud services shall be defined", question: "Is cloud security architecture documented?", functional: "Protect" },
    { domain: "Cloud Security", framework: "SOC 2 Type II", name: "Cloud Access Control", description: "Access to cloud resources shall be controlled", question: "Is cloud access properly controlled?", functional: "Protect" },
    { domain: "Cloud Security", framework: "NIST CSF 2.0", name: "Cloud Data Protection", description: "Data in cloud environments shall be protected", question: "Is cloud data properly protected?", functional: "Protect" },
  ];

  let controlIndex = 1;
  for (const ctrl of controlDefinitions) {
    const frameworkId = createdFrameworks[ctrl.framework];
    const domainId = createdDomains[ctrl.domain];

    if (frameworkId && domainId) {
      const controlCode = `CTRL-${String(controlIndex).padStart(4, "0")}`;
      // Use findFirst to check if control exists for this customer
      const existing = await prisma.control.findFirst({
        where: { customerAccountId, controlCode },
      });
      if (!existing) {
        await prisma.control.create({
          data: {
            customerAccountId,
            controlCode,
            name: ctrl.name,
            description: ctrl.description,
            controlQuestion: ctrl.question,
            functionalGrouping: ctrl.functional,
            status: controlStatuses[controlIndex % 4],
            domainId: domainId,
            frameworkId: frameworkId,
            departmentId: createdDepts[departments[controlIndex % departments.length]],
            ownerId: createdUsers["john.doe"],
            scope: controlIndex % 3 === 0 ? "Not In-Scope" : "In-Scope",
          },
        });
      }
      controlIndex++;
    }
  }
  console.log(`✅ Controls created (${controlIndex - 1} realistic controls across multiple frameworks)`);

  // Create Processes
  const processes = [
    { processCode: "PRC-001", name: "Procurement Process", processType: "Primary", department: "Procurement" },
    { processCode: "PRC-002", name: "Hiring Process", processType: "Supporting", department: "Human Resources" },
    { processCode: "PRC-003", name: "IT Change Management", processType: "Primary", department: "IT Operations" },
    { processCode: "PRC-004", name: "Incident Response", processType: "Primary", department: "IT Operations" },
    { processCode: "PRC-005", name: "Budget Planning", processType: "Management", department: "Revenue" },
    { processCode: "PRC-006", name: "Compliance Review", processType: "Primary", department: "Compliance" },
    { processCode: "PRC-007", name: "Risk Assessment", processType: "Primary", department: "Risk Management" },
    { processCode: "PRC-008", name: "Quality Control", processType: "Supporting", department: "Quality Assurance" },
  ];

  for (const process of processes) {
    // Use findFirst to check if process exists for this customer
    const existing = await prisma.process.findFirst({
      where: { customerAccountId, processCode: process.processCode },
    });
    if (!existing) {
      await prisma.process.create({
        data: {
          customerAccountId,
          processCode: process.processCode,
          name: process.name,
          processType: process.processType,
          departmentId: createdDepts[process.department],
          ownerId: createdUsers["bts.admin"],
        },
      });
    }
  }
  console.log("✅ Processes created");

  // Create Policies
  const policies = [
    { name: "Information Security Policy", documentType: "Policy", department: "IT Operations", status: "Published" },
    { name: "Data Privacy Policy", documentType: "Policy", department: "Compliance", status: "Published" },
    { name: "Access Control Policy", documentType: "Policy", department: "IT Operations", status: "Approved" },
    { name: "Incident Response Procedure", documentType: "Procedure", department: "IT Operations", status: "Published" },
    { name: "Change Management Standard", documentType: "Standard", department: "IT Operations", status: "Draft" },
    { name: "Employee Onboarding Procedure", documentType: "Procedure", department: "Human Resources", status: "Published" },
    { name: "Vendor Management Policy", documentType: "Policy", department: "Procurement", status: "Needs Review" },
    { name: "Business Continuity Plan", documentType: "Policy", department: "Operations", status: "Published" },
  ];

  let policyIdx = 1;
  for (const policy of policies) {
    const code = `POL-${String(policyIdx++).padStart(3, "0")}`;
    // Use findFirst to check if policy exists for this customer
    const existing = await prisma.policy.findFirst({
      where: { customerAccountId, code },
    });
    if (!existing) {
      await prisma.policy.create({
        data: {
          customerAccountId,
          code,
          name: policy.name,
          documentType: policy.documentType,
          departmentId: createdDepts[policy.department],
          status: policy.status,
          version: "1.0",
        },
      });
    }
  }
  console.log("✅ Policies created");

  // ==================== CREATE POLICY-CONTROL LINKS ====================
  // Link policies to controls
  console.log("🔗 Creating Policy-Control links...");

  const allPolicies = await prisma.policy.findMany({
    where: { customerAccountId },
  });

  const allControlsForPolicies = await prisma.control.findMany({
    where: { customerAccountId },
  });

  let policyControlLinksCreated = 0;
  // Link each policy to 3-5 controls
  for (let i = 0; i < allPolicies.length; i++) {
    const policy = allPolicies[i];
    const controlCount = Math.min(3 + (i % 3), allControlsForPolicies.length); // 3-5 controls per policy

    for (let j = 0; j < controlCount; j++) {
      const controlIndex = (i * 3 + j) % allControlsForPolicies.length;
      const control = allControlsForPolicies[controlIndex];

      try {
        await prisma.policyControl.upsert({
          where: {
            policyId_controlId: {
              policyId: policy.id,
              controlId: control.id,
            },
          },
          update: {},
          create: {
            policyId: policy.id,
            controlId: control.id,
          },
        });
        policyControlLinksCreated++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
  }
  console.log(`✅ Policy-Control links created (${policyControlLinksCreated} links)`);

  // Create Evidence Requests linked to multiple frameworks
  const evidences = [
    { name: "Access Control Logs", framework: "ISO 27001:2022", department: "IT Operations", status: "Pending", dueDate: "2025-01-15", description: "Monthly access control logs showing user authentication and authorization events" },
    { name: "Security Training Records", framework: "ISO 27001:2022", department: "Human Resources", status: "Submitted", dueDate: "2025-01-10", description: "Employee security awareness training completion certificates and attendance records" },
    { name: "Firewall Configuration", framework: "PCI DSS v4.0", department: "IT Operations", status: "Approved", dueDate: "2025-01-05", description: "Current firewall ruleset configuration and change history documentation" },
    { name: "Data Processing Agreement", framework: "GDPR", department: "Compliance", status: "Pending", dueDate: "2025-01-20", description: "Signed data processing agreements with all third-party processors" },
    { name: "Vulnerability Scan Report", framework: "ISO 27001:2022", department: "IT Operations", status: "Overdue", dueDate: "2024-12-15", description: "Quarterly vulnerability scan results with remediation status" },
    { name: "Backup Verification", framework: "ISO 27001:2022", department: "IT Operations", status: "Pending", dueDate: "2025-02-01", description: "Backup restoration test results and verification logs" },
    { name: "Risk Assessment Report", framework: "NIST CSF 2.0", department: "Risk Management", status: "Submitted", dueDate: "2025-01-25", description: "Annual information security risk assessment with treatment plans" },
    { name: "Incident Response Test", framework: "NIS2 Directive", department: "IT Operations", status: "Pending", dueDate: "2025-02-15", description: "Results from tabletop exercise or incident response drill" },
    { name: "SOC 2 Audit Report", framework: "SOC 2 Type II", department: "Compliance", status: "Approved", dueDate: "2025-01-30", description: "Type II SOC 2 audit report from external auditor" },
    { name: "Privacy Impact Assessment", framework: "GDPR", department: "Compliance", status: "Submitted", dueDate: "2025-02-10", description: "DPIA for new customer data processing activities" },
    { name: "Penetration Test Report", framework: "PCI DSS v4.0", department: "IT Operations", status: "Pending", dueDate: "2025-03-01", description: "External and internal penetration test findings and remediation" },
    { name: "Business Continuity Plan", framework: "ISO 27001:2022", department: "Operations", status: "Approved", dueDate: "2025-01-20", description: "Updated BCP documentation with recovery procedures" },
    { name: "Encryption Key Inventory", framework: "PCI DSS v4.0", department: "IT Operations", status: "Pending", dueDate: "2025-02-20", description: "Inventory of cryptographic keys with rotation schedule" },
    { name: "HIPAA Training Certificates", framework: "HIPAA", department: "Human Resources", status: "Submitted", dueDate: "2025-01-15", description: "HIPAA privacy and security training completion records" },
    { name: "Vendor Security Assessments", framework: "SOC 2 Type II", department: "Procurement", status: "Pending", dueDate: "2025-02-28", description: "Security questionnaires and assessments for critical vendors" },
  ];

  let evidenceIdx = 1;
  for (const evidence of evidences) {
    const frameworkId = createdFrameworks[evidence.framework];
    if (frameworkId) {
      const evidenceCode = `EVD-${String(evidenceIdx++).padStart(3, "0")}`;
      // Check if evidence already exists before creating
      const existingEvidence = await prisma.evidence.findFirst({
        where: { customerAccountId, evidenceCode },
      });
      if (!existingEvidence) {
        await prisma.evidence.create({
          data: {
            customerAccountId,
            evidenceCode,
            name: evidence.name,
            description: evidence.description,
            frameworkId: frameworkId,
            departmentId: createdDepts[evidence.department],
            assigneeId: createdUsers["john.doe"],
            status: evidence.status,
            dueDate: new Date(evidence.dueDate),
          },
        });
      }
    }
  }
  console.log("✅ Evidence requests created (15 evidence items)");

  // ==================== CREATE REQUIREMENT-CONTROL LINKS ====================
  // Link requirements to controls within the same framework
  console.log("🔗 Creating Requirement-Control links...");

  // Get all frameworks with their requirements and controls
  const frameworksForLinking = await prisma.framework.findMany({
    where: { customerAccountId },
    include: {
      requirements: true,
      controls: true,
    },
  });

  let reqControlLinksCreated = 0;
  for (const framework of frameworksForLinking) {
    if (framework.requirements.length === 0 || framework.controls.length === 0) continue;

    // Link each requirement to 2-4 controls from the same framework
    for (let i = 0; i < framework.requirements.length; i++) {
      const req = framework.requirements[i];
      const controlCount = Math.min(2 + (i % 3), framework.controls.length); // 2-4 controls per requirement

      for (let j = 0; j < controlCount; j++) {
        const controlIndex = (i * 2 + j) % framework.controls.length;
        const control = framework.controls[controlIndex];

        try {
          await prisma.requirementControl.upsert({
            where: {
              requirementId_controlId: {
                requirementId: req.id,
                controlId: control.id,
              },
            },
            update: {},
            create: {
              requirementId: req.id,
              controlId: control.id,
            },
          });
          reqControlLinksCreated++;
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
    }
  }
  console.log(`✅ Requirement-Control links created (${reqControlLinksCreated} links)`);

  // ==================== CREATE EVIDENCE-CONTROL LINKS ====================
  // Link evidences to controls within the same framework
  console.log("🔗 Creating Evidence-Control links...");

  const frameworksForEvidenceLinks = await prisma.framework.findMany({
    where: { customerAccountId },
    include: {
      evidences: true,
      controls: true,
    },
  });

  let evControlLinksCreated = 0;
  for (const framework of frameworksForEvidenceLinks) {
    if (framework.evidences.length === 0 || framework.controls.length === 0) continue;

    // Link each evidence to 1-3 controls from the same framework
    for (let i = 0; i < framework.evidences.length; i++) {
      const evidence = framework.evidences[i];
      const controlCount = Math.min(1 + (i % 3), framework.controls.length); // 1-3 controls per evidence

      for (let j = 0; j < controlCount; j++) {
        const controlIndex = (i + j) % framework.controls.length;
        const control = framework.controls[controlIndex];

        try {
          await prisma.evidenceControl.upsert({
            where: {
              evidenceId_controlId: {
                evidenceId: evidence.id,
                controlId: control.id,
              },
            },
            update: {},
            create: {
              evidenceId: evidence.id,
              controlId: control.id,
            },
          });
          evControlLinksCreated++;
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
    }
  }
  console.log(`✅ Evidence-Control links created (${evControlLinksCreated} links)`);

  // Create Exceptions
  const exceptions = [
    { name: "Legacy System Exception", category: "Control", department: "IT Operations", status: "Approved", startDate: "2025-01-01", endDate: "2025-06-30" },
    { name: "Vendor Compliance Gap", category: "Compliance", department: "Procurement", status: "Pending", startDate: "2025-01-15", endDate: "2025-03-15" },
    { name: "Password Policy Exception", category: "Policy", department: "IT Operations", status: "Authorised", startDate: "2025-02-01", endDate: "2025-04-01" },
    { name: "Data Retention Exception", category: "Policy", department: "Compliance", status: "Pending", startDate: "2025-01-10", endDate: "2025-07-10" },
    { name: "Access Control Override", category: "Control", department: "IT Operations", status: "Closed", startDate: "2024-10-01", endDate: "2024-12-31" },
  ];

  let exceptionIdx = 1;
  for (const exception of exceptions) {
    const exceptionCode = `EXC-${String(exceptionIdx++).padStart(3, "0")}`;
    // Check if exception already exists before creating
    const existingException = await prisma.exception.findFirst({
      where: { customerAccountId, exceptionCode },
    });
    if (!existingException) {
      await prisma.exception.create({
        data: {
          customerAccountId,
          exceptionCode,
          name: exception.name,
          category: exception.category,
          departmentId: createdDepts[exception.department],
          status: exception.status,
          startDate: new Date(exception.startDate),
          endDate: new Date(exception.endDate),
        },
      });
    }
  }
  console.log("✅ Exceptions created");

  // Create KPIs for KPI Dashboard
  const kpis = [
    { code: "KPI-001", objective: "Security Training Completion Rate", description: "Percentage of employees completing mandatory security awareness training", dataSource: "LMS Training Platform", calculationFormula: "(Completed Trainings / Total Employees) × 100", expectedScore: 95, actualScore: 87, department: "Human Resources", status: "Achieved", reviewDate: "2025-02-15" },
    { code: "KPI-002", objective: "Vulnerability Remediation Time", description: "Average time to remediate critical vulnerabilities in days", dataSource: "Vulnerability Scanner Reports", calculationFormula: "Sum of Remediation Days / Total Vulnerabilities", expectedScore: 7, actualScore: 12, department: "IT Operations", status: "Missed", reviewDate: "2025-01-30" },
    { code: "KPI-003", objective: "Incident Response Time", description: "Average time to respond to security incidents in hours", dataSource: "SIEM / Ticketing System", calculationFormula: "Average(First Response Time - Incident Report Time)", expectedScore: 4, actualScore: 3.5, department: "IT Operations", status: "Achieved", reviewDate: "2025-02-01" },
    { code: "KPI-004", objective: "Policy Compliance Rate", description: "Percentage of departments compliant with security policies", dataSource: "Policy Management System", calculationFormula: "(Compliant Departments / Total Departments) × 100", expectedScore: 100, actualScore: 85, department: "Compliance", status: "Overdue", reviewDate: "2025-01-15" },
    { code: "KPI-005", objective: "Access Review Completion", description: "Percentage of user access reviews completed on time", dataSource: "IAM System", calculationFormula: "(Completed Reviews / Scheduled Reviews) × 100", expectedScore: 100, actualScore: 92, department: "IT Operations", status: "Achieved", reviewDate: "2025-02-28" },
    { code: "KPI-006", objective: "Backup Success Rate", description: "Percentage of successful backup operations", dataSource: "Backup Management Console", calculationFormula: "(Successful Backups / Total Backup Jobs) × 100", expectedScore: 99.9, actualScore: 99.5, department: "IT Operations", status: "Achieved", reviewDate: "2025-02-10" },
    { code: "KPI-007", objective: "Risk Assessment Coverage", description: "Percentage of critical assets with completed risk assessments", dataSource: "GRC Platform - Risk Module", calculationFormula: "(Assessed Critical Assets / Total Critical Assets) × 100", expectedScore: 100, actualScore: 78, department: "Risk Management", status: "Missed", reviewDate: "2025-01-20" },
    { code: "KPI-008", objective: "Vendor Security Assessment", description: "Percentage of critical vendors with security assessments", dataSource: "Vendor Management System", calculationFormula: "(Assessed Vendors / Total Critical Vendors) × 100", expectedScore: 100, actualScore: null, department: "Procurement", status: "Scheduled", reviewDate: "2025-03-15" },
    { code: "KPI-009", objective: "Data Classification Compliance", description: "Percentage of data assets properly classified", dataSource: "Data Discovery Tool", calculationFormula: "(Classified Assets / Total Data Assets) × 100", expectedScore: 95, actualScore: 72, department: "Compliance", status: "Overdue", reviewDate: "2025-01-10" },
    { code: "KPI-010", objective: "Penetration Test Findings Closure", description: "Percentage of critical pen test findings remediated", dataSource: "Penetration Test Reports", calculationFormula: "(Closed Findings / Total Critical Findings) × 100", expectedScore: 100, actualScore: 88, department: "IT Operations", status: "Missed", reviewDate: "2025-02-05" },
    { code: "KPI-011", objective: "System Uptime", description: "Percentage of system availability for critical systems", dataSource: "Infrastructure Monitoring Tool", calculationFormula: "((Total Time - Downtime) / Total Time) × 100", expectedScore: 99.9, actualScore: 99.95, department: "IT Operations", status: "Achieved", reviewDate: "2025-02-20" },
    { code: "KPI-012", objective: "Audit Finding Resolution", description: "Percentage of audit findings resolved within SLA", dataSource: "Audit Management System", calculationFormula: "(On-Time Resolutions / Total Findings) × 100", expectedScore: 100, actualScore: null, department: "Internal Audit", status: "Scheduled", reviewDate: "2025-03-01" },
    { code: "KPI-013", objective: "Password Policy Compliance", description: "Percentage of users compliant with password policy", dataSource: "Active Directory / IAM", calculationFormula: "(Compliant Users / Total Users) × 100", expectedScore: 100, actualScore: 94, department: "IT Operations", status: "Achieved", reviewDate: "2025-01-25" },
    { code: "KPI-014", objective: "Change Success Rate", description: "Percentage of changes implemented without incidents", dataSource: "Change Management System", calculationFormula: "(Successful Changes / Total Changes) × 100", expectedScore: 98, actualScore: 96, department: "IT Operations", status: "Achieved", reviewDate: "2025-02-12" },
    { code: "KPI-015", objective: "BCP/DR Test Completion", description: "Percentage of business continuity tests completed on schedule", dataSource: "BCP Management Tool", calculationFormula: "(Completed Tests / Scheduled Tests) × 100", expectedScore: 100, actualScore: 67, department: "Operations", status: "Overdue", reviewDate: "2025-01-05" },
    { code: "KPI-016", objective: "Third-Party Risk Reviews", description: "Number of third-party risk assessments completed quarterly", dataSource: "Third-Party Risk Platform", calculationFormula: "Count of Completed Assessments", expectedScore: 25, actualScore: null, department: "Procurement", status: "Scheduled", reviewDate: "2025-03-31" },
    { code: "KPI-017", objective: "Security Awareness Score", description: "Average phishing simulation success rate", dataSource: "Phishing Simulation Platform", calculationFormula: "(Users Who Didn't Click / Total Users) × 100", expectedScore: 90, actualScore: 82, department: "Human Resources", status: "Missed", reviewDate: "2025-02-08" },
    { code: "KPI-018", objective: "Encryption Coverage", description: "Percentage of sensitive data encrypted at rest", dataSource: "Data Loss Prevention System", calculationFormula: "(Encrypted Data Volume / Total Sensitive Data) × 100", expectedScore: 100, actualScore: 98, department: "IT Operations", status: "Achieved", reviewDate: "2025-01-28" },
  ];

  for (const kpi of kpis) {
    // Use findFirst to check if KPI exists for this customer
    const existing = await prisma.kPI.findFirst({
      where: { customerAccountId, code: kpi.code },
    });
    if (!existing) {
      await prisma.kPI.create({
        data: {
          customerAccountId,
          code: kpi.code,
          objective: kpi.objective,
          description: kpi.description,
          dataSource: kpi.dataSource,
          calculationFormula: kpi.calculationFormula,
          expectedScore: kpi.expectedScore,
          actualScore: kpi.actualScore,
          status: kpi.status,
          reviewDate: new Date(kpi.reviewDate),
          departmentId: createdDepts[kpi.department],
        },
      });
    }
  }
  console.log("✅ KPIs created (18 KPI items)");

  // Create KPI Reviews and Action Plans
  const allKPIs = await prisma.kPI.findMany();

  for (const kpi of allKPIs) {
    // Add reviews for each KPI based on status
    const reviewsData = [];

    if (kpi.status === "Achieved") {
      reviewsData.push(
        { reviewDate: "2025-01-15", actualScore: kpi.actualScore, status: "Achieved", documentName: "Q1_Report.pdf", documentPath: "/documents/Q1_Report.pdf" },
        { reviewDate: "2024-12-15", actualScore: (kpi.actualScore || 0) * 0.95, status: "Achieved", documentName: null, documentPath: null },
        { reviewDate: "2024-11-15", actualScore: (kpi.actualScore || 0) * 0.92, status: "Achieved", documentName: "Nov_Evidence.xlsx", documentPath: "/documents/Nov_Evidence.xlsx" },
      );
    } else if (kpi.status === "Missed") {
      reviewsData.push(
        { reviewDate: "2025-01-15", actualScore: kpi.actualScore, status: "Missed", documentName: null, documentPath: null },
        { reviewDate: "2024-12-15", actualScore: (kpi.expectedScore || 0) * 0.85, status: "Missed", documentName: "Dec_Report.pdf", documentPath: "/documents/Dec_Report.pdf" },
        { reviewDate: "2024-11-15", actualScore: (kpi.expectedScore || 0) * 0.9, status: "Achieved", documentName: null, documentPath: null },
      );
    } else if (kpi.status === "Overdue") {
      reviewsData.push(
        { reviewDate: "2025-01-05", actualScore: kpi.actualScore, status: "Overdue", documentName: null, documentPath: null },
        { reviewDate: "2024-12-05", actualScore: (kpi.expectedScore || 0) * 0.75, status: "Missed", documentName: "Overdue_Notice.pdf", documentPath: "/documents/Overdue_Notice.pdf" },
      );
    } else if (kpi.status === "Scheduled") {
      reviewsData.push(
        { reviewDate: "2025-02-15", actualScore: null, status: "Scheduled", documentName: null, documentPath: null },
        { reviewDate: "2024-11-15", actualScore: (kpi.expectedScore || 0) * 0.88, status: "Achieved", documentName: "Previous_Review.pdf", documentPath: "/documents/Previous_Review.pdf" },
      );
    }

    for (const reviewData of reviewsData) {
      const review = await prisma.kPIReview.create({
        data: {
          kpiId: kpi.id,
          reviewDate: new Date(reviewData.reviewDate),
          actualScore: reviewData.actualScore,
          status: reviewData.status,
          documentName: reviewData.documentName,
          documentPath: reviewData.documentPath,
        },
      });

      // Add action plans for Missed reviews
      if (reviewData.status === "Missed") {
        await prisma.kPIActionPlan.createMany({
          data: [
            {
              kpiReviewId: review.id,
              plannedAction: "Conduct root cause analysis",
              description: "Investigate the underlying reasons for missing the KPI target",
              percentageCompleted: 75,
              startDate: new Date("2025-01-20"),
              status: "In-Progress",
            },
            {
              kpiReviewId: review.id,
              plannedAction: "Implement corrective measures",
              description: "Deploy fixes and improvements based on root cause analysis",
              percentageCompleted: 30,
              startDate: new Date("2025-02-01"),
              status: "In-Progress",
            },
            {
              kpiReviewId: review.id,
              plannedAction: "Schedule follow-up review",
              description: "Plan a review meeting to assess progress",
              percentageCompleted: 0,
              startDate: new Date("2025-02-15"),
              status: "Open",
            },
          ],
        });
      }
    }
  }
  console.log("✅ KPI Reviews and Action Plans created");

  // ==================== ASSET MANAGEMENT MODULE ====================

  // Create Asset Classifications
  const classifications = ["Critical", "High", "Medium", "Low"];
  const createdClassifications: { [key: string]: string } = {};

  for (const name of classifications) {
    // AssetClassification is shared master data (no customerAccountId)
    const existing = await prisma.assetClassification.findFirst({
      where: { name },
    });
    if (existing) {
      createdClassifications[name] = existing.id;
    } else {
      const classification = await prisma.assetClassification.create({
        data: { name, description: `${name} priority asset` },
      });
      createdClassifications[name] = classification.id;
    }
  }
  console.log("✅ Asset Classifications created");

  // Create Asset Categories
  const assetCategories = [
    { name: "Hardware", description: "Physical computing devices and equipment" },
    { name: "Software", description: "Applications and operating systems" },
    { name: "Data", description: "Information and data assets" },
    { name: "Network", description: "Network infrastructure and connectivity" },
    { name: "People", description: "Human resources and personnel" },
    { name: "Services", description: "Business and IT services" },
    { name: "Facilities", description: "Physical locations and infrastructure" },
  ];

  const createdAssetCategories: { [key: string]: string } = {};
  for (const cat of assetCategories) {
    // AssetCategory is shared master data (no customerAccountId)
    const existing = await prisma.assetCategory.findFirst({
      where: { name: cat.name },
    });
    if (existing) {
      createdAssetCategories[cat.name] = existing.id;
    } else {
      const category = await prisma.assetCategory.create({
        data: { ...cat },
      });
      createdAssetCategories[cat.name] = category.id;
    }
  }
  console.log("✅ Asset Categories created");

  // Create Asset Sub Categories
  const assetSubCategories = [
    // Hardware subcategories
    { name: "Server", description: "Physical and virtual servers", category: "Hardware" },
    { name: "Application Server", description: "Application hosting servers", category: "Hardware" },
    { name: "Workstation", description: "Desktop computers and laptops", category: "Hardware" },
    { name: "Firewall", description: "Network security devices", category: "Hardware" },
    { name: "Router", description: "Network routing devices", category: "Hardware" },
    { name: "Switch", description: "Network switching devices", category: "Hardware" },
    { name: "Router/Switch", description: "Network routing equipment", category: "Hardware" },
    { name: "Storage Device", description: "Data storage hardware", category: "Hardware" },
    { name: "Mobile Device", description: "Smartphones and tablets", category: "Hardware" },
    { name: "Printer", description: "Printing devices", category: "Hardware" },
    // Software subcategories
    { name: "Enterprise Application", description: "Business applications", category: "Software" },
    { name: "Operating System", description: "System software", category: "Software" },
    { name: "Database", description: "Database management systems", category: "Software" },
    { name: "Security Software", description: "Security tools and applications", category: "Software" },
    { name: "IDS/IPS", description: "Intrusion detection/prevention systems", category: "Software" },
    { name: "Antivirus Software", description: "Antivirus and anti-malware tools", category: "Software" },
    { name: "VPN", description: "Virtual Private Network software", category: "Software" },
    { name: "Web Application", description: "Web-based applications", category: "Software" },
    { name: "Mobile Application", description: "Mobile apps", category: "Software" },
    { name: "Email System", description: "Email and messaging systems", category: "Software" },
    { name: "Version Control System", description: "Source code version control", category: "Software" },
    { name: "Backup Software", description: "Backup and recovery software", category: "Software" },
    { name: "HRMS", description: "Human Resource Management System", category: "Software" },
    // Data subcategories
    { name: "Customer Data", description: "Customer information", category: "Data" },
    { name: "Financial Data", description: "Financial records and transactions", category: "Data" },
    { name: "Employee Data", description: "HR and employee information", category: "Data" },
    { name: "Intellectual Property", description: "Patents, trade secrets, source code", category: "Data" },
    { name: "Source Code", description: "Application source code", category: "Data" },
    { name: "Test Data", description: "Testing and QA data", category: "Data" },
    // Network subcategories
    { name: "LAN/WAN", description: "Local and wide area networks", category: "Network" },
    { name: "Cloud Infrastructure", description: "Cloud-based resources", category: "Network" },
    // Facilities subcategories
    { name: "Data Center", description: "Primary data center facilities", category: "Facilities" },
    { name: "Office Building", description: "Office locations", category: "Facilities" },
  ];

  const createdAssetSubCategories: { [key: string]: string } = {};
  for (const subCat of assetSubCategories) {
    // AssetSubCategory is shared master data (no customerAccountId)
    const existing = await prisma.assetSubCategory.findFirst({
      where: {
        name: subCat.name,
        categoryId: createdAssetCategories[subCat.category],
      },
    });
    if (existing) {
      createdAssetSubCategories[subCat.name] = existing.id;
    } else {
      const subCategory = await prisma.assetSubCategory.create({
        data: {
          name: subCat.name,
          description: subCat.description,
          categoryId: createdAssetCategories[subCat.category],
        },
      });
      createdAssetSubCategories[subCat.name] = subCategory.id;
    }
  }
  console.log("✅ Asset Sub Categories created");

  // Create Asset Groups
  const assetGroups = [
    { name: "Security Tools", description: "Security-related assets" },
    { name: "Payment Systems", description: "Payment processing assets" },
    { name: "Core Banking", description: "Core banking system assets" },
    { name: "Customer Facing", description: "Customer-facing applications" },
    { name: "Internal Operations", description: "Internal business operations" },
    { name: "Development", description: "Development and testing assets" },
    { name: "Testing", description: "Testing and QA assets" },
    { name: "Infrastructure", description: "Core infrastructure assets" },
    { name: "Communication", description: "Communication systems" },
    { name: "Human Resources", description: "HR and employee management assets" },
    { name: "Finance", description: "Financial management assets" },
    { name: "Backup & Disaster Recovery", description: "Backup and DR assets" },
  ];

  const createdAssetGroups: { [key: string]: string } = {};
  for (const group of assetGroups) {
    // AssetGroup is shared master data (no customerAccountId)
    const existing = await prisma.assetGroup.findFirst({
      where: { name: group.name },
    });
    if (existing) {
      createdAssetGroups[group.name] = existing.id;
    } else {
      const created = await prisma.assetGroup.create({
        data: { ...group },
      });
      createdAssetGroups[group.name] = created.id;
    }
  }
  console.log("✅ Asset Groups created");

  // Create Asset Sensitivities
  const assetSensitivities = [
    { name: "Public", description: "Information that can be freely shared" },
    { name: "Internal", description: "Information for internal use only" },
    { name: "Confidential", description: "Sensitive business information" },
    { name: "Restricted", description: "Highly sensitive, limited access" },
  ];

  const createdSensitivities: { [key: string]: string } = {};
  for (const sens of assetSensitivities) {
    // AssetSensitivity is shared master data (no customerAccountId)
    const existing = await prisma.assetSensitivity.findFirst({
      where: { name: sens.name },
    });
    if (existing) {
      createdSensitivities[sens.name] = existing.id;
    } else {
      const created = await prisma.assetSensitivity.create({
        data: { ...sens },
      });
      createdSensitivities[sens.name] = created.id;
    }
  }
  console.log("✅ Asset Sensitivities created");

  // Create Asset Lifecycle Statuses
  const lifecycleStatuses = [
    { name: "Planned", description: "Asset is planned for acquisition", order: 1 },
    { name: "Active", description: "Asset is in active use", order: 2 },
    { name: "In Use", description: "Asset is currently being used", order: 3 },
    { name: "Needs Maintenance", description: "Asset requires maintenance", order: 4 },
    { name: "Under Review", description: "Asset is under review", order: 5 },
    { name: "Retired", description: "Asset has been retired", order: 6 },
    { name: "Disposed", description: "Asset has been disposed", order: 7 },
  ];

  const createdLifecycleStatuses: { [key: string]: string } = {};
  for (const status of lifecycleStatuses) {
    // AssetLifecycleStatus is shared master data (no customerAccountId)
    const existing = await prisma.assetLifecycleStatus.findFirst({
      where: { name: status.name },
    });
    if (existing) {
      createdLifecycleStatuses[status.name] = existing.id;
    } else {
      const created = await prisma.assetLifecycleStatus.create({
        data: { ...status },
      });
      createdLifecycleStatuses[status.name] = created.id;
    }
  }
  console.log("✅ Asset Lifecycle Statuses created");

  // Create CIA Classifications - Comprehensive dummy data
  const ciaClassifications = [
    // Infrastructure Assets
    { subCategory: "Server", group: "Infrastructure", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Storage Device", group: "Infrastructure", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Router", group: "Infrastructure", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Switch", group: "Infrastructure", sensitivity: "Confidential", c: "medium", cScore: 5, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Application Server", group: "Infrastructure", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Database", group: "Infrastructure", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },

    // Core Banking Assets
    { subCategory: "Server", group: "Core Banking", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Database", group: "Core Banking", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Application Server", group: "Core Banking", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Storage Device", group: "Core Banking", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Enterprise Application", group: "Core Banking", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },

    // Security Tools
    { subCategory: "Firewall", group: "Security Tools", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "IDS/IPS", group: "Security Tools", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Antivirus Software", group: "Security Tools", sensitivity: "Confidential", c: "medium", cScore: 5, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "VPN", group: "Security Tools", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Server", group: "Security Tools", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },

    // Customer Facing Assets
    { subCategory: "Customer Data", group: "Customer Facing", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Database", group: "Customer Facing", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Web Application", group: "Customer Facing", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Mobile Application", group: "Customer Facing", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Server", group: "Customer Facing", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },

    // Internal Operations
    { subCategory: "Workstation", group: "Internal Operations", sensitivity: "Internal", c: "medium", cScore: 5, i: "medium", iScore: 5, a: "low", aScore: 0 },
    { subCategory: "Enterprise Application", group: "Internal Operations", sensitivity: "Confidential", c: "medium", cScore: 5, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Printer", group: "Internal Operations", sensitivity: "Internal", c: "low", cScore: 0, i: "low", iScore: 0, a: "low", aScore: 0 },
    { subCategory: "Server", group: "Internal Operations", sensitivity: "Confidential", c: "medium", cScore: 5, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Database", group: "Internal Operations", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Email System", group: "Internal Operations", sensitivity: "Confidential", c: "medium", cScore: 5, i: "medium", iScore: 5, a: "medium", aScore: 5 },

    // Development Assets
    { subCategory: "Server", group: "Development", sensitivity: "Internal", c: "low", cScore: 0, i: "medium", iScore: 5, a: "low", aScore: 0 },
    { subCategory: "Database", group: "Development", sensitivity: "Internal", c: "low", cScore: 0, i: "low", iScore: 0, a: "low", aScore: 0 },
    { subCategory: "Workstation", group: "Development", sensitivity: "Internal", c: "medium", cScore: 5, i: "medium", iScore: 5, a: "low", aScore: 0 },
    { subCategory: "Source Code", group: "Development", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "low", aScore: 0 },
    { subCategory: "Version Control System", group: "Development", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },

    // Testing Assets
    { subCategory: "Server", group: "Testing", sensitivity: "Internal", c: "low", cScore: 0, i: "medium", iScore: 5, a: "low", aScore: 0 },
    { subCategory: "Database", group: "Testing", sensitivity: "Internal", c: "low", cScore: 0, i: "low", iScore: 0, a: "low", aScore: 0 },
    { subCategory: "Test Data", group: "Testing", sensitivity: "Internal", c: "medium", cScore: 5, i: "low", iScore: 0, a: "low", aScore: 0 },

    // Human Resources Assets
    { subCategory: "HRMS", group: "Human Resources", sensitivity: "Confidential", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Employee Data", group: "Human Resources", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Database", group: "Human Resources", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },

    // Finance Assets
    { subCategory: "Financial Data", group: "Finance", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Database", group: "Finance", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Enterprise Application", group: "Finance", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },

    // Backup & DR Assets
    { subCategory: "Storage Device", group: "Backup & Disaster Recovery", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Server", group: "Backup & Disaster Recovery", sensitivity: "Restricted", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Backup Software", group: "Backup & Disaster Recovery", sensitivity: "Confidential", c: "medium", cScore: 5, i: "high", iScore: 10, a: "high", aScore: 10 },
  ];

  for (const cia of ciaClassifications) {
    const maxScore = Math.max(cia.cScore, cia.iScore, cia.aScore);
    const criticality = maxScore >= 10 ? "high" : maxScore >= 5 ? "medium" : "low";

    // AssetCIAClassification is shared master data (no customerAccountId)
    const existing = await prisma.assetCIAClassification.findFirst({
      where: {
        subCategoryId: createdAssetSubCategories[cia.subCategory],
        groupId: createdAssetGroups[cia.group],
      },
    });
    if (!existing) {
      await prisma.assetCIAClassification.create({
        data: {
          subCategoryId: createdAssetSubCategories[cia.subCategory],
          groupId: createdAssetGroups[cia.group],
          sensitivityId: createdSensitivities[cia.sensitivity],
          confidentiality: cia.c,
          confidentialityScore: cia.cScore,
          integrity: cia.i,
          integrityScore: cia.iScore,
          availability: cia.a,
          availabilityScore: cia.aScore,
          assetCriticality: criticality,
          assetCriticalityScore: maxScore,
        },
      });
    }
  }
  console.log("✅ CIA Classifications created");

  // Create Assets with enhanced fields - Expanded dummy data
  const assets = [
    // Infrastructure Assets
    { assetId: "AST-001", name: "Production Database Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Infrastructure", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 50000, acquisitionDate: "2023-01-15", nextReviewDate: "2025-06-15" },
    { assetId: "AST-002", name: "Core Banking Application Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Core Banking", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 75000, acquisitionDate: "2023-03-01", nextReviewDate: "2025-06-01" },
    { assetId: "AST-003", name: "Perimeter Firewall", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Firewall", group: "Security Tools", sensitivity: "Restricted", lifecycle: "Active", owner: "john.doe", custodian: "david.jones", location: "Data Center A", value: 25000, acquisitionDate: "2023-06-15", nextReviewDate: "2025-03-15" },
    { assetId: "AST-004", name: "Customer Database", assetType: "Information", department: "IT Operations", classification: "Critical", category: "Data", subCategory: "Customer Data", group: "Customer Facing", sensitivity: "Restricted", lifecycle: "Active", owner: "john.doe", custodian: "lisa.taylor", location: "Cloud AWS", value: 100000, acquisitionDate: "2022-01-01", nextReviewDate: "2025-01-01" },
    { assetId: "AST-005", name: "ERP System", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "Enterprise Application", group: "Internal Operations", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "On-Premise", value: 200000, acquisitionDate: "2021-06-01", nextReviewDate: "2025-06-01" },
    { assetId: "AST-006", name: "HR Management System", assetType: "Software", department: "Human Resources", classification: "High", category: "Software", subCategory: "HRMS", group: "Human Resources", sensitivity: "Confidential", lifecycle: "Active", owner: "emily.brown", custodian: "david.jones", location: "Cloud Azure", value: 50000, acquisitionDate: "2022-03-15", nextReviewDate: "2025-03-15" },
    { assetId: "AST-007", name: "Employee Workstations", assetType: "Hardware", department: "IT Support", classification: "Medium", category: "Hardware", subCategory: "Workstation", group: "Internal Operations", sensitivity: "Internal", lifecycle: "Active", owner: "david.jones", custodian: "david.jones", location: "All Offices", value: 150000, acquisitionDate: "2023-01-01", nextReviewDate: "2025-12-01" },
    { assetId: "AST-008", name: "Development Server", assetType: "Hardware", department: "Product Development", classification: "Medium", category: "Hardware", subCategory: "Server", group: "Development", sensitivity: "Internal", lifecycle: "Active", owner: "lisa.taylor", custodian: "david.jones", location: "Data Center B", value: 30000, acquisitionDate: "2023-09-01", nextReviewDate: "2025-09-01" },
    { assetId: "AST-009", name: "Backup Storage System", assetType: "Hardware", department: "IT Operations", classification: "High", category: "Hardware", subCategory: "Storage Device", group: "Infrastructure", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 80000, acquisitionDate: "2023-04-01", nextReviewDate: "2025-04-01" },
    { assetId: "AST-010", name: "CRM Database", assetType: "Information", department: "Revenue", classification: "High", category: "Data", subCategory: "Customer Data", group: "Customer Facing", sensitivity: "Confidential", lifecycle: "Active", owner: "james.anderson", custodian: "lisa.taylor", location: "Cloud AWS", value: 75000, acquisitionDate: "2022-06-01", nextReviewDate: "2025-06-01" },

    // Security Tools
    { assetId: "AST-011", name: "IDS/IPS Appliance", assetType: "Software", department: "IT Operations", classification: "Critical", category: "Software", subCategory: "IDS/IPS", group: "Security Tools", sensitivity: "Restricted", lifecycle: "Active", owner: "john.doe", custodian: "david.jones", location: "Data Center A", value: 35000, acquisitionDate: "2023-02-01", nextReviewDate: "2025-08-01" },
    { assetId: "AST-012", name: "Enterprise Antivirus", assetType: "Software", department: "IT Security", classification: "High", category: "Software", subCategory: "Antivirus Software", group: "Security Tools", sensitivity: "Confidential", lifecycle: "Active", owner: "john.doe", custodian: "david.jones", location: "Cloud", value: 15000, acquisitionDate: "2023-01-01", nextReviewDate: "2025-07-01" },
    { assetId: "AST-013", name: "VPN Gateway", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "VPN", group: "Security Tools", sensitivity: "Confidential", lifecycle: "Active", owner: "john.doe", custodian: "david.jones", location: "Data Center A", value: 20000, acquisitionDate: "2023-05-01", nextReviewDate: "2025-11-01" },

    // Network Infrastructure
    { assetId: "AST-014", name: "Core Router", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Router", group: "Infrastructure", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 40000, acquisitionDate: "2022-09-01", nextReviewDate: "2025-03-01" },
    { assetId: "AST-015", name: "Distribution Switch", assetType: "Hardware", department: "IT Operations", classification: "High", category: "Hardware", subCategory: "Switch", group: "Infrastructure", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 30000, acquisitionDate: "2022-10-01", nextReviewDate: "2025-04-01" },

    // Core Banking
    { assetId: "AST-016", name: "Core Banking Database", assetType: "Software", department: "IT Operations", classification: "Critical", category: "Software", subCategory: "Database", group: "Core Banking", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "lisa.taylor", location: "Data Center A", value: 150000, acquisitionDate: "2021-12-01", nextReviewDate: "2025-06-01" },
    { assetId: "AST-017", name: "Transaction Processing Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Application Server", group: "Core Banking", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 90000, acquisitionDate: "2022-03-01", nextReviewDate: "2025-09-01" },

    // Customer Facing
    { assetId: "AST-018", name: "Online Banking Portal", assetType: "Software", department: "Digital Banking", classification: "Critical", category: "Software", subCategory: "Web Application", group: "Customer Facing", sensitivity: "Confidential", lifecycle: "Active", owner: "james.anderson", custodian: "lisa.taylor", location: "Cloud AWS", value: 120000, acquisitionDate: "2022-05-01", nextReviewDate: "2025-05-01" },
    { assetId: "AST-019", name: "Mobile Banking App", assetType: "Software", department: "Digital Banking", classification: "High", category: "Software", subCategory: "Mobile Application", group: "Customer Facing", sensitivity: "Confidential", lifecycle: "Active", owner: "james.anderson", custodian: "lisa.taylor", location: "Cloud AWS", value: 80000, acquisitionDate: "2022-07-01", nextReviewDate: "2025-07-01" },
    { assetId: "AST-020", name: "Customer Portal Server", assetType: "Hardware", department: "Digital Banking", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Customer Facing", sensitivity: "Restricted", lifecycle: "Active", owner: "james.anderson", custodian: "david.jones", location: "Cloud AWS", value: 60000, acquisitionDate: "2022-06-01", nextReviewDate: "2025-06-01" },

    // Internal Operations
    { assetId: "AST-021", name: "Office Printers", assetType: "Hardware", department: "IT Support", classification: "Low", category: "Hardware", subCategory: "Printer", group: "Internal Operations", sensitivity: "Internal", lifecycle: "Active", owner: "david.jones", custodian: "david.jones", location: "All Offices", value: 25000, acquisitionDate: "2023-01-01", nextReviewDate: "2026-01-01" },
    { assetId: "AST-022", name: "Email Server", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "Email System", group: "Internal Operations", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Cloud Azure", value: 40000, acquisitionDate: "2022-04-01", nextReviewDate: "2025-04-01" },
    { assetId: "AST-023", name: "Internal Operations Database", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "Database", group: "Internal Operations", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "lisa.taylor", location: "On-Premise", value: 55000, acquisitionDate: "2022-08-01", nextReviewDate: "2025-08-01" },

    // Development & Testing
    { assetId: "AST-024", name: "Source Code Repository", assetType: "Information", department: "Product Development", classification: "High", category: "Data", subCategory: "Source Code", group: "Development", sensitivity: "Confidential", lifecycle: "Active", owner: "lisa.taylor", custodian: "lisa.taylor", location: "Cloud GitHub", value: 100000, acquisitionDate: "2021-01-01", nextReviewDate: "2025-01-01" },
    { assetId: "AST-025", name: "Git Version Control", assetType: "Software", department: "Product Development", classification: "High", category: "Software", subCategory: "Version Control System", group: "Development", sensitivity: "Confidential", lifecycle: "Active", owner: "lisa.taylor", custodian: "david.jones", location: "Cloud GitHub", value: 12000, acquisitionDate: "2021-01-01", nextReviewDate: "2025-01-01" },
    { assetId: "AST-026", name: "Testing Environment Server", assetType: "Hardware", department: "Quality Assurance", classification: "Medium", category: "Hardware", subCategory: "Server", group: "Testing", sensitivity: "Internal", lifecycle: "Active", owner: "lisa.taylor", custodian: "david.jones", location: "Data Center B", value: 25000, acquisitionDate: "2023-03-01", nextReviewDate: "2025-09-01" },
    { assetId: "AST-027", name: "QA Test Data", assetType: "Information", department: "Quality Assurance", classification: "Medium", category: "Data", subCategory: "Test Data", group: "Testing", sensitivity: "Internal", lifecycle: "Active", owner: "lisa.taylor", custodian: "lisa.taylor", location: "Data Center B", value: 5000, acquisitionDate: "2023-04-01", nextReviewDate: "2025-10-01" },
    { assetId: "AST-028", name: "Testing Database", assetType: "Software", department: "Quality Assurance", classification: "Low", category: "Software", subCategory: "Database", group: "Testing", sensitivity: "Internal", lifecycle: "Active", owner: "lisa.taylor", custodian: "david.jones", location: "Data Center B", value: 8000, acquisitionDate: "2023-03-15", nextReviewDate: "2025-09-15" },

    // Human Resources
    { assetId: "AST-029", name: "Employee Records Database", assetType: "Information", department: "Human Resources", classification: "Critical", category: "Data", subCategory: "Employee Data", group: "Human Resources", sensitivity: "Restricted", lifecycle: "Active", owner: "emily.brown", custodian: "lisa.taylor", location: "Cloud Azure", value: 60000, acquisitionDate: "2022-01-01", nextReviewDate: "2025-01-01" },
    { assetId: "AST-030", name: "HRMS Database", assetType: "Software", department: "Human Resources", classification: "High", category: "Software", subCategory: "Database", group: "Human Resources", sensitivity: "Restricted", lifecycle: "Active", owner: "emily.brown", custodian: "david.jones", location: "Cloud Azure", value: 45000, acquisitionDate: "2022-02-01", nextReviewDate: "2025-02-01" },

    // Finance
    { assetId: "AST-031", name: "Financial Records System", assetType: "Information", department: "Finance", classification: "Critical", category: "Data", subCategory: "Financial Data", group: "Finance", sensitivity: "Restricted", lifecycle: "Active", owner: "james.anderson", custodian: "lisa.taylor", location: "On-Premise", value: 150000, acquisitionDate: "2021-09-01", nextReviewDate: "2025-03-01" },
    { assetId: "AST-032", name: "Accounting Software", assetType: "Software", department: "Finance", classification: "Critical", category: "Software", subCategory: "Enterprise Application", group: "Finance", sensitivity: "Restricted", lifecycle: "Active", owner: "james.anderson", custodian: "david.jones", location: "On-Premise", value: 85000, acquisitionDate: "2021-10-01", nextReviewDate: "2025-04-01" },
    { assetId: "AST-033", name: "Finance Database Server", assetType: "Software", department: "Finance", classification: "Critical", category: "Software", subCategory: "Database", group: "Finance", sensitivity: "Restricted", lifecycle: "Active", owner: "james.anderson", custodian: "david.jones", location: "On-Premise", value: 70000, acquisitionDate: "2021-11-01", nextReviewDate: "2025-05-01" },

    // Backup & Disaster Recovery
    { assetId: "AST-034", name: "DR Site Storage", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Storage Device", group: "Backup & Disaster Recovery", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "DR Site", value: 120000, acquisitionDate: "2022-01-15", nextReviewDate: "2025-07-15" },
    { assetId: "AST-035", name: "Backup Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Backup & Disaster Recovery", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "DR Site", value: 65000, acquisitionDate: "2022-02-01", nextReviewDate: "2025-08-01" },
    { assetId: "AST-036", name: "Backup & Recovery Software", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "Backup Software", group: "Backup & Disaster Recovery", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Multi-Site", value: 45000, acquisitionDate: "2022-03-01", nextReviewDate: "2025-09-01" },
  ];

  for (const asset of assets) {
    // Use findFirst to check if asset exists for this customer
    const existing = await prisma.asset.findFirst({
      where: { customerAccountId, assetId: asset.assetId },
    });
    if (!existing) {
      await prisma.asset.create({
        data: {
          customerAccountId,
          assetId: asset.assetId,
          name: asset.name,
          assetType: asset.assetType,
          departmentId: createdDepts[asset.department],
          classificationId: createdClassifications[asset.classification],
          categoryId: createdAssetCategories[asset.category],
          subCategoryId: createdAssetSubCategories[asset.subCategory],
          groupId: createdAssetGroups[asset.group],
          sensitivityId: createdSensitivities[asset.sensitivity],
          lifecycleStatusId: createdLifecycleStatuses[asset.lifecycle],
          ownerId: createdUsers[asset.owner],
          custodianId: createdUsers[asset.custodian],
          location: asset.location,
          value: asset.value,
          acquisitionDate: new Date(asset.acquisitionDate),
          nextReviewDate: new Date(asset.nextReviewDate),
          status: "Active",
        },
      });
    }
  }
  console.log("✅ Assets created");

  // ==================== RISK MANAGEMENT MODULE ====================

  // ==================== RISK SETTINGS ====================

  // Create Vulnerability Categories
  const vulnerabilityCategories = [
    { name: "Technical" },
    { name: "Operational" },
    { name: "Physical" },
    { name: "Administrative" },
    { name: "Environmental" },
  ];
  const createdVulnCategories: { [key: string]: string } = {};

  for (const cat of vulnerabilityCategories) {
    const existing = await prisma.vulnerabilityCategory.findFirst({
      where: { name: cat.name, customerAccountId: null },
    });
    if (existing) {
      createdVulnCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.vulnerabilityCategory.create({
        data: { ...cat },
      });
      createdVulnCategories[cat.name] = created.id;
    }
  }
  console.log("✅ Vulnerability Categories created");

  // Create Threat Categories
  const threatCategories = [
    { name: "Cyber Threats" },
    { name: "Physical Threats" },
    { name: "Environmental Threats" },
    { name: "Human Threats" },
    { name: "Technical Threats" },
  ];
  const createdThreatCategories: { [key: string]: string } = {};

  for (const cat of threatCategories) {
    const existing = await prisma.threatCategory.findFirst({
      where: { name: cat.name, customerAccountId: null },
    });
    if (existing) {
      createdThreatCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.threatCategory.create({
        data: { ...cat },
      });
      createdThreatCategories[cat.name] = created.id;
    }
  }
  console.log("✅ Threat Categories created");

  // Create Control Strength
  const controlStrengths = [
    { name: "None", score: 0 },
    { name: "Weak", score: 1 },
    { name: "Moderate", score: 2 },
    { name: "Strong", score: 3 },
    { name: "Very Strong", score: 4 },
  ];

  for (const cs of controlStrengths) {
    const existing = await prisma.controlStrength.findFirst({
      where: { name: cs.name, customerAccountId: null },
    });
    if (!existing) {
      await prisma.controlStrength.create({
        data: { ...cs },
      });
    }
  }
  console.log("✅ Control Strengths created");

  // Create Risk Likelihood
  const riskLikelihoods = [
    { title: "Rare", score: 1, timeFrame: "Once in 10+ years", probability: "<5%" },
    { title: "Unlikely", score: 2, timeFrame: "Once in 5-10 years", probability: "5-20%" },
    { title: "Possible", score: 3, timeFrame: "Once in 2-5 years", probability: "20-50%" },
    { title: "Likely", score: 4, timeFrame: "Once in 1-2 years", probability: "50-80%" },
    { title: "Almost Certain", score: 5, timeFrame: "Within 1 year", probability: ">80%" },
  ];

  for (const likelihood of riskLikelihoods) {
    const existing = await prisma.riskLikelihood.findFirst({
      where: { title: likelihood.title, customerAccountId: null },
    });
    if (!existing) {
      await prisma.riskLikelihood.create({
        data: { ...likelihood },
      });
    }
  }
  console.log("✅ Risk Likelihoods created");

  // Create Impact Categories
  const impactCategories = [
    { name: "Financial" },
    { name: "Operational" },
    { name: "Reputational" },
    { name: "Legal/Regulatory" },
    { name: "Safety" },
    { name: "Strategic" },
  ];

  for (const cat of impactCategories) {
    const existing = await prisma.impactCategory.findFirst({
      where: { name: cat.name, customerAccountId: null },
    });
    if (!existing) {
      await prisma.impactCategory.create({
        data: { ...cat },
      });
    }
  }
  console.log("✅ Impact Categories created");

  // Create Impact Ratings
  const impactRatings = [
    { name: "Negligible", score: 1, description: "Minimal impact on operations, finances, or reputation" },
    { name: "Minor", score: 2, description: "Limited impact with minor disruption or loss" },
    { name: "Moderate", score: 3, description: "Noticeable impact requiring management attention" },
    { name: "Major", score: 4, description: "Significant impact affecting business objectives" },
    { name: "Catastrophic", score: 5, description: "Severe impact threatening business viability" },
  ];

  for (const rating of impactRatings) {
    const existing = await prisma.impactRating.findFirst({
      where: { name: rating.name, customerAccountId: null },
    });
    if (!existing) {
      await prisma.impactRating.create({
        data: { ...rating },
      });
    }
  }
  console.log("✅ Impact Ratings created");

  // Create Vulnerability Ratings
  const vulnerabilityRatings = [
    { label: "Very Low", score: 1 },
    { label: "Low", score: 2 },
    { label: "Medium", score: 3 },
    { label: "High", score: 4 },
    { label: "Critical", score: 5 },
  ];

  for (const rating of vulnerabilityRatings) {
    const existing = await prisma.vulnerabilityRating.findFirst({
      where: { label: rating.label, customerAccountId: null },
    });
    if (!existing) {
      await prisma.vulnerabilityRating.create({
        data: { ...rating },
      });
    }
  }
  console.log("✅ Vulnerability Ratings created");

  // Create Risk Sub Categories
  const riskSubCategories = [
    { type: "Information Security" },
    { type: "Business Continuity" },
    { type: "Vendor Management" },
    { type: "Data Privacy" },
    { type: "Infrastructure" },
    { type: "Application Security" },
    { type: "Network Security" },
    { type: "Physical Security" },
    { type: "Human Resources" },
    { type: "Legal & Compliance" },
  ];

  for (const subCat of riskSubCategories) {
    const existing = await prisma.riskSubCategory.findFirst({
      where: { type: subCat.type, customerAccountId: null },
    });
    if (!existing) {
      await prisma.riskSubCategory.create({
        data: { ...subCat },
      });
    }
  }
  console.log("✅ Risk Sub Categories created");

  // Create Risk Ranges (for Risk Methodology)
  const riskRanges = [
    { title: "Low", color: "#22c55e", lowRange: 1, highRange: 4, timelineDays: 90, description: "Low risk - monitor and manage as part of routine operations" },
    { title: "Medium", color: "#f59e0b", lowRange: 5, highRange: 9, timelineDays: 60, description: "Medium risk - requires attention and planned mitigation actions" },
    { title: "High", color: "#f97316", lowRange: 10, highRange: 16, timelineDays: 30, description: "High risk - requires priority attention and immediate action planning" },
    { title: "Critical", color: "#ef4444", lowRange: 17, highRange: 25, timelineDays: 7, description: "Critical risk - requires immediate executive attention and urgent action" },
  ];

  for (const range of riskRanges) {
    const existing = await prisma.riskRange.findFirst({
      where: { title: range.title, customerAccountId: null },
    });
    if (!existing) {
      await prisma.riskRange.create({
        data: { ...range },
      });
    }
  }
  console.log("✅ Risk Ranges created");

  // Create Risk Score Config (default configuration)
  const existingConfig = await prisma.riskScoreConfig.findFirst({
    where: { customerAccountId: null },
  });
  if (!existingConfig) {
    await prisma.riskScoreConfig.create({
      data: {
        useLikelihood: true,
        useImpact: true,
        useAssetScore: false,
        useVulnerabilityScore: false,
        riskTolerance: 10,
      },
    });
  }
  console.log("✅ Risk Score Config created");

  // ==================== END RISK SETTINGS ====================

  // Create Risk Categories
  const riskCategories = [
    { name: "Strategic", description: "Risks affecting strategic objectives", color: "#3b82f6" },
    { name: "Operational", description: "Risks in day-to-day operations", color: "#10b981" },
    { name: "Financial", description: "Risks impacting financial performance", color: "#f59e0b" },
    { name: "Compliance", description: "Regulatory and legal compliance risks", color: "#8b5cf6" },
    { name: "IT/Cyber", description: "Technology and cybersecurity risks", color: "#ef4444" },
    { name: "Reputational", description: "Risks to brand and reputation", color: "#ec4899" },
  ];
  const createdRiskCategories: { [key: string]: string } = {};

  for (const cat of riskCategories) {
    // RiskCategory is shared master data (no customerAccountId)
    const existing = await prisma.riskCategory.findFirst({
      where: { name: cat.name },
    });
    if (existing) {
      createdRiskCategories[cat.name] = existing.id;
    } else {
      const category = await prisma.riskCategory.create({
        data: { ...cat },
      });
      createdRiskCategories[cat.name] = category.id;
    }
  }
  console.log("✅ Risk Categories created");

  // Create Risk Types (static: Asset Risk and Process Risk)
  const riskTypes = [
    { name: "Asset Risk", description: "Risk associated with impacted assets from Asset Inventory" },
    { name: "Process Risk", description: "Risk associated with impacted processes from Process Repository" },
  ];
  const createdRiskTypes: { [key: string]: string } = {};

  for (const type of riskTypes) {
    // RiskType is shared master data (no customerAccountId)
    const existing = await prisma.riskType.findFirst({
      where: { name: type.name },
    });
    if (existing) {
      createdRiskTypes[type.name] = existing.id;
    } else {
      const created = await prisma.riskType.create({
        data: { name: type.name, description: type.description },
      });
      createdRiskTypes[type.name] = created.id;
    }
  }
  console.log("✅ Risk Types created");

  // Create Risk Threats (with category linking)
  const threats = [
    { name: "Cyber Attack", description: "Malicious cyber intrusion or attack", category: "Cyber Threats" },
    { name: "Natural Disaster", description: "Earthquakes, floods, hurricanes, etc.", category: "Environmental Threats" },
    { name: "Human Error", description: "Mistakes or negligence by employees", category: "Human Threats" },
    { name: "System Failure", description: "Hardware or software malfunction", category: "Technical Threats" },
    { name: "Third-Party Failure", description: "Vendor or partner service disruption", category: "Technical Threats" },
    { name: "Data Theft", description: "Unauthorized access to sensitive data", category: "Cyber Threats" },
    { name: "Malware", description: "Viruses, ransomware, and other malicious software", category: "Cyber Threats" },
    { name: "Phishing", description: "Social engineering attacks via email", category: "Cyber Threats" },
    { name: "Insider Threat", description: "Malicious actions by internal actors", category: "Human Threats" },
    { name: "Supply Chain Attack", description: "Compromise through supply chain", category: "Cyber Threats" },
    { name: "Fire", description: "Fire damage to facilities or equipment", category: "Physical Threats" },
    { name: "Theft", description: "Physical theft of assets or equipment", category: "Physical Threats" },
    { name: "Power Outage", description: "Loss of electrical power", category: "Environmental Threats" },
    { name: "Vandalism", description: "Intentional damage to property", category: "Physical Threats" },
    { name: "Social Engineering", description: "Manipulation of individuals to gain access", category: "Human Threats" },
  ];
  const createdThreats: { [key: string]: string } = {};

  for (const threat of threats) {
    // RiskThreat is shared master data (no customerAccountId)
    const existing = await prisma.riskThreat.findFirst({
      where: { name: threat.name },
    });
    if (existing) {
      createdThreats[threat.name] = existing.id;
    } else {
      const created = await prisma.riskThreat.create({
        data: {
          name: threat.name,
          description: threat.description,
          categoryId: createdThreatCategories[threat.category],
        },
      });
      createdThreats[threat.name] = created.id;
    }
  }
  console.log("✅ Risk Threats created");

  // Create Risk Vulnerabilities (with category linking)
  const vulnerabilities = [
    { name: "Weak Authentication", description: "Insufficient password policies or MFA", category: "Technical" },
    { name: "Unpatched Systems", description: "Systems without latest security patches", category: "Technical" },
    { name: "Misconfiguration", description: "Incorrectly configured systems or services", category: "Technical" },
    { name: "Lack of Encryption", description: "Data not encrypted at rest or in transit", category: "Technical" },
    { name: "Poor Access Controls", description: "Excessive or improper access rights", category: "Administrative" },
    { name: "Inadequate Logging", description: "Insufficient audit trails and monitoring", category: "Operational" },
    { name: "Legacy Systems", description: "Outdated systems lacking security updates", category: "Technical" },
    { name: "Missing Backups", description: "Insufficient or untested backup procedures", category: "Operational" },
    { name: "Untrained Staff", description: "Employees lacking security awareness", category: "Administrative" },
    { name: "Shadow IT", description: "Unauthorized technology usage", category: "Operational" },
    { name: "Inadequate Physical Security", description: "Insufficient physical access controls", category: "Physical" },
    { name: "No Disaster Recovery Plan", description: "Missing or untested disaster recovery procedures", category: "Operational" },
    { name: "Single Point of Failure", description: "Critical systems without redundancy", category: "Technical" },
    { name: "Lack of Segmentation", description: "Network without proper segmentation", category: "Technical" },
    { name: "Insufficient Monitoring", description: "Lack of real-time security monitoring", category: "Operational" },
    { name: "Environmental Exposure", description: "Exposure to environmental hazards", category: "Environmental" },
    { name: "Outdated Policies", description: "Security policies not updated regularly", category: "Administrative" },
  ];
  const createdVulnerabilities: { [key: string]: string } = {};

  for (const vuln of vulnerabilities) {
    // RiskVulnerability is shared master data (no customerAccountId)
    const existing = await prisma.riskVulnerability.findFirst({
      where: { name: vuln.name },
    });
    if (existing) {
      createdVulnerabilities[vuln.name] = existing.id;
    } else {
      const created = await prisma.riskVulnerability.create({
        data: {
          name: vuln.name,
          description: vuln.description,
          categoryId: createdVulnCategories[vuln.category],
        },
      });
      createdVulnerabilities[vuln.name] = created.id;
    }
  }
  console.log("✅ Risk Vulnerabilities created");

  // Create Risk Causes
  const causes = [
    { name: "Budget Constraints", description: "Insufficient funding for security measures" },
    { name: "Skills Gap", description: "Lack of qualified security personnel" },
    { name: "Process Gaps", description: "Missing or ineffective processes" },
    { name: "Technology Limitations", description: "Outdated or insufficient technology" },
    { name: "Regulatory Changes", description: "New or changing regulatory requirements" },
    { name: "Market Conditions", description: "Economic or market pressures" },
    { name: "Organizational Changes", description: "Mergers, restructuring, or growth" },
    { name: "Third-Party Dependencies", description: "Reliance on external parties" },
  ];

  for (const cause of causes) {
    // RiskCause is shared master data (no customerAccountId)
    const existing = await prisma.riskCause.findFirst({
      where: { name: cause.name },
    });
    if (!existing) {
      await prisma.riskCause.create({
        data: { ...cause },
      });
    }
  }
  console.log("✅ Risk Causes created");

  // Create Risks with enhanced data
  // Status: Awaiting Approval, Pending Assessment, Open, In Progress, Closed
  // Strategy: Treat, Transfer, Avoid, Accept
  const risks = [
    { riskId: "RID001", name: "Data Breach Risk", description: "Risk of unauthorized access to sensitive customer and business data", category: "IT/Cyber", department: "IT Operations", likelihood: 4, impact: 5, status: "Open", responseStrategy: "Treat" },
    { riskId: "RID002", name: "Regulatory Non-Compliance", description: "Failure to comply with GDPR, PCI-DSS, and other regulations", category: "Compliance", department: "Compliance", likelihood: 3, impact: 4, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RID003", name: "Vendor Dependency", description: "Over-reliance on critical third-party vendors", category: "Operational", department: "Procurement", likelihood: 3, impact: 3, status: "Pending Assessment", responseStrategy: "Transfer" },
    { riskId: "RID004", name: "Market Competition", description: "Increased competition affecting market share", category: "Strategic", department: "Revenue", likelihood: 4, impact: 3, status: "Open", responseStrategy: "Accept" },
    { riskId: "RID005", name: "Talent Retention", description: "Difficulty retaining key technical talent", category: "Operational", department: "Human Resources", likelihood: 3, impact: 3, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RID006", name: "System Failure", description: "Critical system downtime affecting operations", category: "IT/Cyber", department: "IT Operations", likelihood: 3, impact: 5, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RID007", name: "Financial Loss", description: "Unexpected financial losses from operations", category: "Financial", department: "Revenue", likelihood: 2, impact: 4, status: "Awaiting Approval", responseStrategy: null },
    { riskId: "RID008", name: "Reputation Damage", description: "Negative publicity affecting brand value", category: "Reputational", department: "Operations", likelihood: 2, impact: 5, status: "Pending Assessment", responseStrategy: null },
    { riskId: "RID009", name: "Supply Chain Disruption", description: "Interruption in supply chain operations", category: "Operational", department: "Procurement", likelihood: 3, impact: 3, status: "Open", responseStrategy: "Avoid" },
    { riskId: "RID010", name: "Insider Threat", description: "Malicious or negligent actions by employees", category: "IT/Cyber", department: "IT Operations", likelihood: 2, impact: 4, status: "Closed", responseStrategy: "Treat" },
    { riskId: "RID011", name: "Cloud Security", description: "Security vulnerabilities in cloud infrastructure", category: "IT/Cyber", department: "IT Operations", likelihood: 3, impact: 4, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RID012", name: "Business Continuity", description: "Inability to recover from major disruptions", category: "Operational", department: "Operations", likelihood: 2, impact: 5, status: "Awaiting Approval", responseStrategy: null },
  ];

  const createdRisks: { [key: string]: string } = {};
  for (const risk of risks) {
    const riskScore = risk.likelihood * risk.impact;
    // Rating: Catastrophic, Very high, High, Low Risk (matching website)
    let riskRating = "Low Risk";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very high";
    else if (riskScore >= 10) riskRating = "High";

    // Use findFirst to check if risk exists for this customer
    const existing = await prisma.risk.findFirst({
      where: { customerAccountId, riskId: risk.riskId },
    });
    if (existing) {
      createdRisks[risk.riskId] = existing.id;
    } else {
      const created = await prisma.risk.create({
        data: {
          customerAccountId,
          riskId: risk.riskId,
          name: risk.name,
          description: risk.description,
          categoryId: createdRiskCategories[risk.category],
          departmentId: createdDepts[risk.department],
          ownerId: createdUsers["mike.wilson"],
          likelihood: risk.likelihood,
          impact: risk.impact,
          riskScore,
          riskRating,
          status: risk.status,
          responseStrategy: risk.responseStrategy,
          inherentLikelihood: risk.likelihood + 1 > 5 ? 5 : risk.likelihood + 1,
          inherentImpact: risk.impact,
          inherentRiskScore: (risk.likelihood + 1 > 5 ? 5 : risk.likelihood + 1) * risk.impact,
          residualLikelihood: risk.likelihood,
          residualImpact: risk.impact,
          residualRiskScore: riskScore,
          treatmentPlan: risk.responseStrategy ? `Implement controls to ${risk.responseStrategy === "Treat" ? "treat" : risk.responseStrategy.toLowerCase()} the risk` : null,
          treatmentDueDate: risk.responseStrategy ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null,
        },
      });
      createdRisks[risk.riskId] = created.id;
    }
  }
  console.log("✅ Risks created");

  // Create Risk-Threat mappings
  const riskThreatMappings = [
    { riskId: "RID001", threats: ["Cyber Attack", "Data Theft", "Malware", "Phishing"] },
    { riskId: "RID006", threats: ["System Failure", "Natural Disaster"] },
    { riskId: "RID010", threats: ["Insider Threat", "Data Theft"] },
    { riskId: "RID011", threats: ["Cyber Attack", "Malware", "Misconfiguration"] },
  ];

  for (const mapping of riskThreatMappings) {
    for (const threatName of mapping.threats) {
      if (createdRisks[mapping.riskId] && createdThreats[threatName]) {
        await prisma.riskThreatMapping.create({
          data: {
            riskId: createdRisks[mapping.riskId],
            threatId: createdThreats[threatName],
          },
        });
      }
    }
  }
  console.log("✅ Risk-Threat mappings created");

  // Create Risk-Vulnerability mappings
  const riskVulnMappings = [
    { riskId: "RID001", vulns: ["Weak Authentication", "Poor Access Controls", "Lack of Encryption"] },
    { riskId: "RID006", vulns: ["Unpatched Systems", "Legacy Systems", "Missing Backups"] },
    { riskId: "RID010", vulns: ["Poor Access Controls", "Inadequate Logging", "Untrained Staff"] },
    { riskId: "RID011", vulns: ["Misconfiguration", "Unpatched Systems", "Shadow IT"] },
  ];

  for (const mapping of riskVulnMappings) {
    for (const vulnName of mapping.vulns) {
      if (createdRisks[mapping.riskId] && createdVulnerabilities[vulnName]) {
        await prisma.riskVulnerabilityMapping.create({
          data: {
            riskId: createdRisks[mapping.riskId],
            vulnerabilityId: createdVulnerabilities[vulnName],
          },
        });
      }
    }
  }
  console.log("✅ Risk-Vulnerability mappings created");

  // Create Risk Assessments
  const assessments = [
    { assessmentId: "RA-0001", riskId: "RID001", likelihood: 4, impact: 5, status: "Approved", date: "2025-01-15" },
    { assessmentId: "RA-0002", riskId: "RID006", likelihood: 3, impact: 5, status: "Approved", date: "2025-01-10" },
    { assessmentId: "RA-0003", riskId: "RID002", likelihood: 3, impact: 4, status: "Submitted", date: "2025-01-20" },
  ];

  for (const assessment of assessments) {
    const riskScore = assessment.likelihood * assessment.impact;
    let riskRating = "Low";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very High";
    else if (riskScore >= 10) riskRating = "High";
    else if (riskScore >= 5) riskRating = "Medium";

    // Use findFirst to check if risk assessment exists for this customer
    const existing = await prisma.riskAssessment.findFirst({
      where: { customerAccountId, assessmentId: assessment.assessmentId },
    });
    if (!existing) {
      await prisma.riskAssessment.create({
        data: {
          customerAccountId,
          assessmentId: assessment.assessmentId,
          riskId: createdRisks[assessment.riskId],
          assessmentType: "Periodic",
          assessorName: "Mike Wilson",
          likelihood: assessment.likelihood,
          impact: assessment.impact,
          riskScore,
          riskRating,
          status: assessment.status,
          assessmentDate: new Date(assessment.date),
          recommendations: "Continue monitoring and implementing controls",
        },
      });
    }
  }
  console.log("✅ Risk Assessments created");

  // Create Risk Responses
  // Response Type: Treat, Transfer, Avoid, Accept (matching website)
  const responses = [
    { responseId: "RR-0001", riskId: "RID001", responseType: "Treat", actionTitle: "Implement Multi-Factor Authentication", status: "In Progress", dueDate: "2025-03-01" },
    { responseId: "RR-0002", riskId: "RID001", responseType: "Treat", actionTitle: "Deploy Data Loss Prevention", status: "Open", dueDate: "2025-04-01" },
    { responseId: "RR-0003", riskId: "RID006", responseType: "Treat", actionTitle: "Implement High Availability", status: "In Progress", dueDate: "2025-02-15" },
    { responseId: "RR-0004", riskId: "RID010", responseType: "Treat", actionTitle: "Enhanced Access Monitoring", status: "Completed", dueDate: "2025-01-15" },
  ];

  for (const response of responses) {
    // Use findFirst to check if risk response exists for this customer
    const existing = await prisma.riskResponse.findFirst({
      where: { customerAccountId, responseId: response.responseId },
    });
    if (!existing) {
      await prisma.riskResponse.create({
        data: {
          customerAccountId,
          responseId: response.responseId,
          riskId: createdRisks[response.riskId],
          responseType: response.responseType,
          actionTitle: response.actionTitle,
          actionDescription: `Action to ${response.responseType === "Treat" ? "treat" : response.responseType.toLowerCase()} the risk`,
          assignee: "Mike Wilson",
          status: response.status,
          dueDate: new Date(response.dueDate),
          completionDate: response.status === "Completed" ? new Date() : null,
        },
      });
    }
  }
  console.log("✅ Risk Responses created");

  // ==================== INTERNAL AUDIT MODULE ====================

  // Create Audits
  const audits = [
    { auditId: "AUD-001", name: "IT Security Audit Q1", auditType: "Internal", department: "IT Operations", status: "Completed", startDate: "2025-01-15", endDate: "2025-02-15" },
    { auditId: "AUD-002", name: "Compliance Review Q1", auditType: "Internal", department: "Compliance", status: "In Progress", startDate: "2025-02-01", endDate: "2025-03-01" },
    { auditId: "AUD-003", name: "HR Process Audit", auditType: "Internal", department: "Human Resources", status: "Planned", startDate: "2025-03-01", endDate: "2025-03-31" },
    { auditId: "AUD-004", name: "Financial Controls Audit", auditType: "External", department: "Revenue", status: "Planned", startDate: "2025-04-01", endDate: "2025-04-30" },
    { auditId: "AUD-005", name: "Vendor Management Audit", auditType: "Internal", department: "Procurement", status: "Planned", startDate: "2025-05-01", endDate: "2025-05-31" },
  ];

  const createdAudits: { [key: string]: string } = {};
  for (const audit of audits) {
    // Use findFirst to check if audit exists for this customer
    const existing = await prisma.audit.findFirst({
      where: { customerAccountId, auditId: audit.auditId },
    });
    if (existing) {
      createdAudits[audit.auditId] = existing.id;
    } else {
      const created = await prisma.audit.create({
        data: {
          customerAccountId,
          auditId: audit.auditId,
          name: audit.name,
          auditType: audit.auditType,
          departmentId: createdDepts[audit.department],
          auditorId: createdUsers["sarah.smith"],
          status: audit.status,
          startDate: new Date(audit.startDate),
          endDate: new Date(audit.endDate),
        },
      });
      createdAudits[audit.auditId] = created.id;
    }
  }
  console.log("✅ Audits created");

  // Create Audit Findings
  const findings = [
    { findingId: "FND-001", title: "Weak Password Policy", auditId: "AUD-001", severity: "High", status: "Open" },
    { findingId: "FND-002", title: "Missing Access Logs", auditId: "AUD-001", severity: "Medium", status: "In Progress" },
    { findingId: "FND-003", title: "Outdated Security Training", auditId: "AUD-001", severity: "Low", status: "Closed" },
    { findingId: "FND-004", title: "Incomplete Documentation", auditId: "AUD-002", severity: "Medium", status: "Open" },
    { findingId: "FND-005", title: "Non-Compliant Vendor", auditId: "AUD-002", severity: "High", status: "Open" },
  ];

  const createdFindings: { [key: string]: string } = {};
  for (const finding of findings) {
    // Use findFirst to check if audit finding exists for this customer
    const existing = await prisma.auditFinding.findFirst({
      where: { customerAccountId, findingId: finding.findingId },
    });
    if (existing) {
      createdFindings[finding.findingId] = existing.id;
    } else {
      const created = await prisma.auditFinding.create({
        data: {
          customerAccountId,
          findingId: finding.findingId,
          title: finding.title,
          auditId: createdAudits[finding.auditId],
          severity: finding.severity,
          status: finding.status,
        },
      });
      createdFindings[finding.findingId] = created.id;
    }
  }
  console.log("✅ Audit Findings created");

  // Create CAPAs
  const capas = [
    { capaId: "CAPA-001", title: "Implement Strong Password Policy", findingId: "FND-001", actionType: "Corrective", status: "In Progress", dueDate: "2025-02-28" },
    { capaId: "CAPA-002", title: "Enable Access Logging", findingId: "FND-002", actionType: "Corrective", status: "Open", dueDate: "2025-03-15" },
    { capaId: "CAPA-003", title: "Update Security Training Program", findingId: "FND-003", actionType: "Preventive", status: "Closed", dueDate: "2025-01-31" },
    { capaId: "CAPA-004", title: "Complete Process Documentation", findingId: "FND-004", actionType: "Corrective", status: "Open", dueDate: "2025-03-31" },
    { capaId: "CAPA-005", title: "Vendor Compliance Review", findingId: "FND-005", actionType: "Corrective", status: "Open", dueDate: "2025-04-15" },
  ];

  for (const capa of capas) {
    // Use findFirst to check if CAPA exists for this customer
    const existing = await prisma.cAPA.findFirst({
      where: { customerAccountId, capaId: capa.capaId },
    });
    if (!existing) {
      await prisma.cAPA.create({
        data: {
          customerAccountId,
          capaId: capa.capaId,
          title: capa.title,
          findingId: createdFindings[capa.findingId],
          actionType: capa.actionType,
          status: capa.status,
          dueDate: new Date(capa.dueDate),
        },
      });
    }
  }
  console.log("✅ CAPAs created");

  // ==================== LINK CONTROLS TO RISKS ====================

  // Fetch all controls and risks to link them
  const allControls = await prisma.control.findMany({ take: 20 });
  const allRisks = await prisma.risk.findMany();

  // Create Control-Risk linkages for better Risk Compliance Matrix visualization
  const controlRiskLinks = [
    // RSK-001: Data Breach Risk - link to security-related controls
    { riskId: "RSK-001", controlIndices: [0, 1, 4, 5, 18, 19] },
    // RSK-002: Regulatory Non-Compliance - link to compliance controls
    { riskId: "RSK-002", controlIndices: [0, 1, 2, 6, 7] },
    // RSK-003: Vendor Dependency - link to third-party controls
    { riskId: "RSK-003", controlIndices: [14, 15] },
    // RSK-004: Market Competition - link to strategic controls
    { riskId: "RSK-004", controlIndices: [6, 7] },
    // RSK-005: Talent Retention - link to HR controls
    { riskId: "RSK-005", controlIndices: [9, 10, 11] },
    // RSK-006: System Failure - link to IT controls
    { riskId: "RSK-006", controlIndices: [12, 13, 16, 17] },
    // RSK-007: Financial Loss - link to financial controls
    { riskId: "RSK-007", controlIndices: [6, 7, 8] },
    // RSK-008: Reputation Damage - link to communication controls
    { riskId: "RSK-008", controlIndices: [3, 4, 15, 16] },
    // RSK-009: Supply Chain Disruption - link to vendor controls
    { riskId: "RSK-009", controlIndices: [14, 15] },
    // RSK-010: Insider Threat - link to access controls
    { riskId: "RSK-010", controlIndices: [9, 10, 11, 18, 19] },
  ];

  for (const link of controlRiskLinks) {
    const risk = allRisks.find(r => r.riskId === link.riskId);
    if (risk) {
      for (const idx of link.controlIndices) {
        if (allControls[idx]) {
          await prisma.controlRisk.upsert({
            where: {
              controlId_riskId: {
                controlId: allControls[idx].id,
                riskId: risk.id,
              },
            },
            update: {},
            create: {
              controlId: allControls[idx].id,
              riskId: risk.id,
            },
          });
        }
      }
    }
  }
  console.log("✅ Control-Risk links created for Risk Compliance Matrix");

  // ==================== ARTIFACTS ====================

  // Create Artifacts for Evidence Management
  const artifacts = [
    {
      artifactCode: "ART-001",
      name: "Access Control Logs Q4 2024",
      fileName: "access_control_logs_q4_2024.pdf",
      fileType: "pdf",
      fileSize: 2048576,
      filePath: "/uploads/artifacts/access_control_logs_q4_2024.pdf",
      uploadedBy: "john.doe",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 92.5,
      aiReviewNotes: "Document meets all compliance requirements. Well-structured access logs with proper timestamps and user identifiers."
    },
    {
      artifactCode: "ART-002",
      name: "Security Training Completion Report",
      fileName: "security_training_report_2024.xlsx",
      fileType: "xlsx",
      fileSize: 524288,
      filePath: "/uploads/artifacts/security_training_report_2024.xlsx",
      uploadedBy: "emily.brown",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 88.0,
      aiReviewNotes: "Training records are comprehensive. Minor recommendation: Include refresher training dates."
    },
    {
      artifactCode: "ART-003",
      name: "Firewall Configuration Export",
      fileName: "firewall_config_jan2025.txt",
      fileType: "txt",
      fileSize: 102400,
      filePath: "/uploads/artifacts/firewall_config_jan2025.txt",
      uploadedBy: "david.jones",
      aiReviewStatus: "Pending",
      aiReviewScore: null,
      aiReviewNotes: null
    },
    {
      artifactCode: "ART-004",
      name: "Vulnerability Scan Report",
      fileName: "vulnerability_scan_dec2024.pdf",
      fileType: "pdf",
      fileSize: 4194304,
      filePath: "/uploads/artifacts/vulnerability_scan_dec2024.pdf",
      uploadedBy: "mike.wilson",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 75.5,
      aiReviewNotes: "Report shows 3 critical vulnerabilities pending remediation. Recommend prioritizing patch deployment."
    },
    {
      artifactCode: "ART-005",
      name: "Data Processing Agreement - Vendor A",
      fileName: "dpa_vendor_a_2025.docx",
      fileType: "docx",
      fileSize: 358400,
      filePath: "/uploads/artifacts/dpa_vendor_a_2025.docx",
      uploadedBy: "john.doe",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 95.0,
      aiReviewNotes: "Agreement meets GDPR requirements. All mandatory clauses present."
    },
    {
      artifactCode: "ART-006",
      name: "Backup Verification Log",
      fileName: "backup_verification_jan2025.csv",
      fileType: "csv",
      fileSize: 81920,
      filePath: "/uploads/artifacts/backup_verification_jan2025.csv",
      uploadedBy: "david.jones",
      aiReviewStatus: "Pending",
      aiReviewScore: null,
      aiReviewNotes: null
    },
    {
      artifactCode: "ART-007",
      name: "Risk Assessment Summary",
      fileName: "risk_assessment_q4_2024.pdf",
      fileType: "pdf",
      fileSize: 1536000,
      filePath: "/uploads/artifacts/risk_assessment_q4_2024.pdf",
      uploadedBy: "mike.wilson",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 89.0,
      aiReviewNotes: "Comprehensive risk assessment covering all critical assets. Treatment plans well documented."
    },
    {
      artifactCode: "ART-008",
      name: "Incident Response Drill Report",
      fileName: "ir_drill_report_dec2024.pdf",
      fileType: "pdf",
      fileSize: 2097152,
      filePath: "/uploads/artifacts/ir_drill_report_dec2024.pdf",
      uploadedBy: "sarah.smith",
      aiReviewStatus: "Reviewed",
      aiReviewScore: 82.0,
      aiReviewNotes: "Drill completed successfully. Response time within acceptable limits. Some communication gaps noted."
    },
  ];

  for (const artifact of artifacts) {
    // Use findFirst to check if artifact exists for this customer
    const existing = await prisma.artifact.findFirst({
      where: { customerAccountId, artifactCode: artifact.artifactCode },
    });
    if (!existing) {
      await prisma.artifact.create({
        data: {
          customerAccountId,
          artifactCode: artifact.artifactCode,
          name: artifact.name,
          fileName: artifact.fileName,
          fileType: artifact.fileType,
          fileSize: artifact.fileSize,
          filePath: artifact.filePath,
          uploadedById: createdUsers[artifact.uploadedBy],
          aiReviewStatus: artifact.aiReviewStatus,
          aiReviewScore: artifact.aiReviewScore,
          aiReviewNotes: artifact.aiReviewNotes,
        },
      });
    }
  }
  console.log("✅ Artifacts created");

  // ==================== INTERNAL AUDIT SETTINGS ====================
  // NOTE: Audit settings dummy data removed - only User Management data is kept
  // Users can add their own Categories, Types, Periodicity, Nature of Controls, etc. through the UI

  // // Audit Categories
  // const auditCategories = [
  //   "Financial Audit",
  //   "Operational Audit",
  //   "Compliance Audit",
  //   "IT Audit",
  //   "Performance Audit",
  //   "Management Audit",
  //   "Special Investigation",
  // ];

  // for (const name of auditCategories) {
  //   // AuditCategory is shared master data (no customerAccountId)
  //   const existing = await prisma.auditCategory.findFirst({
  //     where: { name },
  //   });
  //   if (!existing) {
  //     await prisma.auditCategory.create({
  //       data: { name },
  //     });
  //   }
  // }
  // console.log("✅ Audit Categories created");

  // // Nature of Controls
  // const natureOfControls = [
  //   "Preventive",
  //   "Detective",
  //   "Corrective",
  //   "Directive",
  //   "Compensating",
  // ];

  // for (const label of natureOfControls) {
  //   // AuditNatureOfControl is shared master data (no customerAccountId)
  //   const existing = await prisma.auditNatureOfControl.findFirst({
  //     where: { label },
  //   });
  //   if (!existing) {
  //     await prisma.auditNatureOfControl.create({
  //       data: { label },
  //     });
  //   }
  // }
  // console.log("✅ Nature of Controls created");

  // // Risk Factors
  // const riskFactors = [
  //   "Financial Impact",
  //   "Regulatory Compliance",
  //   "Operational Efficiency",
  //   "Reputational Risk",
  //   "Strategic Alignment",
  //   "Data Security",
  //   "Business Continuity",
  // ];

  // for (const label of riskFactors) {
  //   // AuditRiskFactor is shared master data (no customerAccountId)
  //   const existing = await prisma.auditRiskFactor.findFirst({
  //     where: { label },
  //   });
  //   if (!existing) {
  //     await prisma.auditRiskFactor.create({
  //       data: { label },
  //     });
  //   }
  // }
  // console.log("✅ Risk Factors created");

  // // Probability Ratings
  // const probabilities = [
  //   { label: "Very Low", value: 1 },
  //   { label: "Low", value: 2 },
  //   { label: "Medium", value: 3 },
  //   { label: "High", value: 4 },
  //   { label: "Very High", value: 5 },
  // ];

  // for (const prob of probabilities) {
  //   // AuditProbability is shared master data (no customerAccountId)
  //   const existing = await prisma.auditProbability.findFirst({
  //     where: { label: prob.label },
  //   });
  //   if (!existing) {
  //     await prisma.auditProbability.create({
  //       data: { ...prob },
  //     });
  //   }
  // }
  // console.log("✅ Probability Ratings created");

  // // Impact Ratings
  // const impacts = [
  //   { label: "Insignificant", value: 1 },
  //   { label: "Minor", value: 2 },
  //   { label: "Moderate", value: 3 },
  //   { label: "Major", value: 4 },
  //   { label: "Catastrophic", value: 5 },
  // ];

  // for (const impact of impacts) {
  //   // AuditImpact is shared master data (no customerAccountId)
  //   const existing = await prisma.auditImpact.findFirst({
  //     where: { label: impact.label },
  //   });
  //   if (!existing) {
  //     await prisma.auditImpact.create({
  //       data: { ...impact },
  //     });
  //   }
  // }
  // console.log("✅ Impact Ratings created");

  // // Scoring Ranges
  // const scoringRanges = [
  //   { label: "Low", lowValue: 1, highValue: 6, calculationType: "Product of all" },
  //   { label: "Medium", lowValue: 7, highValue: 14, calculationType: "Product of all" },
  //   { label: "High", lowValue: 15, highValue: 20, calculationType: "Product of all" },
  //   { label: "Extreme", lowValue: 21, highValue: 25, calculationType: "Product of all" },
  // ];

  // for (const range of scoringRanges) {
  //   // AuditScoringRange is shared master data (no customerAccountId)
  //   const existing = await prisma.auditScoringRange.findFirst({
  //     where: { label: range.label, calculationType: range.calculationType },
  //   });
  //   if (!existing) {
  //     await prisma.auditScoringRange.create({
  //       data: { ...range },
  //     });
  //   }
  // }
  // console.log("✅ Scoring Ranges created");

  // // Scoring Configuration - shared master data (no customerAccountId)
  // const scoringConfigId = "scoring-config-default";
  // const existingScoringConfig = await prisma.auditScoringConfig.findFirst({
  //   where: { id: scoringConfigId },
  // });
  // if (!existingScoringConfig) {
  //   await prisma.auditScoringConfig.create({
  //     data: {
  //       id: scoringConfigId,
  //       probabilityImpactCalcType: "Product of all",
  //       riskRatingCalcType: "High of all",
  //     },
  //   });
  // }
  // console.log("✅ Scoring Configuration created");

  // // Periodicity
  // const periodicities = [
  //   { interval: "Annual", months: 12 },
  //   { interval: "Semiannual", months: 6 },
  //   { interval: "Quarterly", months: 3 },
  //   { interval: "Monthly", months: 1 },
  //   { interval: "Weekly", months: 0 },
  //   { interval: "Ad-hoc", months: 0 },
  // ];

  // for (const period of periodicities) {
  //   // AuditPeriodicity is shared master data (no customerAccountId)
  //   const existing = await prisma.auditPeriodicity.findFirst({
  //     where: { interval: period.interval },
  //   });
  //   if (!existing) {
  //     await prisma.auditPeriodicity.create({
  //       data: { ...period },
  //     });
  //   }
  // }
  // console.log("✅ Periodicity created");

  // // Escalation Configuration - shared master data (no customerAccountId)
  // const escalationConfigId = "escalation-config-default";
  // const existingEscalationConfig = await prisma.auditEscalationConfig.findFirst({
  //   where: { id: escalationConfigId },
  // });
  // if (!existingEscalationConfig) {
  //   await prisma.auditEscalationConfig.create({
  //     data: {
  //       id: escalationConfigId,
  //       responseSubmission: 5,
  //       acknowledgement: 1,
  //       clarification: 2,
  //       issueResolution: 3,
  //     },
  //   });
  // }
  // console.log("✅ Escalation Configuration created");

  // // Audit Types
  // const auditTypes = [
  //   "Assurance",
  //   "Consulting",
  //   "Follow-up",
  //   "Special Investigation",
  //   "Compliance Review",
  // ];

  // for (const name of auditTypes) {
  //   // AuditType is shared master data (no customerAccountId)
  //   const existing = await prisma.auditType.findFirst({
  //     where: { name },
  //   });
  //   if (!existing) {
  //     await prisma.auditType.create({
  //       data: { name },
  //     });
  //   }
  // }
  // console.log("✅ Audit Types created");

  // Processes for Audit Library
  const auditProcesses = [
    {
      processCode: "PRO1",
      name: "Accounts Payable Processing",
      description: "End-to-end accounts payable process including invoice receipt, verification, approval, and payment",
      processType: "Primary",
      department: "Revenue",
      owner: "james.anderson",
      processFrequency: "Daily",
      natureOfImplementation: "Manual + Automated",
      riskRating: "Medium",
      assetDependency: true,
      externalDependency: true,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "Medium",
    },
    {
      processCode: "PRO2",
      name: "Employee Onboarding",
      description: "Complete employee onboarding process from offer acceptance to first day",
      processType: "Supporting",
      department: "Human Resources",
      owner: "emily.brown",
      processFrequency: "As needed",
      natureOfImplementation: "Manual",
      riskRating: "Low",
      assetDependency: false,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: true,
      operationalComplexity: "Low",
    },
    {
      processCode: "PRO3",
      name: "IT Change Management",
      description: "Process for requesting, reviewing, approving, and implementing IT changes",
      processType: "Management",
      department: "IT Operations",
      owner: "bts.admin",
      processFrequency: "Weekly",
      natureOfImplementation: "Automated",
      riskRating: "High",
      assetDependency: true,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "High",
    },
    {
      processCode: "PRO4",
      name: "Vendor Risk Assessment",
      description: "Assessment of third-party vendors for security, compliance, and operational risks",
      processType: "Primary",
      department: "Risk Management",
      owner: "mike.wilson",
      processFrequency: "Quarterly",
      natureOfImplementation: "Manual",
      riskRating: "High",
      assetDependency: false,
      externalDependency: true,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "Medium",
    },
    {
      processCode: "PRO5",
      name: "Incident Response",
      description: "Process for identifying, containing, eradicating, and recovering from security incidents",
      processType: "Primary",
      department: "IT Support",
      owner: "david.jones",
      processFrequency: "As needed",
      natureOfImplementation: "Manual + Automated",
      riskRating: "High",
      assetDependency: true,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: true,
      operationalComplexity: "High",
    },
    {
      processCode: "PRO6",
      name: "Compliance Monitoring",
      description: "Continuous monitoring of regulatory compliance requirements and controls",
      processType: "Primary",
      department: "Compliance",
      owner: "john.doe",
      processFrequency: "Monthly",
      natureOfImplementation: "Automated",
      riskRating: "Medium",
      assetDependency: false,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "Medium",
    },
    {
      processCode: "PRO7",
      name: "Software Development Lifecycle",
      description: "End-to-end software development process from requirements to deployment",
      processType: "Primary",
      department: "Product Development",
      owner: "lisa.taylor",
      processFrequency: "Bi-annually",
      natureOfImplementation: "Manual + Automated",
      riskRating: "Medium",
      assetDependency: true,
      externalDependency: true,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "High",
    },
    {
      processCode: "PRO8",
      name: "Internal Audit Execution",
      description: "Planning, execution, and reporting of internal audit engagements",
      processType: "Management",
      department: "Internal Audit",
      owner: "sarah.smith",
      processFrequency: "Annually",
      natureOfImplementation: "Manual",
      riskRating: null,
      assetDependency: false,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "Medium",
    },
    {
      processCode: "PRO9",
      name: "Backup and Recovery",
      description: "Data backup and disaster recovery process for critical systems",
      processType: "Supporting",
      department: "IT Operations",
      owner: "bts.admin",
      processFrequency: "Daily",
      natureOfImplementation: "Automated",
      riskRating: "Low",
      assetDependency: true,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: true,
      operationalComplexity: "Low",
    },
    {
      processCode: "PRO10",
      name: "Quality Assurance Testing",
      description: "Testing process for software quality assurance",
      processType: "Primary",
      department: "Quality Assurance",
      owner: "lisa.taylor",
      processFrequency: "Weekly",
      natureOfImplementation: "Manual + Automated",
      riskRating: null,
      assetDependency: true,
      externalDependency: false,
      kpiMeasurementRequired: true,
      piiCapture: false,
      operationalComplexity: "Medium",
    },
  ];

  for (const proc of auditProcesses) {
    // Use findFirst to check if process exists for this customer
    const existing = await prisma.process.findFirst({
      where: { customerAccountId, processCode: proc.processCode },
    });
    if (existing) {
      // Update existing process
      await prisma.process.update({
        where: { id: existing.id },
        data: {
          processFrequency: proc.processFrequency,
          natureOfImplementation: proc.natureOfImplementation,
          riskRating: proc.riskRating,
          assetDependency: proc.assetDependency,
          externalDependency: proc.externalDependency,
          kpiMeasurementRequired: proc.kpiMeasurementRequired,
          piiCapture: proc.piiCapture,
          operationalComplexity: proc.operationalComplexity,
        },
      });
    } else {
      await prisma.process.create({
        data: {
          customerAccountId,
          processCode: proc.processCode,
          name: proc.name,
          description: proc.description,
          processType: proc.processType,
          departmentId: createdDepts[proc.department],
          ownerId: createdUsers[proc.owner],
          processFrequency: proc.processFrequency,
          natureOfImplementation: proc.natureOfImplementation,
          riskRating: proc.riskRating,
          assetDependency: proc.assetDependency,
          externalDependency: proc.externalDependency,
          kpiMeasurementRequired: proc.kpiMeasurementRequired,
          piiCapture: proc.piiCapture,
          operationalComplexity: proc.operationalComplexity,
          lastAuditDate: proc.riskRating ? new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) : null,
        },
      });
    }
  }
  console.log("✅ Audit Processes created");

  // Internal Audit Risk Register entries - REMOVED (no dummy data)
  // const fetchedAuditCategories = await prisma.auditCategory.findMany();
  // const fetchedAuditTypes = await prisma.auditType.findMany();

  // const internalAuditRisks = [
  //     // Human Resources Department
  //     {
  //       riskId: "RID001",
  //       riskName: "Inadequate Employee Background Verification",
  //       department: "Human Resources",
  //       sectionProcess: "Recruitment",
  //       subProcess: "Pre-employment Screening",
  //       activity: "Background Check",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of hiring individuals with undisclosed criminal records or false credentials",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Third-party background verification service for all new hires",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID002",
  //       riskName: "Payroll Fraud",
  //       department: "Human Resources",
  //       sectionProcess: "Payroll Processing",
  //       subProcess: "Salary Calculation",
  //       activity: "Payroll Reconciliation",
  //       category: "Financial Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of unauthorized payments or ghost employees in payroll system",
  //       inherentLikelihood: 2,
  //       inherentImpact: 4,
  //       controlDescription: "Segregation of duties with monthly payroll audits",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID003",
  //       riskName: "Non-compliance with Labor Laws",
  //       department: "Human Resources",
  //       sectionProcess: "Employee Relations",
  //       subProcess: "Leave Management",
  //       activity: "Leave Policy Adherence",
  //       category: "Compliance Audit",
  //       auditType: "Compliance Review",
  //       riskDescription: "Risk of legal penalties due to violations of labor regulations",
  //       inherentLikelihood: 2,
  //       inherentImpact: 4,
  //       controlDescription: "Automated HRMS with built-in compliance checks",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Closed",
  //     },
  //     // Revenue Department
  //     {
  //       riskId: "RID004",
  //       riskName: "Inadequate Financial Controls",
  //       department: "Revenue",
  //       sectionProcess: "Financial Reporting",
  //       subProcess: "Month-end Close",
  //       activity: "Journal Entry Review",
  //       category: "Financial Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of material misstatement due to inadequate review of journal entries",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Dual approval required for journal entries above $10,000",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID005",
  //       riskName: "Revenue Recognition Errors",
  //       department: "Revenue",
  //       sectionProcess: "Revenue Accounting",
  //       subProcess: "Sales Order Processing",
  //       activity: "Revenue Recognition",
  //       category: "Financial Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of premature or delayed revenue recognition affecting financial statements",
  //       inherentLikelihood: 3,
  //       inherentImpact: 5,
  //       controlDescription: "Automated revenue recognition based on ASC 606 standards",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 4,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID006",
  //       riskName: "Accounts Receivable Mismanagement",
  //       department: "Revenue",
  //       sectionProcess: "Collections",
  //       subProcess: "Aging Analysis",
  //       activity: "Credit Risk Assessment",
  //       category: "Financial Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Risk of bad debts and cash flow issues due to inadequate collections",
  //       inherentLikelihood: 3,
  //       inherentImpact: 3,
  //       controlDescription: "Weekly aging reports with automated dunning process",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 2,
  //       status: "Open",
  //     },
  //     // IT Operations Department
  //     {
  //       riskId: "RID007",
  //       riskName: "Access Control Weakness",
  //       department: "IT Operations",
  //       sectionProcess: "Identity Management",
  //       subProcess: "User Provisioning",
  //       activity: "Access Request Approval",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Unauthorized access to critical systems due to weak access controls",
  //       inherentLikelihood: 4,
  //       inherentImpact: 5,
  //       controlDescription: "Role-based access control with quarterly access reviews",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 3,
  //       residualImpact: 4,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID008",
  //       riskName: "Inadequate Backup and Recovery",
  //       department: "IT Operations",
  //       sectionProcess: "Data Management",
  //       subProcess: "Backup Operations",
  //       activity: "Disaster Recovery Testing",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of data loss and extended downtime due to inadequate backup procedures",
  //       inherentLikelihood: 3,
  //       inherentImpact: 5,
  //       controlDescription: "Daily automated backups with quarterly DR drills",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID009",
  //       riskName: "Change Management Failures",
  //       department: "IT Operations",
  //       sectionProcess: "Release Management",
  //       subProcess: "Change Approval",
  //       activity: "Production Deployment",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "System outages or data corruption due to unauthorized or poorly tested changes",
  //       inherentLikelihood: 4,
  //       inherentImpact: 4,
  //       controlDescription: "CAB approval required with rollback procedures for all production changes",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 3,
  //       residualImpact: 3,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID010",
  //       riskName: "Insufficient System Monitoring",
  //       department: "IT Operations",
  //       sectionProcess: "Infrastructure Monitoring",
  //       subProcess: "Performance Monitoring",
  //       activity: "Alert Management",
  //       category: "IT Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Undetected system failures or performance degradation affecting business operations",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "24/7 NOC with automated monitoring and alerting tools",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     // IT Support Department
  //     {
  //       riskId: "RID011",
  //       riskName: "Data Breach Risk",
  //       department: "IT Support",
  //       sectionProcess: "Data Protection",
  //       subProcess: "Data Classification",
  //       activity: "Sensitive Data Handling",
  //       category: "IT Audit",
  //       auditType: "Special Investigation",
  //       riskDescription: "Exposure of sensitive customer data due to inadequate protection",
  //       inherentLikelihood: 3,
  //       inherentImpact: 5,
  //       controlDescription: "Data encryption at rest and in transit, DLP tools deployed",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 4,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID012",
  //       riskName: "Inadequate Incident Response",
  //       department: "IT Support",
  //       sectionProcess: "Incident Management",
  //       subProcess: "Ticket Resolution",
  //       activity: "Security Incident Handling",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Extended impact of security incidents due to slow or ineffective response",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "CSIRT team with documented incident response playbooks",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID013",
  //       riskName: "Phishing and Social Engineering",
  //       department: "IT Support",
  //       sectionProcess: "Security Awareness",
  //       subProcess: "User Training",
  //       activity: "Security Education",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Risk of credential theft and malware infection through phishing attacks",
  //       inherentLikelihood: 4,
  //       inherentImpact: 4,
  //       controlDescription: "Quarterly security awareness training with simulated phishing tests",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 3,
  //       residualImpact: 3,
  //       status: "Under Review",
  //     },
  //     // Product Development Department
  //     {
  //       riskId: "RID014",
  //       riskName: "Insecure Code Practices",
  //       department: "Product Development",
  //       sectionProcess: "Software Development",
  //       subProcess: "Code Development",
  //       activity: "Security Code Review",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Security vulnerabilities in production code due to insecure coding practices",
  //       inherentLikelihood: 4,
  //       inherentImpact: 5,
  //       controlDescription: "SAST/DAST tools integrated in CI/CD pipeline with mandatory security training",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 4,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID015",
  //       riskName: "Third-Party Library Vulnerabilities",
  //       department: "Product Development",
  //       sectionProcess: "Dependency Management",
  //       subProcess: "Library Updates",
  //       activity: "Vulnerability Scanning",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Exploitation of known vulnerabilities in outdated third-party libraries",
  //       inherentLikelihood: 4,
  //       inherentImpact: 4,
  //       controlDescription: "Automated dependency scanning with monthly update cycles",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID016",
  //       riskName: "Inadequate Testing Coverage",
  //       department: "Product Development",
  //       sectionProcess: "Quality Assurance",
  //       subProcess: "Testing",
  //       activity: "Test Execution",
  //       category: "Operational Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Production bugs and failures due to insufficient testing before release",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Mandatory 80% code coverage requirement with automated regression tests",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     // Compliance Department
  //     {
  //       riskId: "RID017",
  //       riskName: "Regulatory Non-Compliance",
  //       department: "Compliance",
  //       sectionProcess: "Regulatory Monitoring",
  //       subProcess: "Compliance Tracking",
  //       activity: "Regulatory Updates",
  //       category: "Compliance Audit",
  //       auditType: "Compliance Review",
  //       riskDescription: "Risk of regulatory fines due to failure to comply with new regulations",
  //       inherentLikelihood: 2,
  //       inherentImpact: 5,
  //       controlDescription: "Automated regulatory feed with compliance mapping",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 4,
  //       status: "Closed",
  //     },
  //     {
  //       riskId: "RID018",
  //       riskName: "Inadequate Privacy Controls",
  //       department: "Compliance",
  //       sectionProcess: "Privacy Management",
  //       subProcess: "GDPR Compliance",
  //       activity: "Data Subject Rights",
  //       category: "Compliance Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Non-compliance with data privacy regulations leading to fines and reputational damage",
  //       inherentLikelihood: 3,
  //       inherentImpact: 5,
  //       controlDescription: "Privacy by design framework with automated DSAR workflow",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID019",
  //       riskName: "Anti-Money Laundering Gaps",
  //       department: "Compliance",
  //       sectionProcess: "AML Monitoring",
  //       subProcess: "Transaction Monitoring",
  //       activity: "Suspicious Activity Reporting",
  //       category: "Compliance Audit",
  //       auditType: "Compliance Review",
  //       riskDescription: "Risk of facilitating money laundering due to inadequate monitoring",
  //       inherentLikelihood: 2,
  //       inherentImpact: 5,
  //       controlDescription: "Automated transaction monitoring with quarterly KYC refresh",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     // Procurement Department
  //     {
  //       riskId: "RID020",
  //       riskName: "Vendor Performance Issues",
  //       department: "Procurement",
  //       sectionProcess: "Vendor Management",
  //       subProcess: "Performance Monitoring",
  //       activity: "SLA Review",
  //       category: "Operational Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Service disruption due to vendor underperformance",
  //       inherentLikelihood: 3,
  //       inherentImpact: 3,
  //       controlDescription: "Monthly vendor scorecards with escalation procedures",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 2,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID021",
  //       riskName: "Procurement Fraud",
  //       department: "Procurement",
  //       sectionProcess: "Purchase Order Processing",
  //       subProcess: "Vendor Selection",
  //       activity: "Bid Evaluation",
  //       category: "Financial Audit",
  //       auditType: "Special Investigation",
  //       riskDescription: "Risk of kickbacks or favoritism in vendor selection process",
  //       inherentLikelihood: 2,
  //       inherentImpact: 4,
  //       controlDescription: "Three-quote requirement with conflict of interest declarations",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID022",
  //       riskName: "Third-Party Risk Exposure",
  //       department: "Procurement",
  //       sectionProcess: "Vendor Onboarding",
  //       subProcess: "Vendor Due Diligence",
  //       activity: "Risk Assessment",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Business disruption or data breaches through third-party vendors",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Vendor risk assessment program with annual reviews",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Under Review",
  //     },
  //     // Operations Department
  //     {
  //       riskId: "RID023",
  //       riskName: "Process Inefficiency",
  //       department: "Operations",
  //       sectionProcess: "Business Operations",
  //       subProcess: "Workflow Management",
  //       activity: "Process Optimization",
  //       category: "Operational Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Operational delays and cost overruns due to inefficient processes",
  //       inherentLikelihood: 3,
  //       inherentImpact: 3,
  //       controlDescription: "BPM tools with continuous improvement program",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 2,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID024",
  //       riskName: "Business Continuity Gaps",
  //       department: "Operations",
  //       sectionProcess: "Business Continuity",
  //       subProcess: "BCP Planning",
  //       activity: "BCP Testing",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Extended business disruption due to inadequate continuity planning",
  //       inherentLikelihood: 2,
  //       inherentImpact: 5,
  //       controlDescription: "Annual BCP testing with documented recovery procedures",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID025",
  //       riskName: "Capacity Management Issues",
  //       department: "Operations",
  //       sectionProcess: "Resource Planning",
  //       subProcess: "Capacity Planning",
  //       activity: "Demand Forecasting",
  //       category: "Operational Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Service degradation during peak periods due to insufficient capacity",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Quarterly capacity reviews with auto-scaling capabilities",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     // Risk Management Department
  //     {
  //       riskId: "RID026",
  //       riskName: "Inadequate Risk Assessment",
  //       department: "Risk Management",
  //       sectionProcess: "Risk Identification",
  //       subProcess: "Risk Analysis",
  //       activity: "Risk Scoring",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Failure to identify and mitigate critical enterprise risks",
  //       inherentLikelihood: 3,
  //       inherentImpact: 5,
  //       controlDescription: "Quarterly enterprise risk assessments with board reporting",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID027",
  //       riskName: "Cybersecurity Risk Exposure",
  //       department: "Risk Management",
  //       sectionProcess: "Cyber Risk Management",
  //       subProcess: "Threat Intelligence",
  //       activity: "Vulnerability Management",
  //       category: "IT Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Cyber attacks exploiting unpatched vulnerabilities",
  //       inherentLikelihood: 4,
  //       inherentImpact: 5,
  //       controlDescription: "Continuous vulnerability scanning with 30-day patching SLA",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 3,
  //       residualImpact: 4,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID028",
  //       riskName: "Fraud Risk Exposure",
  //       department: "Risk Management",
  //       sectionProcess: "Fraud Prevention",
  //       subProcess: "Fraud Detection",
  //       activity: "Anomaly Detection",
  //       category: "Financial Audit",
  //       auditType: "Special Investigation",
  //       riskDescription: "Financial losses due to internal or external fraud",
  //       inherentLikelihood: 2,
  //       inherentImpact: 5,
  //       controlDescription: "AI-powered fraud detection system with whistleblower hotline",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 4,
  //       status: "Open",
  //     },
  //     // Quality Assurance Department
  //     {
  //       riskId: "RID029",
  //       riskName: "Quality Control Failures",
  //       department: "Quality Assurance",
  //       sectionProcess: "Quality Management",
  //       subProcess: "Product Testing",
  //       activity: "Quality Inspection",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Product defects reaching customers due to inadequate quality controls",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Multi-stage inspection process with statistical sampling",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID030",
  //       riskName: "Non-compliance with Standards",
  //       department: "Quality Assurance",
  //       sectionProcess: "Standards Compliance",
  //       subProcess: "ISO Certification",
  //       activity: "Compliance Verification",
  //       category: "Compliance Audit",
  //       auditType: "Compliance Review",
  //       riskDescription: "Loss of ISO certification due to non-compliance with quality standards",
  //       inherentLikelihood: 2,
  //       inherentImpact: 4,
  //       controlDescription: "Internal audits aligned with ISO 9001 requirements",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID031",
  //       riskName: "Customer Complaint Escalation",
  //       department: "Quality Assurance",
  //       sectionProcess: "Customer Feedback",
  //       subProcess: "Complaint Management",
  //       activity: "Root Cause Analysis",
  //       category: "Operational Audit",
  //       auditType: "Consulting",
  //       riskDescription: "Reputational damage from unresolved customer complaints",
  //       inherentLikelihood: 2,
  //       inherentImpact: 3,
  //       controlDescription: "CRM-integrated complaint tracking with 48-hour response SLA",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 2,
  //       status: "Open",
  //     },
  //     // Internal Audit Department
  //     {
  //       riskId: "RID032",
  //       riskName: "Audit Coverage Gaps",
  //       department: "Internal Audit",
  //       sectionProcess: "Audit Planning",
  //       subProcess: "Risk-Based Planning",
  //       activity: "Audit Universe Review",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "High-risk areas not covered by internal audit due to inadequate planning",
  //       inherentLikelihood: 2,
  //       inherentImpact: 4,
  //       controlDescription: "Annual risk-based audit plan approved by audit committee",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //       residualImpact: 3,
  //       status: "Open",
  //     },
  //     {
  //       riskId: "RID033",
  //       riskName: "Audit Finding Follow-up Delays",
  //       department: "Internal Audit",
  //       sectionProcess: "CAPA Tracking",
  //       subProcess: "Finding Resolution",
  //       activity: "Follow-up Reviews",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Unresolved audit findings leading to continued risk exposure",
  //       inherentLikelihood: 3,
  //       inherentImpact: 4,
  //       controlDescription: "Automated CAPA tracking with management escalation for overdue items",
  //       controlEffectiveness: "Partially Effective",
  //       residualLikelihood: 2,
  //       residualImpact: 3,
  //       status: "Under Review",
  //     },
  //     {
  //       riskId: "RID034",
  //       riskName: "Auditor Independence Concerns",
  //       department: "Internal Audit",
  //       sectionProcess: "Audit Independence",
  //       subProcess: "Objectivity Safeguards",
  //       activity: "Independence Assessment",
  //       category: "Operational Audit",
  //       auditType: "Assurance",
  //       riskDescription: "Compromised audit objectivity due to conflicts of interest",
  //       inherentLikelihood: 1,
  //       inherentImpact: 4,
  //       controlDescription: "Annual independence declarations with functional reporting to audit committee",
  //       controlEffectiveness: "Effective",
  //       residualLikelihood: 1,
  //   //     residualImpact: 3,
  //   //     status: "Open",
  //   //   },
  //   // ];

  // for (const risk of internalAuditRisks) {
  //   const category = fetchedAuditCategories.find(c => c.name === risk.category);
  //   const auditType = fetchedAuditTypes.find(t => t.name === risk.auditType);

  //   // Use findFirst to check if internal audit risk exists for this customer
  //   const existing = await prisma.internalAuditRisk.findFirst({
  //     where: { customerAccountId, riskId: risk.riskId },
  //   });
  //   if (!existing) {
  //     await prisma.internalAuditRisk.create({
  //       data: {
  //         customerAccountId,
  //         riskId: risk.riskId,
  //         riskName: risk.riskName,
  //         departmentId: createdDepts[risk.department],
  //         sectionProcess: risk.sectionProcess,
  //         subProcess: risk.subProcess,
  //         activity: risk.activity,
  //         categoryId: category?.id,
  //         auditTypeId: auditType?.id,
  //         riskDescription: risk.riskDescription,
  //         inherentLikelihood: risk.inherentLikelihood,
  //         inherentImpact: risk.inherentImpact,
  //         inherentScore: risk.inherentLikelihood * risk.inherentImpact,
  //         controlDescription: risk.controlDescription,
  //         controlEffectiveness: risk.controlEffectiveness,
  //         residualLikelihood: risk.residualLikelihood,
  //         residualImpact: risk.residualImpact,
  //         residualScore: risk.residualLikelihood * risk.residualImpact,
  //         riskLevel: risk.residualLikelihood * risk.residualImpact > 14 ? "High" :
  //                    risk.residualLikelihood * risk.residualImpact > 6 ? "Medium" : "Low",
  //         status: risk.status,
  //       },
  //     });
  //   }
  // }
  // console.log("✅ Internal Audit Risks created");

  // ==================== AUDITABLE ENTITIES (AUDIT UNIVERSE) ====================

  const auditableEntities = [
    {
      entityCode: "AE-001",
      name: "Financial Reporting Process",
      departmentId: createdDepts["Revenue"],
      description: "End-to-end financial reporting and reconciliation process",
      riskRating: "High",
      lastAuditDate: new Date("2024-10-15"),
      nextAuditDate: new Date("2025-10-15"),
      status: "Active",
    },
    {
      entityCode: "AE-002",
      name: "IT Infrastructure Security",
      departmentId: createdDepts["IT Operations"],
      description: "Network security, server management, and access controls",
      riskRating: "High",
      lastAuditDate: new Date("2024-12-01"),
      nextAuditDate: new Date("2025-06-01"),
      status: "Active",
    },
    {
      entityCode: "AE-003",
      name: "Payroll Processing",
      departmentId: createdDepts["Human Resources"],
      description: "Employee payroll calculation, verification, and disbursement",
      riskRating: "Medium",
      lastAuditDate: new Date("2024-09-01"),
      nextAuditDate: new Date("2025-09-01"),
      status: "Active",
    },
    {
      entityCode: "AE-004",
      name: "Vendor Management System",
      departmentId: createdDepts["Procurement"],
      description: "Third-party vendor onboarding, monitoring, and payment",
      riskRating: "High",
      lastAuditDate: new Date("2024-11-15"),
      nextAuditDate: new Date("2025-05-15"),
      status: "Active",
    },
    {
      entityCode: "AE-005",
      name: "Regulatory Compliance Monitoring",
      departmentId: createdDepts["Compliance"],
      description: "Tracking and ensuring compliance with applicable regulations",
      riskRating: "High",
      lastAuditDate: new Date("2024-08-01"),
      nextAuditDate: new Date("2025-02-01"),
      status: "Active",
    },
    {
      entityCode: "AE-006",
      name: "Customer Data Management",
      departmentId: createdDepts["IT Support"],
      description: "Customer database management and privacy controls",
      riskRating: "Extreme",
      lastAuditDate: new Date("2025-01-15"),
      nextAuditDate: new Date("2025-04-15"),
      status: "Active",
    },
    {
      entityCode: "AE-007",
      name: "Product Development Lifecycle",
      departmentId: createdDepts["Product Development"],
      description: "Software development, testing, and deployment process",
      riskRating: "Medium",
      lastAuditDate: new Date("2024-07-01"),
      nextAuditDate: new Date("2025-07-01"),
      status: "Active",
    },
    {
      entityCode: "AE-008",
      name: "Business Continuity Planning",
      departmentId: createdDepts["Operations"],
      description: "Disaster recovery and business continuity procedures",
      riskRating: "High",
      lastAuditDate: new Date("2024-06-15"),
      nextAuditDate: new Date("2025-06-15"),
      status: "Active",
    },
  ];

  const createdAuditableEntities: { [key: string]: string } = {};
  for (const entity of auditableEntities) {
    // Use findFirst to check if auditable entity exists for this customer
    const existing = await prisma.auditableEntity.findFirst({
      where: { customerAccountId, entityCode: entity.entityCode },
    });
    if (existing) {
      createdAuditableEntities[entity.entityCode] = existing.id;
    } else {
      const created = await prisma.auditableEntity.create({
        data: { customerAccountId, ...entity },
      });
      createdAuditableEntities[entity.entityCode] = created.id;
    }
  }
  console.log("✅ Auditable Entities created");

  // ==================== AUDIT ENGAGEMENTS (AUDIT PLANNING) ====================

  const auditEngagements = [
    {
      auditId: "AUD001",
      engagementTitle: "Q1 2025 IT Security Audit",
      description: "Assess the effectiveness of IT security controls and identify vulnerabilities. Scope: Network security, access management, patch management, incident response",
      departmentId: createdDepts["IT Operations"],
      auditableEntityId: createdAuditableEntities["AE-002"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2025-03-01"),
      plannedEndDate: new Date("2025-03-31"),
      actualStartDate: new Date("2025-03-01"),
      status: "In Progress",
      priority: "High",
      year: 2025,
      quarter: "Q1",
    },
    {
      auditId: "AUD002",
      engagementTitle: "Financial Reporting Compliance Audit",
      description: "Verify accuracy and compliance of financial reporting processes. Scope: Monthly reconciliations, journal entries, financial statement preparation",
      departmentId: createdDepts["Revenue"],
      auditableEntityId: createdAuditableEntities["AE-001"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2025-04-15"),
      plannedEndDate: new Date("2025-05-15"),
      status: "Planned",
      priority: "High",
      year: 2025,
      quarter: "Q2",
    },
    {
      auditId: "AUD003",
      engagementTitle: "Vendor Management Review",
      description: "Evaluate vendor onboarding, monitoring, and risk assessment processes. Scope: Vendor contracts, performance monitoring, payment processing",
      departmentId: createdDepts["Procurement"],
      auditableEntityId: createdAuditableEntities["AE-004"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2025-06-01"),
      plannedEndDate: new Date("2025-06-30"),
      status: "Planned",
      priority: "Medium",
      year: 2025,
      quarter: "Q2",
    },
    {
      auditId: "AUD004",
      engagementTitle: "Data Privacy Compliance Assessment",
      description: "Assess compliance with data privacy regulations (GDPR, PDPA). Scope: Data collection, storage, processing, deletion, and consent management",
      departmentId: createdDepts["IT Support"],
      auditableEntityId: createdAuditableEntities["AE-006"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2025-02-15"),
      plannedEndDate: new Date("2025-03-15"),
      actualStartDate: new Date("2025-02-15"),
      actualEndDate: new Date("2025-03-10"),
      status: "Completed",
      priority: "High",
      year: 2025,
      quarter: "Q1",
    },
    {
      auditId: "AUD005",
      engagementTitle: "Payroll Processing Audit",
      description: "Review payroll calculation accuracy and compliance with labor laws. Scope: Time tracking, salary calculations, deductions, tax compliance",
      departmentId: createdDepts["Human Resources"],
      auditableEntityId: createdAuditableEntities["AE-003"],
      assignedAuditorId: createdUsers["john.doe"],
      plannedStartDate: new Date("2025-07-01"),
      plannedEndDate: new Date("2025-07-31"),
      status: "Planned",
      priority: "Medium",
      year: 2025,
      quarter: "Q3",
    },
    {
      auditId: "AUD006",
      engagementTitle: "Q4 2024 Regulatory Compliance Review",
      description: "Verify adherence to industry regulations and standards. Scope: SOC 2, ISO 27001, industry-specific regulations",
      departmentId: createdDepts["Compliance"],
      auditableEntityId: createdAuditableEntities["AE-005"],
      assignedAuditorId: createdUsers["john.doe"],
      plannedStartDate: new Date("2024-12-01"),
      plannedEndDate: new Date("2024-12-31"),
      actualStartDate: new Date("2024-12-01"),
      actualEndDate: new Date("2024-12-28"),
      status: "Completed",
      priority: "High",
      year: 2024,
      quarter: "Q4",
    },
    // Additional completed audits for Report testing
    {
      auditId: "AUD007",
      engagementTitle: "Procurement & Contract Management Audit",
      description: "Review procurement processes, contract negotiations, and vendor compliance. Scope: Purchase orders, contract terms, payment authorization",
      departmentId: createdDepts["Procurement"],
      auditableEntityId: createdAuditableEntities["AE-004"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2024-10-28"),
      plannedEndDate: new Date("2024-10-31"),
      actualStartDate: new Date("2024-10-28"),
      actualEndDate: new Date("2024-10-31"),
      status: "Completed",
      priority: "High",
      year: 2024,
      quarter: "Q4",
      auditType: "Internal",
    },
    {
      auditId: "AUD008",
      engagementTitle: "Test Audit for Ministry of Finance",
      description: "Conduct specialized audit for Ministry of Finance compliance requirements. Scope: Budget controls, expenditure tracking, financial governance",
      departmentId: createdDepts["Revenue"],
      auditableEntityId: createdAuditableEntities["AE-001"],
      assignedAuditorId: createdUsers["john.doe"],
      plannedStartDate: new Date("2024-11-27"),
      plannedEndDate: new Date("2024-11-27"),
      actualStartDate: new Date("2024-11-27"),
      actualEndDate: new Date("2024-11-27"),
      status: "Completed",
      priority: "Medium",
      year: 2024,
      quarter: "Q4",
      auditType: "Internal",
    },
    {
      auditId: "AUD009",
      engagementTitle: "Governance and Decision Making Review",
      description: "Assess governance structures and decision-making processes. Scope: Board oversight, policy frameworks, strategic alignment",
      departmentId: createdDepts["Operations"],
      auditableEntityId: createdAuditableEntities["AE-005"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2024-11-06"),
      plannedEndDate: new Date("2024-11-12"),
      actualStartDate: new Date("2024-11-06"),
      actualEndDate: new Date("2024-11-12"),
      status: "Completed",
      priority: "High",
      year: 2024,
      quarter: "Q4",
      auditType: "Internal",
    },
    {
      auditId: "AUD010",
      engagementTitle: "Information Security Controls Assessment",
      description: "Evaluate effectiveness of information security controls and incident response. Scope: Access controls, encryption, monitoring, incident handling",
      departmentId: createdDepts["IT Operations"],
      auditableEntityId: createdAuditableEntities["AE-002"],
      assignedAuditorId: createdUsers["sarah.smith"],
      plannedStartDate: new Date("2024-11-13"),
      plannedEndDate: new Date("2024-11-28"),
      actualStartDate: new Date("2024-11-13"),
      actualEndDate: new Date("2024-11-28"),
      status: "Completed",
      priority: "High",
      year: 2024,
      quarter: "Q4",
      auditType: "Internal",
    },
  ];

  const createdEngagements: { [key: string]: string } = {};
  for (const engagement of auditEngagements) {
    // Use findFirst to check if audit engagement exists for this customer
    const existing = await prisma.auditEngagement.findFirst({
      where: { customerAccountId, auditId: engagement.auditId },
    });
    if (existing) {
      createdEngagements[engagement.auditId] = existing.id;
    } else {
      const created = await prisma.auditEngagement.create({
        data: { customerAccountId, ...engagement },
      });
      createdEngagements[engagement.auditId] = created.id;
    }
  }
  console.log("✅ Audit Engagements created");

  // ==================== INTERNAL AUDIT FINDINGS ====================

  const internalAuditFindings = [
    {
      findingId: "FND001",
      engagementId: createdEngagements["AUD004"],
      departmentId: createdDepts["IT Support"],
      finding: "Inadequate Data Retention Policy",
      description: "Customer data is being retained beyond the necessary period without documented justification",
      severity: "High",
      identifiedDate: new Date("2025-02-20"),
      targetDate: new Date("2025-04-30"),
      status: "Open",
    },
    {
      findingId: "FND002",
      engagementId: createdEngagements["AUD004"],
      departmentId: createdDepts["IT Support"],
      finding: "Missing Consent Records",
      description: "Some customer consent records for data processing are incomplete or missing",
      severity: "Medium",
      identifiedDate: new Date("2025-02-25"),
      targetDate: new Date("2025-05-15"),
      status: "In Progress",
    },
    {
      findingId: "FND003",
      engagementId: createdEngagements["AUD001"],
      departmentId: createdDepts["IT Operations"],
      finding: "Weak Password Policy Enforcement",
      description: "Current password policy does not enforce complexity requirements consistently",
      severity: "High",
      identifiedDate: new Date("2025-03-05"),
      targetDate: new Date("2025-04-15"),
      status: "Open",
    },
    {
      findingId: "FND004",
      engagementId: createdEngagements["AUD001"],
      departmentId: createdDepts["IT Operations"],
      finding: "Outdated Antivirus Software",
      description: "Several workstations running outdated antivirus definitions",
      severity: "Medium",
      identifiedDate: new Date("2025-03-10"),
      targetDate: new Date("2025-04-01"),
      status: "Open",
    },
    {
      findingId: "FND005",
      engagementId: createdEngagements["AUD006"],
      departmentId: createdDepts["Compliance"],
      finding: "Incomplete SOC 2 Documentation",
      description: "Some control evidence for SOC 2 Type II audit is incomplete",
      severity: "High",
      identifiedDate: new Date("2024-12-10"),
      targetDate: new Date("2025-01-15"),
      closedDate: new Date("2025-01-15"),
      status: "Closed",
    },
  ];

  const createdInternalFindings: { [key: string]: string } = {};
  for (const finding of internalAuditFindings) {
    // Use findFirst to check if internal audit finding exists for this customer
    const existing = await prisma.internalAuditFinding.findFirst({
      where: { customerAccountId, findingId: finding.findingId },
    });
    if (existing) {
      createdInternalFindings[finding.findingId] = existing.id;
    } else {
      const created = await prisma.internalAuditFinding.create({
        data: { customerAccountId, ...finding },
      });
      createdInternalFindings[finding.findingId] = created.id;
    }
  }
  console.log("✅ Internal Audit Findings created");

  // ==================== INTERNAL AUDIT CAPA ====================

  const internalAuditCapas = [
    {
      capaId: "CAPA001",
      findingId: createdInternalFindings["FND001"],
      title: "Implement Automated Data Retention Policy",
      description: "Deploy automated data retention and deletion mechanism based on data classification",
      actionType: "Corrective",
      responsiblePerson: "David Jones",
      targetDate: new Date("2025-04-30"),
      status: "In Progress",
    },
    {
      capaId: "CAPA002",
      findingId: createdInternalFindings["FND002"],
      title: "Update Consent Management System",
      description: "Enhance consent management system to capture and store all required consent records",
      actionType: "Corrective",
      responsiblePerson: "David Jones",
      targetDate: new Date("2025-05-15"),
      status: "In Progress",
    },
    {
      capaId: "CAPA003",
      findingId: createdInternalFindings["FND003"],
      title: "Enforce Strong Password Policy",
      description: "Update Active Directory Group Policy to enforce 14-character passwords with complexity",
      actionType: "Corrective",
      responsiblePerson: "BTS Admin",
      targetDate: new Date("2025-04-15"),
      status: "Open",
    },
    {
      capaId: "CAPA004",
      findingId: createdInternalFindings["FND004"],
      title: "Update Antivirus Definitions",
      description: "Deploy automated antivirus update mechanism across all workstations",
      actionType: "Corrective",
      responsiblePerson: "David Jones",
      targetDate: new Date("2025-04-01"),
      status: "In Progress",
    },
    {
      capaId: "CAPA005",
      findingId: createdInternalFindings["FND005"],
      title: "Complete SOC 2 Control Evidence",
      description: "Gather and document all missing control evidence for SOC 2 audit",
      actionType: "Corrective",
      responsiblePerson: "John Doe",
      targetDate: new Date("2025-01-15"),
      completedDate: new Date("2025-01-15"),
      status: "Closed",
    },
  ];

  for (const capa of internalAuditCapas) {
    // Use findFirst to check if internal audit CAPA exists for this customer
    const existing = await prisma.internalAuditCAPA.findFirst({
      where: { customerAccountId, capaId: capa.capaId },
    });
    if (!existing) {
      await prisma.internalAuditCAPA.create({
        data: { customerAccountId, ...capa },
      });
    }
  }
  console.log("✅ Internal Audit CAPAs created");

  // ==================== AUDIT DOCUMENTS ====================

  await prisma.internalAuditDocument.deleteMany({});

  const auditDocuments = [
    // Policies
    {
      documentCode: "DOC-0001",
      name: "Information Security Policy",
      description: "Organization-wide information security policy document",
      category: "Policy",
      fileName: "Information_Security_Policy_2025.pdf",
      fileType: "pdf",
      fileSize: 245000,
      filePath: "/uploads/documents/Information_Security_Policy_2025.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2025-01-10T10:30:00"),
    },
    {
      documentCode: "DOC-0002",
      name: "Access Control Procedure",
      description: "Procedure for managing user access rights",
      category: "Policy",
      fileName: "Access_Control_Procedure.pdf",
      fileType: "pdf",
      fileSize: 189000,
      filePath: "/uploads/documents/Access_Control_Procedure.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2025-01-12T14:15:00"),
    },
    {
      documentCode: "DOC-0003",
      name: "Data Classification Guidelines",
      description: "Guidelines for classifying organizational data",
      category: "Policy",
      fileName: "Data_Classification_Guidelines.docx",
      fileType: "docx",
      fileSize: 156000,
      filePath: "/uploads/documents/Data_Classification_Guidelines.docx",
      uploadedBy: "admin",
      uploadedAt: new Date("2025-01-08T09:00:00"),
    },
    {
      documentCode: "DOC-0004",
      name: "Incident Response Plan",
      description: "Comprehensive incident response procedures",
      category: "Policy",
      fileName: "Incident_Response_Plan_v2.pdf",
      fileType: "pdf",
      fileSize: 312000,
      filePath: "/uploads/documents/Incident_Response_Plan_v2.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2025-01-15T11:45:00"),
    },
    // Regulations
    {
      documentCode: "DOC-0005",
      name: "ISO 27001:2022 Standard",
      description: "Information security management system standard",
      category: "Regulation",
      fileName: "ISO_27001_2022.pdf",
      fileType: "pdf",
      fileSize: 890000,
      filePath: "/uploads/documents/ISO_27001_2022.pdf",
      uploadedBy: "admin",
      uploadedAt: new Date("2025-01-05T08:30:00"),
    },
    {
      documentCode: "DOC-0006",
      name: "SOC 2 Type II Requirements",
      description: "SOC 2 compliance requirements document",
      category: "Regulation",
      fileName: "SOC2_Type2_Requirements.pdf",
      fileType: "pdf",
      fileSize: 567000,
      filePath: "/uploads/documents/SOC2_Type2_Requirements.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2025-01-07T16:20:00"),
    },
    {
      documentCode: "DOC-0007",
      name: "GDPR Compliance Checklist",
      description: "Checklist for GDPR compliance verification",
      category: "Regulation",
      fileName: "GDPR_Compliance_Checklist.xlsx",
      fileType: "xlsx",
      fileSize: 78000,
      filePath: "/uploads/documents/GDPR_Compliance_Checklist.xlsx",
      uploadedBy: "admin",
      uploadedAt: new Date("2025-01-09T10:00:00"),
    },
    // Previous Audit Reports
    {
      documentCode: "DOC-0008",
      name: "Q4 2024 Internal Audit Report",
      description: "Quarterly internal audit findings and recommendations",
      category: "PreviousReport",
      fileName: "Q4_2024_Internal_Audit_Report.pdf",
      fileType: "pdf",
      fileSize: 456000,
      filePath: "/uploads/documents/Q4_2024_Internal_Audit_Report.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2025-01-02T13:30:00"),
    },
    {
      documentCode: "DOC-0009",
      name: "Annual Risk Assessment 2024",
      description: "Comprehensive annual risk assessment report",
      category: "PreviousReport",
      fileName: "Annual_Risk_Assessment_2024.pdf",
      fileType: "pdf",
      fileSize: 723000,
      filePath: "/uploads/documents/Annual_Risk_Assessment_2024.pdf",
      uploadedBy: "admin",
      uploadedAt: new Date("2024-12-28T15:00:00"),
    },
    {
      documentCode: "DOC-0010",
      name: "IT General Controls Audit",
      description: "IT general controls audit findings",
      category: "PreviousReport",
      fileName: "IT_General_Controls_Audit.pdf",
      fileType: "pdf",
      fileSize: 345000,
      filePath: "/uploads/documents/IT_General_Controls_Audit.pdf",
      uploadedBy: "abhishek",
      uploadedAt: new Date("2024-12-15T09:45:00"),
    },
    {
      documentCode: "DOC-0011",
      name: "Vendor Risk Assessment Report",
      description: "Third-party vendor risk assessment findings",
      category: "PreviousReport",
      fileName: "Vendor_Risk_Assessment_2024.pdf",
      fileType: "pdf",
      fileSize: 289000,
      filePath: "/uploads/documents/Vendor_Risk_Assessment_2024.pdf",
      uploadedBy: "admin",
      uploadedAt: new Date("2024-11-20T11:15:00"),
    },
  ];

  for (const doc of auditDocuments) {
    // InternalAuditDocument is shared master data (no customerAccountId)
    const existing = await prisma.internalAuditDocument.findFirst({
      where: { documentCode: doc.documentCode },
    });
    if (!existing) {
      await prisma.internalAuditDocument.create({
        data: { ...doc },
      });
    }
  }
  console.log("✅ Internal Audit Documents created");

  // Document Search History
  await prisma.documentSearch.deleteMany({});
  const documentSearchHistory = [
    {
      query: "ai",
      result: "Unsatisfactory: The retrieved document content does not provide any relevant information regarding artificial intelligence, as all entries only contain the word \"Internal\" and page references.",
      status: "Unsatisfactory",
      userId: "abhishek",
      createdAt: new Date("2026-01-19T10:39:00"),
    },
    {
      query: "What is the principle of Demonstrating integrity",
      result: "Found relevant information in the Information Security Policy document. The principle of demonstrating integrity involves maintaining accuracy and completeness of data, ensuring honest communication, and adhering to ethical standards in all business practices.",
      status: "Satisfactory",
      userId: "abhishek",
      createdAt: new Date("2025-12-22T11:24:00"),
    },
    {
      query: "Audit",
      result: "Found 4 document(s) related to \"Audit\". Documents include: Q4 2024 Internal Audit Report, Annual Risk Assessment 2024, IT General Controls Audit, Vendor Risk Assessment Report. These documents contain information relevant to your query about audit processes and findings.",
      status: "Satisfactory",
      userId: "abhishek",
      createdAt: new Date("2025-12-18T20:11:00"),
    },
    {
      query: "access control",
      result: "Found 2 document(s) related to \"access control\". Documents include: Access Control Procedure, Information Security Policy. These documents outline procedures for user access management and authorization controls.",
      status: "Satisfactory",
      userId: "admin",
      createdAt: new Date("2025-12-10T14:30:00"),
    },
    {
      query: "compliance requirements",
      result: "Found 3 document(s) related to \"compliance requirements\". Documents include: SOC 2 Type II Requirements, GDPR Compliance Checklist, ISO 27001:2022 Standard. These documents provide detailed compliance requirements and checklists.",
      status: "Satisfactory",
      userId: "abhishek",
      createdAt: new Date("2025-12-05T09:15:00"),
    },
  ];

  for (const search of documentSearchHistory) {
    await prisma.documentSearch.create({
      data: search,
    });
  }
  console.log("✅ Document Search History created");

  // ==================== AUDIT REPORTS ====================

  const auditReports = [
    {
      reportCode: "RPT-2025-001",
      engagementId: createdEngagements["AUD004"],
      title: "Data Privacy Compliance Audit - Final Report",
      executiveSummary: "The audit identified 2 significant findings related to data retention and consent management. While overall data privacy controls are adequate, improvements are recommended in documentation and automated processes.",
      scope: "Data collection, storage, processing, deletion, and consent management across all systems handling customer data",
      objectives: "Assess compliance with GDPR and PDPA data privacy regulations",
      methodology: "Interviews with data protection officers, review of data processing records, technical testing of data retention mechanisms, examination of consent management processes",
      observations: "2 findings identified: inadequate data retention policy implementation and missing consent records in legacy systems",
      recommendations: "Implement automated data retention mechanism, update consent management system, conduct staff training on data privacy requirements",
      status: "Published",
      publishedAt: new Date("2025-03-15"),
    },
    {
      reportCode: "RPT-2024-012",
      engagementId: createdEngagements["AUD006"],
      title: "Q4 2024 Regulatory Compliance Review",
      executiveSummary: "The organization demonstrates strong compliance posture. One high-priority finding related to SOC 2 documentation has been identified and addressed. Overall compliance framework is robust.",
      scope: "SOC 2 Type II controls, ISO 27001 certification evidence, industry-specific regulatory requirements",
      objectives: "Verify adherence to applicable industry regulations and standards",
      methodology: "Document review, control testing, interviews with compliance team, evidence sampling",
      observations: "Strong overall compliance framework. Minor documentation gaps identified in SOC 2 evidence collection",
      recommendations: "Complete documentation for SOC 2 control evidence, maintain regular evidence collection schedule",
      status: "Published",
      publishedAt: new Date("2025-01-05"),
    },
  ];

  for (const report of auditReports) {
    // Use findFirst to check if audit report exists for this customer
    const existing = await prisma.auditReport.findFirst({
      where: { customerAccountId, reportCode: report.reportCode },
    });
    if (!existing) {
      await prisma.auditReport.create({
        data: { customerAccountId, ...report },
      });
    }
  }
  console.log("✅ Audit Reports created");

  // ==================== TPRM (Third-Party Risk Management) ====================

  // Create TPRM Vendors
  const tprmVendors = [
    { vendorCode: "VEN001", name: "IBM Corporation", contactEmail: "vendor@ibm.com", contactPhone: "+1-800-IBM-7378", accountManagerName: "James Watson", serviceCategory: "IT Services", department: "IT Operations", status: "Onboarded", onboardedDate: new Date("2025-01-15") },
    { vendorCode: "VEN002", name: "Microsoft Azure", contactEmail: "azure@microsoft.com", contactPhone: "+1-800-642-7676", accountManagerName: "Sarah Chen", serviceCategory: "Cloud Infrastructure", department: "IT Operations", status: "Onboarded", onboardedDate: new Date("2025-02-01") },
    { vendorCode: "VEN003", name: "Deloitte Consulting", contactEmail: "info@deloitte.com", contactPhone: "+1-212-489-1600", accountManagerName: "Robert Miller", serviceCategory: "Consulting", department: "Compliance", status: "Onboarding" },
    { vendorCode: "VEN004", name: "Palo Alto Networks", contactEmail: "sales@paloaltonetworks.com", contactPhone: "+1-408-753-4000", accountManagerName: "Emily Davis", serviceCategory: "Cybersecurity", department: "IT Support", status: "Onboarding" },
    { vendorCode: "VEN005", name: "SAP SE", contactEmail: "info@sap.com", contactPhone: "+49-6227-7-47474", accountManagerName: "Hans Mueller", serviceCategory: "ERP Systems", department: "IT Operations", status: "Onboarded", onboardedDate: new Date("2024-11-20") },
    { vendorCode: "VEN006", name: "Accenture", contactEmail: "contact@accenture.com", contactPhone: "+1-312-842-5012", accountManagerName: "Lisa Park", serviceCategory: "Digital Transformation", department: "Product Development", status: "Onboarding" },
    { vendorCode: "VEN007", name: "AWS (Amazon)", contactEmail: "aws-sales@amazon.com", contactPhone: "+1-206-266-1000", accountManagerName: "David Kim", serviceCategory: "Cloud Infrastructure", department: "IT Operations", status: "Onboarded", onboardedDate: new Date("2025-03-10") },
    { vendorCode: "VEN008", name: "Oracle", contactEmail: "info@oracle.com", contactPhone: "+1-650-506-7000", accountManagerName: "Maria Garcia", serviceCategory: "Database Services", department: "IT Operations", status: "Offboarding", onboardedDate: new Date("2023-06-15") },
    { vendorCode: "VEN009", name: "Wipro Technologies", contactEmail: "info@wipro.com", contactPhone: "+91-80-2844-0011", accountManagerName: "Ravi Sharma", serviceCategory: "IT Outsourcing", department: "IT Support", status: "Onboarding" },
    { vendorCode: "VEN010", name: "CrowdStrike", contactEmail: "sales@crowdstrike.com", contactPhone: "+1-888-512-8906", accountManagerName: "Alex Johnson", serviceCategory: "Endpoint Security", department: "IT Support", status: "Onboarded", onboardedDate: new Date("2025-04-01") },
  ];

  const createdVendors: { [key: string]: string } = {};
  for (const vendor of tprmVendors) {
    const existing = await prisma.tPRMVendor.findFirst({
      where: { customerAccountId: grcAdminCustomerAccountId, vendorCode: vendor.vendorCode },
    });
    if (!existing) {
      const created = await prisma.tPRMVendor.create({
        data: {
          customerAccountId: grcAdminCustomerAccountId,
          vendorCode: vendor.vendorCode,
          name: vendor.name,
          contactEmail: vendor.contactEmail,
          contactPhone: vendor.contactPhone,
          accountManagerName: vendor.accountManagerName,
          serviceCategory: vendor.serviceCategory,
          status: vendor.status,
          onboardedDate: vendor.onboardedDate || null,
        },
      });
      createdVendors[vendor.vendorCode] = created.id;
    } else {
      createdVendors[vendor.vendorCode] = existing.id;
    }
  }
  console.log("✅ TPRM Vendors created");

  // Create TPRM Assessments
  const tprmAssessments = [
    { assessmentCode: "ASM001", vendorCode: "VEN001", assessmentType: "Onboarding Assessment", status: "Completed", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-01-10"), completionDate: new Date("2025-01-20"), questionnaireTemplate: "Standard Onboarding v2" },
    { assessmentCode: "ASM002", vendorCode: "VEN002", assessmentType: "Onboarding Assessment", status: "Approved", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-01-25"), approvalDate: new Date("2025-02-05"), completionDate: new Date("2025-02-05"), questionnaireTemplate: "Cloud Provider Assessment" },
    { assessmentCode: "ASM003", vendorCode: "VEN003", assessmentType: "Onboarding Assessment", status: "In Progress", vendorSubmissionDate: new Date("2025-06-01"), questionnaireTemplate: "Consulting Firm Assessment" },
    { assessmentCode: "ASM004", vendorCode: "VEN004", assessmentType: "Onboarding Assessment", status: "Submitted", vendorSubmissionDate: new Date("2025-05-15"), questionnaireTemplate: "Security Vendor Assessment" },
    { assessmentCode: "ASM005", vendorCode: "VEN001", assessmentType: "Periodic Assessment", status: "Under Review", vendorSubmissionDate: new Date("2025-07-01"), assessorCompletionDate: new Date("2025-07-10"), questionnaireTemplate: "Annual Review Template" },
    { assessmentCode: "ASM006", vendorCode: "VEN005", assessmentType: "On-Demand Assessment", status: "Completed", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-03-01"), completionDate: new Date("2025-03-15"), questionnaireTemplate: "ERP Security Assessment" },
    { assessmentCode: "ASM007", vendorCode: "VEN006", assessmentType: "Onboarding Assessment", status: "Draft", questionnaireTemplate: "Standard Onboarding v2" },
    { assessmentCode: "ASM008", vendorCode: "VEN007", assessmentType: "Onboarding Assessment", status: "Completed", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-02-20"), completionDate: new Date("2025-03-01"), questionnaireTemplate: "Cloud Provider Assessment" },
    { assessmentCode: "ASM009", vendorCode: "VEN008", assessmentType: "On-Demand Assessment", status: "Returned", assessmentResult: "Deficient", vendorSubmissionDate: new Date("2025-04-01"), approverComment: "Missing critical security documentation. Please resubmit.", questionnaireTemplate: "Database Vendor Assessment" },
    { assessmentCode: "ASM010", vendorCode: "VEN009", assessmentType: "Onboarding Assessment", status: "In Progress", vendorSubmissionDate: new Date("2025-06-10"), questionnaireTemplate: "Standard Onboarding v2" },
    { assessmentCode: "ASM011", vendorCode: "VEN010", assessmentType: "Onboarding Assessment", status: "Approved", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-03-20"), approvalDate: new Date("2025-04-01"), completionDate: new Date("2025-04-01"), questionnaireTemplate: "Security Vendor Assessment" },
    { assessmentCode: "ASM012", vendorCode: "VEN002", assessmentType: "On-Demand Assessment", status: "Submitted", vendorSubmissionDate: new Date("2025-07-15"), questionnaireTemplate: "Cloud Security Review" },
    { assessmentCode: "ASM013", vendorCode: "VEN005", assessmentType: "Assessment Factory", status: "Completed", assessmentResult: "Unsatisfactory", vendorSubmissionDate: new Date("2025-02-01"), completionDate: new Date("2025-02-20"), questionnaireTemplate: "Factory Assessment Template" },
    { assessmentCode: "ASM014", vendorCode: "VEN001", assessmentType: "Assessment Factory", status: "In Progress", vendorSubmissionDate: new Date("2025-08-01"), questionnaireTemplate: "Factory Assessment Template" },
    { assessmentCode: "ASM015", vendorCode: "VEN007", assessmentType: "Assessment Factory", status: "Draft", questionnaireTemplate: "Factory Assessment Template" },
    { assessmentCode: "ASM016", vendorCode: "VEN003", assessmentType: "On-Demand Assessment", status: "Rejected", assessmentResult: "Deficient", vendorSubmissionDate: new Date("2025-05-01"), approverComment: "Vendor does not meet minimum security requirements.", questionnaireTemplate: "Consulting Firm Assessment" },
    { assessmentCode: "ASM017", vendorCode: "VEN004", assessmentType: "On-Demand Assessment", status: "Cancelled", vendorSubmissionDate: new Date("2025-04-20"), questionnaireTemplate: "Security Vendor Assessment" },
    { assessmentCode: "ASM018", vendorCode: "VEN006", assessmentType: "Onboarding Assessment", status: "Submitted", vendorSubmissionDate: new Date("2025-07-01"), questionnaireTemplate: "Standard Onboarding v2" },
    { assessmentCode: "ASM019", vendorCode: "VEN009", assessmentType: "On-Demand Assessment", status: "Under Review", vendorSubmissionDate: new Date("2025-06-20"), questionnaireTemplate: "IT Outsourcing Assessment" },
    { assessmentCode: "ASM020", vendorCode: "VEN010", assessmentType: "On-Demand Assessment", status: "Completed", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-05-10"), completionDate: new Date("2025-05-25"), questionnaireTemplate: "Security Vendor Assessment" },
  ];

  const createdAssessments: { [key: string]: string } = {};
  for (const assessment of tprmAssessments) {
    const existing = await prisma.tPRMAssessment.findFirst({
      where: { customerAccountId: grcAdminCustomerAccountId, assessmentCode: assessment.assessmentCode },
    });
    if (!existing) {
      const created = await prisma.tPRMAssessment.create({
        data: {
          customerAccountId: grcAdminCustomerAccountId,
          assessmentCode: assessment.assessmentCode,
          vendorId: createdVendors[assessment.vendorCode],
          assessmentType: assessment.assessmentType,
          status: assessment.status,
          assessmentResult: assessment.assessmentResult || null,
          vendorSubmissionDate: assessment.vendorSubmissionDate || null,
          assessorCompletionDate: assessment.assessorCompletionDate || null,
          approvalDate: assessment.approvalDate || null,
          completionDate: assessment.completionDate || null,
          initiatedById: superadminUser.id,
          questionnaireTemplate: assessment.questionnaireTemplate || null,
          approverComment: assessment.approverComment || null,
        },
      });
      createdAssessments[assessment.assessmentCode] = created.id;
    } else {
      createdAssessments[assessment.assessmentCode] = existing.id;
    }
  }
  console.log("✅ TPRM Assessments created");

  // Create TPRM Assessment Logs
  const tprmLogs = [
    { assessmentCode: "ASM001", domainName: "Information Security", questionNo: "IS-01", questionTitle: "Data Encryption Policy", logMessage: "Vendor confirmed AES-256 encryption for data at rest", apiUrl: "/api/v1/assessment/submit" },
    { assessmentCode: "ASM001", domainName: "Information Security", questionNo: "IS-02", questionTitle: "Access Control Mechanisms", logMessage: "Multi-factor authentication implemented across all systems", apiUrl: "/api/v1/assessment/submit" },
    { assessmentCode: "ASM001", domainName: "Business Continuity", questionNo: "BC-01", questionTitle: "Disaster Recovery Plan", logMessage: "DR plan reviewed and approved. RTO: 4 hours, RPO: 1 hour", documentName: "IBM_DR_Plan_2025.pdf" },
    { assessmentCode: "ASM002", domainName: "Cloud Security", questionNo: "CS-01", questionTitle: "Data Residency", logMessage: "All data stored in EU region as per contract", apiUrl: "/api/v1/cloud/compliance" },
    { assessmentCode: "ASM002", domainName: "Cloud Security", questionNo: "CS-02", questionTitle: "Service Level Agreement", logMessage: "99.99% uptime SLA confirmed", documentName: "Azure_SLA_2025.pdf" },
    { assessmentCode: "ASM002", domainName: "Compliance", questionNo: "CO-01", questionTitle: "SOC 2 Type II", logMessage: "SOC 2 Type II report provided and verified", documentName: "Azure_SOC2_Report.pdf" },
    { assessmentCode: "ASM003", domainName: "Professional Services", questionNo: "PS-01", questionTitle: "Staff Background Checks", logMessage: "Background check policy document submitted for review" },
    { assessmentCode: "ASM003", domainName: "Data Protection", questionNo: "DP-01", questionTitle: "GDPR Compliance", logMessage: "GDPR compliance assessment in progress" },
    { assessmentCode: "ASM005", domainName: "Information Security", questionNo: "IS-01", questionTitle: "Annual Security Review", logMessage: "Periodic security assessment initiated for IBM", apiUrl: "/api/v1/periodic/review" },
    { assessmentCode: "ASM005", domainName: "Risk Management", questionNo: "RM-01", questionTitle: "Risk Register Update", logMessage: "Vendor risk profile updated with new threat landscape", documentName: "IBM_Risk_Register_2025.pdf" },
    { assessmentCode: "ASM006", domainName: "ERP Security", questionNo: "ERP-01", questionTitle: "User Access Review", logMessage: "Quarterly user access review completed successfully", apiUrl: "/api/v1/sap/access-review" },
    { assessmentCode: "ASM006", domainName: "ERP Security", questionNo: "ERP-02", questionTitle: "Patch Management", logMessage: "All critical patches applied within SLA", documentName: "SAP_Patch_Report_Q1.pdf" },
    { assessmentCode: "ASM008", domainName: "Cloud Security", questionNo: "CS-01", questionTitle: "Infrastructure Security", logMessage: "AWS infrastructure security assessment completed", apiUrl: "/api/v1/aws/security-scan" },
    { assessmentCode: "ASM008", domainName: "Compliance", questionNo: "CO-01", questionTitle: "ISO 27001 Certification", logMessage: "Valid ISO 27001 certificate verified", documentName: "AWS_ISO27001_Cert.pdf" },
    { assessmentCode: "ASM009", domainName: "Database Security", questionNo: "DB-01", questionTitle: "Encryption at Rest", logMessage: "Critical: Database encryption not enabled on legacy systems", apiUrl: "/api/v1/oracle/db-scan" },
    { assessmentCode: "ASM009", domainName: "Database Security", questionNo: "DB-02", questionTitle: "Backup Procedures", logMessage: "Backup documentation incomplete - returned to vendor", documentName: "Oracle_Backup_Policy_Draft.pdf" },
    { assessmentCode: "ASM011", domainName: "Endpoint Security", questionNo: "ES-01", questionTitle: "EDR Capabilities", logMessage: "Advanced EDR capabilities verified and tested", apiUrl: "/api/v1/crowdstrike/edr-test" },
    { assessmentCode: "ASM011", domainName: "Threat Intelligence", questionNo: "TI-01", questionTitle: "Threat Feed Integration", logMessage: "Threat intelligence feed integration confirmed operational", documentName: "CrowdStrike_ThreatFeed_Config.pdf" },
    { assessmentCode: "ASM013", domainName: "ERP Security", questionNo: "ERP-03", questionTitle: "Custom Code Review", logMessage: "Critical vulnerabilities found in custom ABAP code", apiUrl: "/api/v1/sap/code-review" },
    { assessmentCode: "ASM013", domainName: "Compliance", questionNo: "CO-02", questionTitle: "License Compliance", logMessage: "License audit revealed discrepancies in user count", documentName: "SAP_License_Audit.pdf" },
    { assessmentCode: "ASM016", domainName: "Professional Services", questionNo: "PS-02", questionTitle: "NDA Compliance", logMessage: "NDA terms not met - confidential data handling concerns" },
    { assessmentCode: "ASM016", domainName: "Data Protection", questionNo: "DP-02", questionTitle: "Data Handling Procedures", logMessage: "Vendor data handling procedures do not meet minimum requirements", documentName: "Deloitte_DataHandling_Review.pdf" },
    { assessmentCode: "ASM020", domainName: "Endpoint Security", questionNo: "ES-02", questionTitle: "Incident Response", logMessage: "Incident response SLA met - average response time: 15 minutes", apiUrl: "/api/v1/crowdstrike/incident-metrics" },
    { assessmentCode: "ASM020", domainName: "Compliance", questionNo: "CO-03", questionTitle: "PCI DSS Compliance", logMessage: "PCI DSS Level 1 compliance verified", documentName: "CrowdStrike_PCI_Cert.pdf" },
  ];

  for (const log of tprmLogs) {
    const assessmentId = createdAssessments[log.assessmentCode];
    if (assessmentId) {
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId: grcAdminCustomerAccountId,
          assessmentId,
          domainName: log.domainName,
          questionNo: log.questionNo,
          questionTitle: log.questionTitle,
          logMessage: log.logMessage,
          apiUrl: log.apiUrl || null,
          documentName: log.documentName || null,
        },
      });
    }
  }
  console.log("✅ TPRM Assessment Logs created");

  // ==================== EMAIL TEMPLATES (GLOBAL - SYSTEM DEFAULT) ====================
  // Seed all 73 English email templates as system defaults
  // These are available to all customer instances
  await seedEmailTemplates();

  console.log("🎉 Database seeded successfully with all modules!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
