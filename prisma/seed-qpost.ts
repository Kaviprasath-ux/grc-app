import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding QPost Compliance data...");

  const hashedPasswordBaarez = await bcrypt.hash("Baarez@2025", 10);

  // ==================== QPOST CUSTOMER ACCOUNT ====================

  const qpostCustomerAccount = await prisma.customerAccount.upsert({
    where: { code: "QPOST_001" },
    update: { isQpostComplianceEnabled: true, isGrcAdded: false },
    create: {
      id: "qpost-account-1",
      code: "QPOST_001",
      name: "Qatar Post (QPost)",
      isActive: true,
      isGrcAdded: false,
      isTprmAdded: false,
      isQpostComplianceEnabled: true,
    },
  });
  const customerAccountId = qpostCustomerAccount.id;
  console.log("✅ QPost Customer Account created");

  // ==================== SUBSCRIPTION PLAN ====================

  await prisma.subscriptionPlan.upsert({
    where: { id: "subscription-plan-qpost-1" },
    update: {
      expiryDate: new Date("2030-12-31"),
      status: "Active",
    },
    create: {
      id: "subscription-plan-qpost-1",
      customerAccountId,
      startDate: new Date(),
      expiryDate: new Date("2030-12-31"),
      maxFrameworksAllowed: 100,
      maxAccountsAllowed: 50,
      assessmentLimit: 100,
      vendorLimit: 100,
      frameworksUsed: 0,
      accountsUsed: 0,
      status: "Active",
    },
  });
  console.log("✅ QPost Subscription Plan created");

  // ==================== ROLES (ensure they exist) ====================

  const customerAdminRole = await prisma.role.upsert({
    where: { name: "CustomerAdministrator" },
    update: {},
    create: { name: "CustomerAdministrator", description: "Organization-level admin", isSystem: true },
  });

  const contributorRole = await prisma.role.upsert({
    where: { name: "Contributor" },
    update: {},
    create: { name: "Contributor", description: "Creates and edits content across modules", isSystem: true },
  });

  const reviewerRole = await prisma.role.upsert({
    where: { name: "Reviewer" },
    update: {},
    create: { name: "Reviewer", description: "Reviews and approves content", isSystem: true },
  });

  const auditHeadRole = await prisma.role.upsert({
    where: { name: "AuditHead" },
    update: {},
    create: { name: "AuditHead", description: "Full access to Internal Audit module", isSystem: true },
  });

  const auditManagerRole = await prisma.role.upsert({
    where: { name: "AuditManager" },
    update: {},
    create: { name: "AuditManager", description: "Manages audits, assigns auditors, reviews findings", isSystem: true },
  });

  const auditorRole = await prisma.role.upsert({
    where: { name: "Auditor" },
    update: {},
    create: { name: "Auditor", description: "Conducts audits, creates findings", isSystem: true },
  });

  const auditeeRole = await prisma.role.upsert({
    where: { name: "Auditee" },
    update: {},
    create: { name: "Auditee", description: "Receives audit requests, responds to findings", isSystem: true },
  });

  const deptReviewerRole = await prisma.role.upsert({
    where: { name: "DepartmentReviewer" },
    update: {},
    create: { name: "DepartmentReviewer", description: "Reviews content within own department", isSystem: true },
  });

  const deptContributorRole = await prisma.role.upsert({
    where: { name: "DepartmentContributor" },
    update: {},
    create: { name: "DepartmentContributor", description: "Creates/edits content within own department", isSystem: true },
  });

  // ==================== QPOST USERS ====================

  // QPost Admin user
  const qpostAdmin = await prisma.user.upsert({
    where: { userId: "QPOST-ADMIN-001" },
    update: {
      customerAccountId,
      password: hashedPasswordBaarez,
    },
    create: {
      userId: "QPOST-ADMIN-001",
      userName: "qpostadmin",
      email: "admin@qpost.qa",
      password: hashedPasswordBaarez,
      firstName: "QPost",
      lastName: "Admin",
      fullName: "QPost Admin",
      designation: "Compliance Manager",
      role: "CustomerAdministrator",
      function: "Administration",
      isActive: true,
      isBlocked: false,
      customerAccountId,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: qpostAdmin.id, roleId: customerAdminRole.id } },
    update: {},
    create: { userId: qpostAdmin.id, roleId: customerAdminRole.id },
  });
  console.log("✅ QPost Admin user created (qpostadmin / Baarez@2025)");

  // QPost Contributor user
  const qpostUser = await prisma.user.upsert({
    where: { userId: "QPOST-USER-001" },
    update: {
      customerAccountId,
      password: hashedPasswordBaarez,
    },
    create: {
      userId: "QPOST-USER-001",
      userName: "qpostuser",
      email: "user@qpost.qa",
      password: hashedPasswordBaarez,
      firstName: "Ahmed",
      lastName: "Al-Thani",
      fullName: "Ahmed Al-Thani",
      designation: "Compliance Officer",
      role: "Contributor",
      function: "Compliance",
      isActive: true,
      isBlocked: false,
      customerAccountId,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: qpostUser.id, roleId: contributorRole.id } },
    update: {},
    create: { userId: qpostUser.id, roleId: contributorRole.id },
  });
  console.log("✅ QPost Contributor user created (qpostuser / Baarez@2025)");

  // QPost Reviewer user
  const qpostReviewer = await prisma.user.upsert({
    where: { userId: "QPOST-REVIEWER-001" },
    update: {
      customerAccountId,
      password: hashedPasswordBaarez,
    },
    create: {
      userId: "QPOST-REVIEWER-001",
      userName: "qpostreviewer",
      email: "reviewer@qpost.qa",
      password: hashedPasswordBaarez,
      firstName: "Fatima",
      lastName: "Al-Mansouri",
      fullName: "Fatima Al-Mansouri",
      designation: "Compliance Reviewer",
      role: "Reviewer",
      function: "Compliance",
      isActive: true,
      isBlocked: false,
      customerAccountId,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: qpostReviewer.id, roleId: reviewerRole.id } },
    update: {},
    create: { userId: qpostReviewer.id, roleId: reviewerRole.id },
  });
  console.log("✅ QPost Reviewer user created (qpostreviewer / Baarez@2025)");

  // Additional users - one per remaining role
  const additionalUsers = [
    {
      userId: "QPOST-AH-001", userName: "qpost.audithead", email: "audithead@qpost.qa",
      firstName: "Khalid", lastName: "Al-Sulaiti", designation: "Head of Internal Audit",
      role: "AuditHead", function: "Audit", roleId: auditHeadRole.id,
    },
    {
      userId: "QPOST-AM-001", userName: "qpost.auditmgr", email: "auditmgr@qpost.qa",
      firstName: "Nasser", lastName: "Al-Hajri", designation: "Audit Manager",
      role: "AuditManager", function: "Audit", roleId: auditManagerRole.id,
    },
    {
      userId: "QPOST-AUD-001", userName: "qpost.auditor", email: "auditor@qpost.qa",
      firstName: "Youssef", lastName: "Al-Emadi", designation: "Senior Auditor",
      role: "Auditor", function: "Audit", roleId: auditorRole.id,
    },
    {
      userId: "QPOST-AE-001", userName: "qpost.auditee", email: "auditee@qpost.qa",
      firstName: "Maryam", lastName: "Al-Kuwari", designation: "Operations Manager",
      role: "Auditee", function: "Operations", roleId: auditeeRole.id,
    },
    {
      userId: "QPOST-DR-001", userName: "qpost.deptreviewer", email: "deptreviewer@qpost.qa",
      firstName: "Hassan", lastName: "Al-Marri", designation: "IT Department Reviewer",
      role: "DepartmentReviewer", function: "IT", roleId: deptReviewerRole.id,
    },
    {
      userId: "QPOST-DC-001", userName: "qpost.deptcontrib", email: "deptcontrib@qpost.qa",
      firstName: "Noura", lastName: "Al-Naimi", designation: "Compliance Specialist",
      role: "DepartmentContributor", function: "Compliance", roleId: deptContributorRole.id,
    },
  ];

  const createdUserIds: Record<string, string> = {};
  createdUserIds["qpostadmin"] = qpostAdmin.id;
  createdUserIds["qpostuser"] = qpostUser.id;
  createdUserIds["qpostreviewer"] = qpostReviewer.id;

  for (const u of additionalUsers) {
    const created = await prisma.user.upsert({
      where: { userId: u.userId },
      update: { customerAccountId, password: hashedPasswordBaarez },
      create: {
        userId: u.userId,
        userName: u.userName,
        email: u.email,
        password: hashedPasswordBaarez,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName} ${u.lastName}`,
        designation: u.designation,
        role: u.role,
        function: u.function,
        isActive: true,
        isBlocked: false,
        customerAccountId,
      },
    });
    createdUserIds[u.userName] = created.id;

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: u.roleId } },
      update: {},
      create: { userId: created.id, roleId: u.roleId },
    });
  }
  console.log("✅ Additional users created (6 users, all password: Baarez@2025)");

  // ==================== CREATE ORGANIZATION ====================
  console.log("\n🏛️ Creating Organization...");

  const organization = await prisma.organization.upsert({
    where: { id: "org-qpost" },
    update: {},
    create: {
      id: "org-qpost",
      customerAccountId,
      name: "Qatar Post (QPost)",
      email: "info@qpost.com.qa",
      phone: "+974 4440 4440",
      establishedDate: "1969-01-01",
      employeeCount: 1500,
      branchCount: 32,
      headOfficeLocation: "Doha, Qatar",
      headOfficeAddress: "P.O. Box 71, Doha, Qatar",
      website: "https://www.qpost.com.qa",
      description: "Qatar Post (QPost) is the national postal service of Qatar, providing postal, logistics, and digital services. As a government entity under the Ministry of Communications and Information Technology, QPost ensures secure and reliable mail delivery, e-commerce logistics, and compliance with national information assurance regulations.",
      vision: "To be a world-class postal and logistics provider, driving Qatar's digital transformation and ensuring secure communication for all citizens and businesses.",
      mission: "Delivering innovative postal, logistics, and digital solutions that meet the highest standards of quality, security, and regulatory compliance in line with Qatar National Vision 2030.",
      value: "Excellence, Integrity, Innovation, Customer Focus, National Pride",
      ceoMessage: "At Qatar Post, we are committed to serving our nation by providing secure, efficient, and innovative postal and logistics services. Our focus on compliance and information assurance ensures that we meet the highest standards of trust and reliability.",
      facebook: "https://facebook.com/QatarPost",
      youtube: "https://youtube.com/@QatarPost",
      twitter: "https://twitter.com/QatarPost",
      linkedin: "https://linkedin.com/company/qatar-post",
    },
  });
  console.log("  ✓ Organization created");

  // Create Branches
  await prisma.branch.deleteMany({ where: { organizationId: organization.id } });
  const branches = [
    { location: "Al Corniche, Doha", address: "Al Corniche Post Office, West Bay, Doha" },
    { location: "Al Wakra", address: "Al Wakra Post Office, Al Wakra Main Road" },
    { location: "Al Khor", address: "Al Khor Post Office, Al Khor Industrial Area" },
    { location: "Lusail City", address: "Lusail Post Office, Lusail Boulevard" },
    { location: "Education City", address: "Education City Post Office, Qatar Foundation" },
  ];
  for (const branch of branches) {
    await prisma.branch.create({
      data: { ...branch, organizationId: organization.id },
    });
  }
  console.log("  ✓ Branch offices created");

  // Create Data Centers
  await prisma.dataCenter.deleteMany({ where: { organizationId: organization.id } });
  const dataCenters = [
    { locationType: "On-Prem", address: "Primary Data Center, Doha, Qatar" },
    { locationType: "On-Prem", address: "Disaster Recovery Site, Al Khor, Qatar" },
    { locationType: "Outsourced", vendor: "Microsoft Azure (Qatar Central)" },
  ];
  for (const dc of dataCenters) {
    await prisma.dataCenter.create({
      data: { ...dc, organizationId: organization.id },
    });
  }
  console.log("  ✓ Data centers created");

  // Create Cloud Providers
  await prisma.cloudProvider.deleteMany({ where: { organizationId: organization.id } });
  const cloudProviders = [
    { name: "Microsoft Azure", serviceType: "IaaS" },
    { name: "Oracle Cloud", serviceType: "PaaS" },
    { name: "SAP S/4HANA Cloud", serviceType: "SaaS" },
    { name: "ServiceNow", serviceType: "SaaS" },
  ];
  for (const cp of cloudProviders) {
    await prisma.cloudProvider.create({
      data: { ...cp, organizationId: organization.id },
    });
  }
  console.log("  ✓ Cloud providers created");

  // ==================== CREATE DEPARTMENTS ====================
  console.log("\n🏢 Creating Departments...");

  const departmentData = [
    { name: "Executive Management", description: "CEO office and senior leadership" },
    { name: "Information Technology", description: "IT infrastructure, systems, and digital services" },
    { name: "Information Security", description: "Cybersecurity, NIA compliance, and data protection" },
    { name: "Risk & Compliance", description: "Enterprise risk management and regulatory compliance" },
    { name: "Internal Audit", description: "Internal audit and assurance services" },
    { name: "Finance & Accounting", description: "Financial operations, budgeting, and reporting" },
    { name: "Human Resources", description: "HR operations, training, and talent management" },
    { name: "Operations & Logistics", description: "Mail sorting, delivery, and logistics operations" },
    { name: "Customer Service", description: "Customer support and service delivery" },
    { name: "Legal & Regulatory Affairs", description: "Legal counsel and regulatory affairs" },
  ];

  const createdDepts: Record<string, string> = {};
  for (const dept of departmentData) {
    const created = await prisma.department.upsert({
      where: {
        customerAccountId_name: { customerAccountId, name: dept.name },
      },
      update: { description: dept.description },
      create: { customerAccountId, ...dept },
    });
    createdDepts[dept.name] = created.id;
  }
  console.log("  ✓ Departments created");

  // Update all users with department assignments
  const userDeptMap: Record<string, string> = {
    "qpostadmin": "Risk & Compliance",
    "qpostuser": "Risk & Compliance",
    "qpostreviewer": "Information Security",
    "qpost.audithead": "Internal Audit",
    "qpost.auditmgr": "Internal Audit",
    "qpost.auditor": "Internal Audit",
    "qpost.auditee": "Operations & Logistics",
    "qpost.deptreviewer": "Information Technology",
    "qpost.deptcontrib": "Risk & Compliance",
  };

  for (const [userName, deptName] of Object.entries(userDeptMap)) {
    if (createdUserIds[userName] && createdDepts[deptName]) {
      await prisma.user.update({
        where: { id: createdUserIds[userName] },
        data: { departmentId: createdDepts[deptName] },
      });
    }
  }
  console.log("  ✓ Users assigned to departments");

  // ==================== CREATE STAKEHOLDERS ====================
  console.log("\n🤝 Creating Stakeholders...");

  const stakeholders = [
    { name: "Board of Directors", email: "board@qpost.com.qa", type: "Internal", status: "Active" },
    { name: "Ministry of Communications & IT", email: "info@mcit.gov.qa", type: "External", status: "Active" },
    { name: "National Cyber Security Agency (NCSA)", email: "info@ncsa.gov.qa", type: "External", status: "Active" },
    { name: "Qatar Central Bank (QCB)", email: "compliance@qcb.gov.qa", type: "External", status: "Active" },
    { name: "External Auditors - Deloitte", email: "audit@deloitte.com", type: "External", status: "Active" },
    { name: "Technology Vendor - Oracle", email: "support@oracle.com", type: "Third Party", status: "Active" },
    { name: "Cloud Provider - Microsoft Azure", email: "enterprise@microsoft.com", type: "Third Party", status: "Active" },
  ];

  for (const stakeholder of stakeholders) {
    await prisma.stakeholder.upsert({
      where: { id: `qpost-stakeholder-${stakeholder.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `qpost-stakeholder-${stakeholder.name.toLowerCase().replace(/\s+/g, "-")}`,
        customerAccountId,
        ...stakeholder,
      },
    });
  }
  console.log("  ✓ Stakeholders created");

  // ==================== CREATE PROCESSES ====================
  console.log("\n⚙️ Creating Processes...");

  const processes = [
    { code: "PRC-OPS-001", name: "Mail Sorting & Processing", type: "Primary", department: "Operations & Logistics", frequency: "Daily", nature: "Manual + Automated" },
    { code: "PRC-OPS-002", name: "Last-Mile Delivery", type: "Primary", department: "Operations & Logistics", frequency: "Daily", nature: "Manual" },
    { code: "PRC-IT-001", name: "User Access Management", type: "Supporting", department: "Information Technology", frequency: "Daily", nature: "Manual + Automated" },
    { code: "PRC-IT-002", name: "Backup & Recovery", type: "Supporting", department: "Information Technology", frequency: "Daily", nature: "Automated" },
    { code: "PRC-IT-003", name: "Change Management", type: "Supporting", department: "Information Technology", frequency: "Weekly", nature: "Manual" },
    { code: "PRC-SEC-001", name: "Vulnerability Management", type: "Supporting", department: "Information Security", frequency: "Monthly", nature: "Manual + Automated" },
    { code: "PRC-SEC-002", name: "Incident Response", type: "Primary", department: "Information Security", frequency: "As needed", nature: "Manual" },
    { code: "PRC-COM-001", name: "Regulatory Compliance Monitoring", type: "Primary", department: "Risk & Compliance", frequency: "Monthly", nature: "Manual" },
    { code: "PRC-AUD-001", name: "Internal Audit", type: "Primary", department: "Internal Audit", frequency: "Quarterly", nature: "Manual" },
    { code: "PRC-CS-001", name: "Customer Complaint Handling", type: "Primary", department: "Customer Service", frequency: "Daily", nature: "Manual" },
  ];

  for (const process of processes) {
    await prisma.process.upsert({
      where: {
        customerAccountId_processCode: {
          customerAccountId,
          processCode: process.code,
        },
      },
      update: {},
      create: {
        customerAccountId,
        processCode: process.code,
        name: process.name,
        processType: process.type,
        departmentId: createdDepts[process.department],
        ownerId: qpostAdmin.id,
        status: "Active",
        processFrequency: process.frequency,
        natureOfImplementation: process.nature,
        riskRating: "Medium",
      },
    });
  }
  console.log("  ✓ Processes created");

  // ==================== CREATE SERVICES ====================
  console.log("\n🛠️ Creating Services...");

  const services = [
    { title: "Express Mail Service (EMS)", description: "International express mail delivery service", serviceUser: "External", serviceCategory: "Postal Services" },
    { title: "E-Commerce Logistics", description: "Last-mile delivery for online retailers", serviceUser: "External", serviceCategory: "Logistics Services" },
    { title: "PO Box Services", description: "Private and corporate PO box rental services", serviceUser: "External", serviceCategory: "Postal Services" },
    { title: "Digital Postal Services", description: "Electronic mail and digital document services", serviceUser: "External", serviceCategory: "Digital Services" },
    { title: "IT Help Desk", description: "Internal IT support and service management", serviceUser: "Internal", serviceCategory: "IT Services" },
    { title: "HR Self-Service Portal", description: "Employee self-service for HR functions", serviceUser: "Internal", serviceCategory: "HR Services" },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: `qpost-svc-${service.title.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `qpost-svc-${service.title.toLowerCase().replace(/\s+/g, "-")}`,
        customerAccountId,
        title: service.title,
        description: service.description,
        serviceUser: service.serviceUser,
        serviceCategory: service.serviceCategory,
      },
    });
  }
  console.log("  ✓ Services created");

  // ==================== QPOST FRAMEWORKS ====================

  const niaFramework = await prisma.qPostFramework.upsert({
    where: { customerAccountId_name: { customerAccountId, name: "NIA - National Information Assurance Policy" } },
    update: {},
    create: {
      id: "qpost-fw-nia",
      customerAccountId,
      code: "NIA-2.0",
      name: "NIA - National Information Assurance Policy",
      description: "Qatar National Information Assurance Policy v2.0 - Establishes the information security requirements for all government entities in Qatar.",
      version: "2.0",
      type: "Regulation",
      status: "Subscribed",
      country: "Qatar",
      industry: "Government",
      isCustom: false,
      compliancePercentage: 42,
      policyPercentage: 35,
      evidencePercentage: 28,
    },
  });
  console.log("✅ NIA Framework created");

  const pdpFramework = await prisma.qPostFramework.upsert({
    where: { customerAccountId_name: { customerAccountId, name: "Qatar Personal Data Protection Law" } },
    update: {},
    create: {
      id: "qpost-fw-pdp",
      customerAccountId,
      code: "PDPL-2024",
      name: "Qatar Personal Data Protection Law",
      description: "Law No. 13 of 2016 on Personal Data Protection - Regulates the processing of personal data in Qatar.",
      version: "2024",
      type: "Regulation",
      status: "Subscribed",
      country: "Qatar",
      industry: "All",
      isCustom: false,
      compliancePercentage: 55,
      policyPercentage: 60,
      evidencePercentage: 40,
    },
  });
  console.log("✅ PDPL Framework created");

  const isoFramework = await prisma.qPostFramework.upsert({
    where: { customerAccountId_name: { customerAccountId, name: "ISO 27001:2022" } },
    update: {},
    create: {
      id: "qpost-fw-iso27001",
      customerAccountId,
      code: "ISO-27001",
      name: "ISO 27001:2022",
      description: "Information security management systems - Requirements. International standard for managing information security.",
      version: "2022",
      type: "Framework",
      status: "Subscribed",
      country: "International",
      industry: "All",
      isCustom: false,
      compliancePercentage: 68,
      policyPercentage: 72,
      evidencePercentage: 55,
    },
  });
  console.log("✅ ISO 27001 Framework created");

  // ==================== REQUIREMENT CATEGORIES ====================

  // NIA Categories
  const niaCat1 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: niaFramework.id, name: "Information Security Governance" } },
    update: {},
    create: {
      id: "qpost-cat-nia-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      code: "ISG",
      name: "Information Security Governance",
      description: "Governance structure for information security management",
      sortOrder: 1,
    },
  });

  const niaCat2 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: niaFramework.id, name: "Asset Management" } },
    update: {},
    create: {
      id: "qpost-cat-nia-2",
      customerAccountId,
      frameworkId: niaFramework.id,
      code: "AM",
      name: "Asset Management",
      description: "Management and protection of organizational assets",
      sortOrder: 2,
    },
  });

  const niaCat3 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: niaFramework.id, name: "Access Control" } },
    update: {},
    create: {
      id: "qpost-cat-nia-3",
      customerAccountId,
      frameworkId: niaFramework.id,
      code: "AC",
      name: "Access Control",
      description: "Access control policies and procedures",
      sortOrder: 3,
    },
  });

  const niaCat4 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: niaFramework.id, name: "Incident Management" } },
    update: {},
    create: {
      id: "qpost-cat-nia-4",
      customerAccountId,
      frameworkId: niaFramework.id,
      code: "IM",
      name: "Incident Management",
      description: "Security incident management and response",
      sortOrder: 4,
    },
  });

  // PDPL Categories
  const pdpCat1 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: pdpFramework.id, name: "Data Collection & Processing" } },
    update: {},
    create: {
      id: "qpost-cat-pdp-1",
      customerAccountId,
      frameworkId: pdpFramework.id,
      code: "DCP",
      name: "Data Collection & Processing",
      description: "Requirements for lawful collection and processing of personal data",
      sortOrder: 1,
    },
  });

  const pdpCat2 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: pdpFramework.id, name: "Data Subject Rights" } },
    update: {},
    create: {
      id: "qpost-cat-pdp-2",
      customerAccountId,
      frameworkId: pdpFramework.id,
      code: "DSR",
      name: "Data Subject Rights",
      description: "Rights of individuals regarding their personal data",
      sortOrder: 2,
    },
  });

  const pdpCat3 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: pdpFramework.id, name: "Cross-Border Data Transfer" } },
    update: {},
    create: {
      id: "qpost-cat-pdp-3",
      customerAccountId,
      frameworkId: pdpFramework.id,
      code: "CBDT",
      name: "Cross-Border Data Transfer",
      description: "Requirements for transferring personal data outside Qatar",
      sortOrder: 3,
    },
  });

  // ISO 27001 Categories
  const isoCat1 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: isoFramework.id, name: "Organizational Controls" } },
    update: {},
    create: {
      id: "qpost-cat-iso-1",
      customerAccountId,
      frameworkId: isoFramework.id,
      code: "A.5",
      name: "Organizational Controls",
      description: "Organizational information security controls",
      sortOrder: 1,
    },
  });

  const isoCat2 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: isoFramework.id, name: "People Controls" } },
    update: {},
    create: {
      id: "qpost-cat-iso-2",
      customerAccountId,
      frameworkId: isoFramework.id,
      code: "A.6",
      name: "People Controls",
      description: "People-related information security controls",
      sortOrder: 2,
    },
  });

  const isoCat3 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: isoFramework.id, name: "Physical Controls" } },
    update: {},
    create: {
      id: "qpost-cat-iso-3",
      customerAccountId,
      frameworkId: isoFramework.id,
      code: "A.7",
      name: "Physical Controls",
      description: "Physical and environmental security controls",
      sortOrder: 3,
    },
  });

  const isoCat4 = await prisma.qPostRequirementCategory.upsert({
    where: { frameworkId_name: { frameworkId: isoFramework.id, name: "Technological Controls" } },
    update: {},
    create: {
      id: "qpost-cat-iso-4",
      customerAccountId,
      frameworkId: isoFramework.id,
      code: "A.8",
      name: "Technological Controls",
      description: "Technology-related information security controls",
      sortOrder: 4,
    },
  });

  console.log("✅ Requirement Categories created");

  // ==================== REQUIREMENTS ====================

  // NIA Requirements - Information Security Governance
  const niaReq1 = await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "ISG-001" } },
    update: {},
    create: {
      id: "qpost-req-nia-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat1.id,
      code: "ISG-001",
      name: "Information Security Policy",
      description: "The organization shall establish, implement, and maintain an information security policy approved by management.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  // Sub-requirements under ISG-001
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "ISG-001.1" } },
    update: {},
    create: {
      id: "qpost-req-nia-1-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat1.id,
      parentId: niaReq1.id,
      code: "ISG-001.1",
      name: "Policy Review Cycle",
      description: "The information security policy shall be reviewed at least annually or when significant changes occur.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 2,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "ISG-001.2" } },
    update: {},
    create: {
      id: "qpost-req-nia-1-2",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat1.id,
      parentId: niaReq1.id,
      code: "ISG-001.2",
      name: "Policy Communication",
      description: "The information security policy shall be communicated to all employees and relevant stakeholders.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 2,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Partially Implemented",
      controlCompliance: "Partial Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "ISG-002" } },
    update: {},
    create: {
      id: "qpost-req-nia-2",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat1.id,
      code: "ISG-002",
      name: "Security Organization Structure",
      description: "The organization shall define roles and responsibilities for information security, including a Chief Information Security Officer (CISO).",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "ISG-003" } },
    update: {},
    create: {
      id: "qpost-req-nia-3",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat1.id,
      code: "ISG-003",
      name: "Risk Management Program",
      description: "The organization shall implement a formal risk management program covering identification, assessment, treatment, and monitoring of information security risks.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 3,
      applicability: "Applicable",
      implementationStatus: "Partially Implemented",
      controlCompliance: "Partial Compliant",
    },
  });

  // NIA Requirements - Asset Management
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "AM-001" } },
    update: {},
    create: {
      id: "qpost-req-nia-am-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat2.id,
      code: "AM-001",
      name: "Asset Inventory",
      description: "The organization shall maintain a comprehensive inventory of all information assets.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "AM-002" } },
    update: {},
    create: {
      id: "qpost-req-nia-am-2",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat2.id,
      code: "AM-002",
      name: "Asset Classification",
      description: "Information assets shall be classified according to their sensitivity and criticality to the organization.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Not Implemented",
      controlCompliance: "Non Compliant",
    },
  });

  // NIA Requirements - Access Control
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "AC-001" } },
    update: {},
    create: {
      id: "qpost-req-nia-ac-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat3.id,
      code: "AC-001",
      name: "Access Control Policy",
      description: "An access control policy shall be established and enforced based on business and security requirements.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "AC-002" } },
    update: {},
    create: {
      id: "qpost-req-nia-ac-2",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat3.id,
      code: "AC-002",
      name: "User Access Management",
      description: "Formal procedures shall be in place for user registration, de-registration, and access rights provisioning.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Partially Implemented",
      controlCompliance: "Partial Compliant",
    },
  });

  // NIA Requirements - Incident Management
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: niaFramework.id, code: "IM-001" } },
    update: {},
    create: {
      id: "qpost-req-nia-im-1",
      customerAccountId,
      frameworkId: niaFramework.id,
      categoryId: niaCat4.id,
      code: "IM-001",
      name: "Incident Response Plan",
      description: "The organization shall establish and maintain an incident response plan for information security incidents.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  // PDPL Requirements
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: pdpFramework.id, code: "DCP-001" } },
    update: {},
    create: {
      id: "qpost-req-pdp-1",
      customerAccountId,
      frameworkId: pdpFramework.id,
      categoryId: pdpCat1.id,
      code: "DCP-001",
      name: "Lawful Basis for Processing",
      description: "Personal data shall only be processed when there is a lawful basis, including consent, contractual necessity, legal obligation, or legitimate interest.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: pdpFramework.id, code: "DCP-002" } },
    update: {},
    create: {
      id: "qpost-req-pdp-2",
      customerAccountId,
      frameworkId: pdpFramework.id,
      categoryId: pdpCat1.id,
      code: "DCP-002",
      name: "Data Minimization",
      description: "Personal data collected shall be adequate, relevant, and limited to what is necessary for the purposes of processing.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Partially Implemented",
      controlCompliance: "Partial Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: pdpFramework.id, code: "DSR-001" } },
    update: {},
    create: {
      id: "qpost-req-pdp-3",
      customerAccountId,
      frameworkId: pdpFramework.id,
      categoryId: pdpCat2.id,
      code: "DSR-001",
      name: "Right of Access",
      description: "Data subjects shall have the right to access their personal data and obtain information about its processing.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Not Implemented",
      controlCompliance: "Non Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: pdpFramework.id, code: "DSR-002" } },
    update: {},
    create: {
      id: "qpost-req-pdp-4",
      customerAccountId,
      frameworkId: pdpFramework.id,
      categoryId: pdpCat2.id,
      code: "DSR-002",
      name: "Right to Rectification",
      description: "Data subjects shall have the right to request correction of inaccurate personal data.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: pdpFramework.id, code: "CBDT-001" } },
    update: {},
    create: {
      id: "qpost-req-pdp-5",
      customerAccountId,
      frameworkId: pdpFramework.id,
      categoryId: pdpCat3.id,
      code: "CBDT-001",
      name: "Cross-Border Transfer Safeguards",
      description: "Personal data shall not be transferred outside Qatar unless adequate safeguards are in place as approved by the competent authority.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Not Implemented",
      controlCompliance: "Non Compliant",
    },
  });

  // ISO 27001 Requirements
  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.5.1" } },
    update: {},
    create: {
      id: "qpost-req-iso-1",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat1.id,
      code: "A.5.1",
      name: "Policies for Information Security",
      description: "A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.5.2" } },
    update: {},
    create: {
      id: "qpost-req-iso-2",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat1.id,
      code: "A.5.2",
      name: "Information Security Roles and Responsibilities",
      description: "All information security responsibilities shall be defined and allocated.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.6.1" } },
    update: {},
    create: {
      id: "qpost-req-iso-3",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat2.id,
      code: "A.6.1",
      name: "Screening",
      description: "Background verification checks on all candidates for employment shall be carried out in accordance with relevant laws, regulations and ethics.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Partially Implemented",
      controlCompliance: "Partial Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.7.1" } },
    update: {},
    create: {
      id: "qpost-req-iso-4",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat3.id,
      code: "A.7.1",
      name: "Physical Security Perimeters",
      description: "Security perimeters shall be defined and used to protect areas that contain either sensitive or critical information and information processing facilities.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.8.1" } },
    update: {},
    create: {
      id: "qpost-req-iso-5",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat4.id,
      code: "A.8.1",
      name: "User Endpoint Devices",
      description: "Information stored on, processed by or accessible via user endpoint devices shall be protected.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 1,
      applicability: "Applicable",
      implementationStatus: "Not Implemented",
      controlCompliance: "Non Compliant",
    },
  });

  await prisma.qPostRequirement.upsert({
    where: { frameworkId_code: { frameworkId: isoFramework.id, code: "A.8.2" } },
    update: {},
    create: {
      id: "qpost-req-iso-6",
      customerAccountId,
      frameworkId: isoFramework.id,
      categoryId: isoCat4.id,
      code: "A.8.2",
      name: "Privileged Access Rights",
      description: "The allocation and use of privileged access rights shall be restricted and managed.",
      requirementType: "Mandatory",
      chapterType: "Domain",
      level: 1,
      sortOrder: 2,
      applicability: "Applicable",
      implementationStatus: "Implemented",
      controlCompliance: "Compliant",
    },
  });

  console.log("✅ Requirements created (20 total across 3 frameworks)");

  // ==================== QPOST POLICIES (GOVERNANCE) ====================

  const policy1 = await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-001" } },
    update: {},
    create: {
      id: "qpost-pol-1",
      customerAccountId,
      code: "QP-POL-001",
      name: "Information Security Policy",
      version: "2.1",
      documentType: "Policy",
      status: "Published",
      assigneeId: qpostUser.id,
      approverId: qpostAdmin.id,
      effectiveDate: new Date("2025-01-15"),
      reviewDate: new Date("2026-01-15"),
      recurrence: "Annual",
      content: "This policy establishes the framework for information security management at Qatar Post.",
    },
  });

  const policy2 = await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-002" } },
    update: {},
    create: {
      id: "qpost-pol-2",
      customerAccountId,
      code: "QP-POL-002",
      name: "Data Protection & Privacy Policy",
      version: "1.0",
      documentType: "Policy",
      status: "Published",
      assigneeId: qpostUser.id,
      approverId: qpostAdmin.id,
      effectiveDate: new Date("2025-03-01"),
      reviewDate: new Date("2026-03-01"),
      recurrence: "Annual",
      content: "This policy defines the principles and procedures for handling personal data in compliance with Qatar PDPL.",
    },
  });

  const policy3 = await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-003" } },
    update: {},
    create: {
      id: "qpost-pol-3",
      customerAccountId,
      code: "QP-POL-003",
      name: "Access Control Policy",
      version: "1.5",
      documentType: "Policy",
      status: "Under Review",
      assigneeId: qpostReviewer.id,
      approverId: qpostAdmin.id,
      effectiveDate: new Date("2024-06-01"),
      reviewDate: new Date("2025-06-01"),
      recurrence: "Annual",
      content: "This policy governs how access to information systems and data is granted, managed, and revoked.",
    },
  });

  await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-004" } },
    update: {},
    create: {
      id: "qpost-pol-4",
      customerAccountId,
      code: "QP-POL-004",
      name: "Incident Response Procedure",
      version: "1.2",
      documentType: "Procedure",
      status: "Published",
      assigneeId: qpostUser.id,
      approverId: qpostAdmin.id,
      effectiveDate: new Date("2025-02-01"),
      reviewDate: new Date("2026-02-01"),
      recurrence: "Annual",
    },
  });

  await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-005" } },
    update: {},
    create: {
      id: "qpost-pol-5",
      customerAccountId,
      code: "QP-POL-005",
      name: "Acceptable Use Policy",
      version: "3.0",
      documentType: "Policy",
      status: "Published",
      assigneeId: qpostUser.id,
      approverId: qpostAdmin.id,
      effectiveDate: new Date("2025-01-01"),
      reviewDate: new Date("2026-01-01"),
      recurrence: "Annual",
    },
  });

  await prisma.qPostPolicy.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-POL-006" } },
    update: {},
    create: {
      id: "qpost-pol-6",
      customerAccountId,
      code: "QP-POL-006",
      name: "Business Continuity Plan",
      version: "1.0",
      documentType: "Plan",
      status: "Draft",
      assigneeId: qpostReviewer.id,
      approverId: qpostAdmin.id,
      reviewDate: new Date("2026-06-01"),
      recurrence: "Biannual",
    },
  });

  console.log("✅ QPost Policies created (6 total)");

  // ==================== QPOST EVIDENCES ====================

  const evidence1 = await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-001" } },
    update: {},
    create: {
      id: "qpost-ev-1",
      customerAccountId,
      evidenceCode: "QP-EV-001",
      name: "Security Policy Approval Record",
      description: "Board-approved information security policy document with signatures.",
      frameworkId: niaFramework.id,
      assigneeId: qpostUser.id,
      dueDate: new Date("2026-06-30"),
      reviewDate: new Date("2026-01-15"),
      recurrence: "Annual",
      status: "Submitted",
    },
  });

  const evidence2 = await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-002" } },
    update: {},
    create: {
      id: "qpost-ev-2",
      customerAccountId,
      evidenceCode: "QP-EV-002",
      name: "Access Control Matrix",
      description: "Complete access control matrix showing user roles and system permissions.",
      frameworkId: niaFramework.id,
      assigneeId: qpostUser.id,
      dueDate: new Date("2026-03-31"),
      recurrence: "Quarterly",
      status: "Submitted",
    },
  });

  const evidence3 = await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-003" } },
    update: {},
    create: {
      id: "qpost-ev-3",
      customerAccountId,
      evidenceCode: "QP-EV-003",
      name: "Data Processing Register",
      description: "Register of all personal data processing activities as required by PDPL.",
      frameworkId: pdpFramework.id,
      assigneeId: qpostReviewer.id,
      dueDate: new Date("2026-04-15"),
      recurrence: "Quarterly",
      status: "Not Uploaded",
    },
  });

  await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-004" } },
    update: {},
    create: {
      id: "qpost-ev-4",
      customerAccountId,
      evidenceCode: "QP-EV-004",
      name: "Incident Response Test Results",
      description: "Results from the latest incident response tabletop exercise.",
      frameworkId: niaFramework.id,
      assigneeId: qpostUser.id,
      dueDate: new Date("2026-05-30"),
      recurrence: "Biannual",
      status: "Overdue",
    },
  });

  await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-005" } },
    update: {},
    create: {
      id: "qpost-ev-5",
      customerAccountId,
      evidenceCode: "QP-EV-005",
      name: "Asset Inventory Report",
      description: "Complete information asset inventory with classification labels.",
      frameworkId: niaFramework.id,
      assigneeId: qpostUser.id,
      dueDate: new Date("2026-07-31"),
      recurrence: "Annual",
      status: "Submitted",
    },
  });

  await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-006" } },
    update: {},
    create: {
      id: "qpost-ev-6",
      customerAccountId,
      evidenceCode: "QP-EV-006",
      name: "DPIA Report - Customer Portal",
      description: "Data Protection Impact Assessment for the customer-facing portal.",
      frameworkId: pdpFramework.id,
      assigneeId: qpostReviewer.id,
      dueDate: new Date("2026-02-28"),
      recurrence: "Annual",
      status: "Approved",
    },
  });

  await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-007" } },
    update: {},
    create: {
      id: "qpost-ev-7",
      customerAccountId,
      evidenceCode: "QP-EV-007",
      name: "ISO 27001 Certification",
      description: "Valid ISO 27001 certification from accredited body.",
      frameworkId: isoFramework.id,
      assigneeId: qpostAdmin.id,
      dueDate: new Date("2027-12-31"),
      recurrence: "Triennial",
      status: "Submitted",
    },
  });

  await prisma.qPostEvidence.upsert({
    where: { customerAccountId_evidenceCode: { customerAccountId, evidenceCode: "QP-EV-008" } },
    update: {},
    create: {
      id: "qpost-ev-8",
      customerAccountId,
      evidenceCode: "QP-EV-008",
      name: "Security Awareness Training Records",
      description: "Employee completion records for annual security awareness training.",
      frameworkId: isoFramework.id,
      assigneeId: qpostUser.id,
      dueDate: new Date("2026-12-31"),
      recurrence: "Annual",
      status: "Not Uploaded",
    },
  });

  console.log("✅ QPost Evidences created (8 total)");

  // ==================== LINK REQUIREMENTS TO POLICIES ====================

  const reqPolicyLinks = [
    { requirementId: "qpost-req-nia-1", policyId: policy1.id },
    { requirementId: "qpost-req-nia-1-1", policyId: policy1.id },
    { requirementId: "qpost-req-nia-ac-1", policyId: policy3.id },
    { requirementId: "qpost-req-pdp-1", policyId: policy2.id },
    { requirementId: "qpost-req-pdp-2", policyId: policy2.id },
  ];

  for (const link of reqPolicyLinks) {
    await prisma.qPostRequirementPolicy.upsert({
      where: { requirementId_policyId: { requirementId: link.requirementId, policyId: link.policyId } },
      update: {},
      create: link,
    });
  }
  console.log("✅ Requirement-Policy links created");

  // ==================== LINK REQUIREMENTS TO EVIDENCES ====================

  const reqEvidenceLinks = [
    { requirementId: "qpost-req-nia-1", evidenceId: evidence1.id },
    { requirementId: "qpost-req-nia-ac-1", evidenceId: evidence2.id },
    { requirementId: "qpost-req-pdp-1", evidenceId: evidence3.id },
    { requirementId: "qpost-req-nia-am-1", evidenceId: "qpost-ev-5" },
  ];

  for (const link of reqEvidenceLinks) {
    await prisma.qPostRequirementEvidence.upsert({
      where: { requirementId_evidenceId: { requirementId: link.requirementId, evidenceId: link.evidenceId } },
      update: {},
      create: link,
    });
  }
  console.log("✅ Requirement-Evidence links created");

  // ==================== QPOST EXCEPTIONS ====================

  await prisma.qPostException.upsert({
    where: { customerAccountId_exceptionCode: { customerAccountId, exceptionCode: "QP-EXC-001" } },
    update: {},
    create: {
      id: "qpost-exc-1",
      customerAccountId,
      exceptionCode: "QP-EXC-001",
      name: "Legacy System Access Exception",
      description: "Temporary exception for legacy postal tracking system that cannot support MFA. Migration planned for Q3 2026.",
      category: "Compliance",
      frameworkId: niaFramework.id,
      requirementId: "qpost-req-nia-ac-1",
      requesterId: qpostUser.id,
      approverId: qpostAdmin.id,
      status: "Approved",
      approvedBy: "QPost Admin",
      approvedDate: new Date("2025-12-01"),
      startDate: new Date("2025-12-01"),
      endDate: new Date("2026-09-30"),
    },
  });

  await prisma.qPostException.upsert({
    where: { customerAccountId_exceptionCode: { customerAccountId, exceptionCode: "QP-EXC-002" } },
    update: {},
    create: {
      id: "qpost-exc-2",
      customerAccountId,
      exceptionCode: "QP-EXC-002",
      name: "Cross-Border Data Transfer - Partner API",
      description: "Exception for international parcel tracking data shared with partner postal services.",
      category: "Privacy",
      frameworkId: pdpFramework.id,
      requirementId: "qpost-req-pdp-5",
      requesterId: qpostReviewer.id,
      status: "Pending",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    },
  });

  await prisma.qPostException.upsert({
    where: { customerAccountId_exceptionCode: { customerAccountId, exceptionCode: "QP-EXC-003" } },
    update: {},
    create: {
      id: "qpost-exc-3",
      customerAccountId,
      exceptionCode: "QP-EXC-003",
      name: "Endpoint Protection Delay",
      description: "Delayed rollout of endpoint protection to field devices due to procurement cycle.",
      category: "Security",
      frameworkId: isoFramework.id,
      requirementId: "qpost-req-iso-5",
      requesterId: qpostUser.id,
      status: "Pending",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-08-31"),
    },
  });

  console.log("✅ QPost Exceptions created (3 total)");

  // ==================== QPOST KPIs ====================

  const kpi1 = await prisma.qPostKPI.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-KPI-001" } },
    update: {},
    create: {
      id: "qpost-kpi-1",
      customerAccountId,
      code: "QP-KPI-001",
      objective: "Policy Compliance Rate",
      description: "Percentage of employees who have acknowledged and signed the information security policy.",
      dataSource: "HR System + Policy Portal",
      calculationFormula: "(Employees who signed / Total employees) × 100",
      expectedScore: 95,
      actualScore: 87,
      status: "Measured",
      reviewDate: new Date("2026-03-31"),
      evidenceId: evidence1.id,
    },
  });

  const kpi2 = await prisma.qPostKPI.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-KPI-002" } },
    update: {},
    create: {
      id: "qpost-kpi-2",
      customerAccountId,
      code: "QP-KPI-002",
      objective: "Incident Response Time",
      description: "Average time to respond to security incidents from detection to containment.",
      dataSource: "SIEM / Incident Tracking System",
      calculationFormula: "Average(containment_time - detection_time) in hours",
      expectedScore: 4,
      actualScore: 6.5,
      status: "Measured",
      reviewDate: new Date("2026-03-31"),
    },
  });

  await prisma.qPostKPI.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-KPI-003" } },
    update: {},
    create: {
      id: "qpost-kpi-3",
      customerAccountId,
      code: "QP-KPI-003",
      objective: "Evidence Collection Timeliness",
      description: "Percentage of evidence items collected before their due date.",
      dataSource: "GRC Platform",
      calculationFormula: "(Evidence submitted on time / Total evidence due) × 100",
      expectedScore: 90,
      actualScore: 72,
      status: "Measured",
      reviewDate: new Date("2026-06-30"),
    },
  });

  await prisma.qPostKPI.upsert({
    where: { customerAccountId_code: { customerAccountId, code: "QP-KPI-004" } },
    update: {},
    create: {
      id: "qpost-kpi-4",
      customerAccountId,
      code: "QP-KPI-004",
      objective: "Data Subject Request Response Time",
      description: "Average days to fulfill data subject access requests under PDPL.",
      dataSource: "Privacy Management System",
      calculationFormula: "Average days from request to fulfillment",
      expectedScore: 30,
      actualScore: 0,
      status: "Scheduled",
      reviewDate: new Date("2026-06-30"),
    },
  });

  console.log("✅ QPost KPIs created (4 total)");

  // ==================== KPI REVIEWS ====================

  const kpi1Review = await prisma.qPostKPIReview.upsert({
    where: { id: "qpost-kpi-review-1" },
    update: {},
    create: {
      id: "qpost-kpi-review-1",
      kpiId: kpi1.id,
      reviewDate: new Date("2026-01-15"),
      actualScore: 82,
      status: "Completed",
    },
  });

  await prisma.qPostKPIReview.upsert({
    where: { id: "qpost-kpi-review-2" },
    update: {},
    create: {
      id: "qpost-kpi-review-2",
      kpiId: kpi1.id,
      reviewDate: new Date("2026-03-15"),
      actualScore: 87,
      status: "Completed",
    },
  });

  await prisma.qPostKPIReview.upsert({
    where: { id: "qpost-kpi-review-3" },
    update: {},
    create: {
      id: "qpost-kpi-review-3",
      kpiId: kpi2.id,
      reviewDate: new Date("2026-01-31"),
      actualScore: 8.2,
      status: "Completed",
    },
  });

  await prisma.qPostKPIReview.upsert({
    where: { id: "qpost-kpi-review-4" },
    update: {},
    create: {
      id: "qpost-kpi-review-4",
      kpiId: kpi2.id,
      reviewDate: new Date("2026-03-31"),
      actualScore: 6.5,
      status: "Completed",
    },
  });

  console.log("✅ QPost KPI Reviews created");

  // ==================== KPI ACTION PLANS ====================

  await prisma.qPostKPIActionPlan.upsert({
    where: { id: "qpost-kpi-ap-1" },
    update: {},
    create: {
      id: "qpost-kpi-ap-1",
      kpiReviewId: kpi1Review.id,
      plannedAction: "Launch mandatory policy acknowledgment campaign",
      description: "Send policy acknowledgment reminders to all employees who have not signed, with weekly follow-ups.",
      percentageCompleted: 60,
      startDate: new Date("2026-02-01"),
      status: "In-Progress",
    },
  });

  await prisma.qPostKPIActionPlan.upsert({
    where: { id: "qpost-kpi-ap-2" },
    update: {},
    create: {
      id: "qpost-kpi-ap-2",
      kpiReviewId: kpi1Review.id,
      plannedAction: "Integrate policy sign-off into onboarding",
      description: "Add mandatory policy acknowledgment step in new employee onboarding workflow.",
      percentageCompleted: 100,
      startDate: new Date("2026-01-20"),
      status: "Completed",
    },
  });

  console.log("✅ QPost KPI Action Plans created");

  // ==================== EXCEPTION COMMENTS ====================

  await prisma.qPostExceptionComment.upsert({
    where: { id: "qpost-exc-comment-1" },
    update: {},
    create: {
      id: "qpost-exc-comment-1",
      exceptionId: "qpost-exc-1",
      content: "Approved with condition that migration timeline is adhered to. Monthly status updates required.",
      userId: qpostAdmin.id,
      userName: "QPost Admin",
    },
  });

  await prisma.qPostExceptionComment.upsert({
    where: { id: "qpost-exc-comment-2" },
    update: {},
    create: {
      id: "qpost-exc-comment-2",
      exceptionId: "qpost-exc-2",
      content: "Need to verify if partner postal services provide adequate data protection guarantees per PDPL Article 12.",
      userId: qpostReviewer.id,
      userName: "Fatima Al-Mansouri",
    },
  });

  console.log("✅ QPost Exception Comments created");

  console.log("\n🎉 QPost Compliance seed completed successfully!");
  console.log("\n📋 Summary:");
  console.log("   - 1 Customer Account (QPOST_001 - Qatar Post)");
  console.log("   - 3 Users (qpostadmin, qpostuser, qpostreviewer)");
  console.log("   - 3 Frameworks (NIA, PDPL, ISO 27001)");
  console.log("   - 11 Requirement Categories");
  console.log("   - 20 Requirements (with hierarchy)");
  console.log("   - 6 Policies/Governance docs");
  console.log("   - 8 Evidence items");
  console.log("   - 3 Exceptions");
  console.log("   - 4 KPIs with reviews and action plans");
  console.log("   - Requirement-Policy and Requirement-Evidence links");
  console.log("\n🔑 Login: qpostadmin / Baarez@2025");
}

main()
  .catch((e) => {
    console.error("❌ QPost seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
