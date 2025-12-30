import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ==================== ORGANIZATION MODULE ====================

  // Create Organization
  await prisma.organization.upsert({
    where: { id: "org-1" },
    update: {},
    create: {
      id: "org-1",
      name: "Baarez Technology Solutions",
      establishedDate: "09/08/2017",
      employeeCount: 80,
      branchCount: 2,
      headOfficeLocation: "Doha, Qatar-1",
      headOfficeAddress: "Office No.15, 2nd Floor, Building no. 226, Street No 230, C-Ring Road",
      website: "www.baarez.com",
      description: "Founded in 2017, Baarez Technology Solutions is a leading technology company specializing in GRC solutions and digital transformation services.",
      vision: "To become the preferred Technology partner for organizations seeking innovative GRC solutions.",
      mission: "At Baarez Technology Solutions, we are committed to delivering cutting-edge technology solutions that help organizations manage their governance, risk, and compliance needs effectively.",
    },
  });

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
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdDepts[name] = dept.id;
  }
  console.log("✅ Departments created");

  // Create Users
  const users = [
    { userName: "bts.admin", email: "admin@baarez.com", firstName: "BTS", lastName: "Admin", department: "IT Operations", designation: "System Administrator", role: "Administrator" },
    { userName: "john.doe", email: "john.doe@baarez.com", firstName: "John", lastName: "Doe", department: "Compliance", designation: "Compliance Manager", role: "GRC Admin" },
    { userName: "sarah.smith", email: "sarah.smith@baarez.com", firstName: "Sarah", lastName: "Smith", department: "Internal Audit", designation: "Lead Auditor", role: "Auditor" },
    { userName: "mike.wilson", email: "mike.wilson@baarez.com", firstName: "Mike", lastName: "Wilson", department: "Risk Management", designation: "Risk Analyst", role: "Risk Manager" },
    { userName: "emily.brown", email: "emily.brown@baarez.com", firstName: "Emily", lastName: "Brown", department: "Human Resources", designation: "HR Manager", role: "User" },
    { userName: "david.jones", email: "david.jones@baarez.com", firstName: "David", lastName: "Jones", department: "IT Support", designation: "Support Specialist", role: "User" },
    { userName: "lisa.taylor", email: "lisa.taylor@baarez.com", firstName: "Lisa", lastName: "Taylor", department: "Product Development", designation: "Product Manager", role: "User" },
    { userName: "james.anderson", email: "james.anderson@baarez.com", firstName: "James", lastName: "Anderson", department: "Revenue", designation: "Sales Director", role: "User" },
  ];

  const createdUsers: { [key: string]: string } = {};
  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { userName: user.userName },
      update: {},
      create: {
        userName: user.userName,
        email: user.email,
        password: "password123",
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        designation: user.designation,
        role: user.role,
        departmentId: createdDepts[user.department],
      },
    });
    createdUsers[user.userName] = created.id;
  }
  console.log("✅ Users created");

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
    await prisma.stakeholder.create({ data: stakeholder });
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
    await prisma.service.create({ data: service });
  }
  console.log("✅ Services created");

  // ==================== COMPLIANCE MODULE ====================

  // Create Frameworks
  const frameworks = [
    { name: "ISO 27001-2022", description: "Information Security Management System", version: "2022", status: "Subscribed" },
    { name: "GDPR", description: "General Data Protection Regulation", version: "2018", status: "Subscribed" },
    { name: "PCI DSS", description: "Payment Card Industry Data Security Standard", version: "4.0", status: "Subscribed" },
    { name: "NIS Directive", description: "Network and Information Security Directive", version: "2.0", status: "Subscribed" },
    { name: "EBA Outsourcing Guidelines", description: "European Banking Authority Outsourcing Guidelines", version: "2019", status: "Subscribed" },
    { name: "ISO 27002:2022 (Annexure A)", description: "Code of practice for information security controls", version: "2022", status: "Subscribed" },
    { name: "EU Directive", description: "European Union Regulatory Directive", version: "2023", status: "Subscribed" },
    { name: "Labour Law (Darba likums)", description: "Latvian Labour Law", version: "2024", status: "Subscribed" },
    { name: "Latvia AML Law", description: "Anti-Money Laundering Law", version: "2023", status: "Not Subscribed" },
    { name: "Latvia construction law", description: "Construction Regulations", version: "2023", status: "Not Subscribed" },
    { name: "Latvia cyber security law", description: "Cybersecurity Requirements", version: "2024", status: "Not Subscribed" },
    { name: "Latvian Commercial & governance Law", description: "Commercial Law Compliance", version: "2023", status: "Not Subscribed" },
  ];

  const createdFrameworks: { [key: string]: string } = {};
  for (const framework of frameworks) {
    const created = await prisma.framework.upsert({
      where: { name: framework.name },
      update: {},
      create: framework,
    });
    createdFrameworks[framework.name] = created.id;
  }
  console.log("✅ Frameworks created");

  // Keep Regulations for backwards compatibility
  for (const framework of frameworks.slice(0, 5)) {
    await prisma.regulation.upsert({
      where: { name: framework.name },
      update: {},
      create: { name: framework.name, status: framework.status },
    });
  }
  console.log("✅ Regulations created");

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
    const domain = await prisma.controlDomain.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdDomains[name] = domain.id;
  }
  console.log("✅ Control Domains created");

  // Create Controls (sample set - in real app would have 891)
  const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
  const controlStatuses = ["Non Compliant", "Compliant", "Not Applicable"];

  const sampleControls = [];
  let controlIndex = 1;

  for (const domain of Object.keys(createdDomains).slice(0, 10)) {
    for (let i = 0; i < 5; i++) {
      sampleControls.push({
        controlCode: `CTRL-${String(controlIndex).padStart(4, "0")}`,
        name: `${domain} Control ${i + 1}`,
        description: `Control for ensuring ${domain.toLowerCase()} compliance`,
        controlQuestion: `Is ${domain.toLowerCase()} properly implemented?`,
        functionalGrouping: functionalGroupings[controlIndex % 6],
        status: controlStatuses[controlIndex % 3],
        domainId: createdDomains[domain],
        frameworkId: createdFrameworks["ISO 27001-2022"],
        departmentId: createdDepts[departments[controlIndex % departments.length]],
        ownerId: createdUsers["john.doe"],
      });
      controlIndex++;
    }
  }

  for (const control of sampleControls) {
    await prisma.control.upsert({
      where: { controlCode: control.controlCode },
      update: {},
      create: control,
    });
  }
  console.log("✅ Controls created (50 sample controls)");

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
    await prisma.process.upsert({
      where: { processCode: process.processCode },
      update: {},
      create: {
        processCode: process.processCode,
        name: process.name,
        processType: process.processType,
        departmentId: createdDepts[process.department],
        ownerId: createdUsers["bts.admin"],
      },
    });
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

  for (const policy of policies) {
    await prisma.policy.create({
      data: {
        name: policy.name,
        documentType: policy.documentType,
        departmentId: createdDepts[policy.department],
        status: policy.status,
        version: "1.0",
      },
    });
  }
  console.log("✅ Policies created");

  // Create Evidence Requests
  const evidences = [
    { name: "Access Control Logs", framework: "ISO 27001-2022", department: "IT Operations", status: "Pending", dueDate: "2025-01-15" },
    { name: "Security Training Records", framework: "ISO 27001-2022", department: "Human Resources", status: "Submitted", dueDate: "2025-01-10" },
    { name: "Firewall Configuration", framework: "PCI DSS", department: "IT Operations", status: "Approved", dueDate: "2025-01-05" },
    { name: "Data Processing Agreement", framework: "GDPR", department: "Compliance", status: "Pending", dueDate: "2025-01-20" },
    { name: "Vulnerability Scan Report", framework: "ISO 27001-2022", department: "IT Operations", status: "Overdue", dueDate: "2024-12-15" },
    { name: "Backup Verification", framework: "ISO 27001-2022", department: "IT Operations", status: "Pending", dueDate: "2025-02-01" },
    { name: "Risk Assessment Report", framework: "ISO 27001-2022", department: "Risk Management", status: "Submitted", dueDate: "2025-01-25" },
    { name: "Incident Response Test", framework: "NIS Directive", department: "IT Operations", status: "Pending", dueDate: "2025-02-15" },
  ];

  for (const evidence of evidences) {
    await prisma.evidence.create({
      data: {
        name: evidence.name,
        frameworkId: createdFrameworks[evidence.framework],
        departmentId: createdDepts[evidence.department],
        assigneeId: createdUsers["john.doe"],
        status: evidence.status,
        dueDate: new Date(evidence.dueDate),
      },
    });
  }
  console.log("✅ Evidence requests created");

  // Create Exceptions
  const exceptions = [
    { title: "Legacy System Exception", exceptionType: "Control", department: "IT Operations", status: "Approved", startDate: "2025-01-01", endDate: "2025-06-30" },
    { title: "Vendor Compliance Gap", exceptionType: "Compliance", department: "Procurement", status: "Pending", startDate: "2025-01-15", endDate: "2025-03-15" },
    { title: "Password Policy Exception", exceptionType: "Policy", department: "IT Operations", status: "Authorized", startDate: "2025-02-01", endDate: "2025-04-01" },
    { title: "Data Retention Exception", exceptionType: "Policy", department: "Compliance", status: "Pending", startDate: "2025-01-10", endDate: "2025-07-10" },
    { title: "Access Control Override", exceptionType: "Control", department: "IT Operations", status: "Closed", startDate: "2024-10-01", endDate: "2024-12-31" },
  ];

  for (const exception of exceptions) {
    await prisma.exception.create({
      data: {
        title: exception.title,
        exceptionType: exception.exceptionType,
        departmentId: createdDepts[exception.department],
        status: exception.status,
        startDate: new Date(exception.startDate),
        endDate: new Date(exception.endDate),
      },
    });
  }
  console.log("✅ Exceptions created");

  // ==================== ASSET MANAGEMENT MODULE ====================

  // Create Asset Classifications
  const classifications = ["Critical", "High", "Medium", "Low"];
  const createdClassifications: { [key: string]: string } = {};

  for (const name of classifications) {
    const classification = await prisma.assetClassification.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} priority asset` },
    });
    createdClassifications[name] = classification.id;
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
    const category = await prisma.assetCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdAssetCategories[cat.name] = category.id;
  }
  console.log("✅ Asset Categories created");

  // Create Asset Sub Categories
  const assetSubCategories = [
    { name: "Server", description: "Physical and virtual servers", category: "Hardware" },
    { name: "Workstation", description: "Desktop computers and laptops", category: "Hardware" },
    { name: "Firewall", description: "Network security devices", category: "Hardware" },
    { name: "Router/Switch", description: "Network routing equipment", category: "Hardware" },
    { name: "Storage Device", description: "Data storage hardware", category: "Hardware" },
    { name: "Mobile Device", description: "Smartphones and tablets", category: "Hardware" },
    { name: "Enterprise Application", description: "Business applications", category: "Software" },
    { name: "Operating System", description: "System software", category: "Software" },
    { name: "Database", description: "Database management systems", category: "Software" },
    { name: "Security Software", description: "Security tools and applications", category: "Software" },
    { name: "Customer Data", description: "Customer information", category: "Data" },
    { name: "Financial Data", description: "Financial records and transactions", category: "Data" },
    { name: "Employee Data", description: "HR and employee information", category: "Data" },
    { name: "Intellectual Property", description: "Patents, trade secrets, source code", category: "Data" },
    { name: "LAN/WAN", description: "Local and wide area networks", category: "Network" },
    { name: "Cloud Infrastructure", description: "Cloud-based resources", category: "Network" },
    { name: "Data Center", description: "Primary data center facilities", category: "Facilities" },
    { name: "Office Building", description: "Office locations", category: "Facilities" },
  ];

  const createdAssetSubCategories: { [key: string]: string } = {};
  for (const subCat of assetSubCategories) {
    const subCategory = await prisma.assetSubCategory.upsert({
      where: {
        name_categoryId: {
          name: subCat.name,
          categoryId: createdAssetCategories[subCat.category],
        },
      },
      update: {},
      create: {
        name: subCat.name,
        description: subCat.description,
        categoryId: createdAssetCategories[subCat.category],
      },
    });
    createdAssetSubCategories[subCat.name] = subCategory.id;
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
    { name: "Infrastructure", description: "Core infrastructure assets" },
    { name: "Communication", description: "Communication systems" },
  ];

  const createdAssetGroups: { [key: string]: string } = {};
  for (const group of assetGroups) {
    const created = await prisma.assetGroup.upsert({
      where: { name: group.name },
      update: {},
      create: group,
    });
    createdAssetGroups[group.name] = created.id;
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
    const created = await prisma.assetSensitivity.upsert({
      where: { name: sens.name },
      update: {},
      create: sens,
    });
    createdSensitivities[sens.name] = created.id;
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
    const created = await prisma.assetLifecycleStatus.upsert({
      where: { name: status.name },
      update: {},
      create: status,
    });
    createdLifecycleStatuses[status.name] = created.id;
  }
  console.log("✅ Asset Lifecycle Statuses created");

  // Create CIA Classifications
  const ciaClassifications = [
    { subCategory: "Server", group: "Infrastructure", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Server", group: "Core Banking", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Firewall", group: "Security Tools", c: "high", cScore: 10, i: "high", iScore: 10, a: "high", aScore: 10 },
    { subCategory: "Database", group: "Core Banking", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Customer Data", group: "Customer Facing", c: "high", cScore: 10, i: "high", iScore: 10, a: "medium", aScore: 5 },
    { subCategory: "Workstation", group: "Internal Operations", c: "medium", cScore: 5, i: "medium", iScore: 5, a: "low", aScore: 0 },
    { subCategory: "Enterprise Application", group: "Internal Operations", c: "medium", cScore: 5, i: "high", iScore: 10, a: "medium", aScore: 5 },
  ];

  for (const cia of ciaClassifications) {
    const maxScore = Math.max(cia.cScore, cia.iScore, cia.aScore);
    const criticality = maxScore >= 10 ? "high" : maxScore >= 5 ? "medium" : "low";

    await prisma.assetCIAClassification.upsert({
      where: {
        subCategoryId_groupId: {
          subCategoryId: createdAssetSubCategories[cia.subCategory],
          groupId: createdAssetGroups[cia.group],
        },
      },
      update: {},
      create: {
        subCategoryId: createdAssetSubCategories[cia.subCategory],
        groupId: createdAssetGroups[cia.group],
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
  console.log("✅ CIA Classifications created");

  // Create Assets with enhanced fields
  const assets = [
    { assetId: "AST-001", name: "Production Database Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Infrastructure", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 50000, acquisitionDate: "2023-01-15", nextReviewDate: "2025-06-15" },
    { assetId: "AST-002", name: "Core Banking Application Server", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Server", group: "Core Banking", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 75000, acquisitionDate: "2023-03-01", nextReviewDate: "2025-06-01" },
    { assetId: "AST-003", name: "Perimeter Firewall", assetType: "Hardware", department: "IT Operations", classification: "Critical", category: "Hardware", subCategory: "Firewall", group: "Security Tools", sensitivity: "Restricted", lifecycle: "Active", owner: "john.doe", custodian: "david.jones", location: "Data Center A", value: 25000, acquisitionDate: "2023-06-15", nextReviewDate: "2025-03-15" },
    { assetId: "AST-004", name: "Customer Database", assetType: "Information", department: "IT Operations", classification: "Critical", category: "Data", subCategory: "Customer Data", group: "Customer Facing", sensitivity: "Restricted", lifecycle: "Active", owner: "john.doe", custodian: "lisa.taylor", location: "Cloud AWS", value: 100000, acquisitionDate: "2022-01-01", nextReviewDate: "2025-01-01" },
    { assetId: "AST-005", name: "ERP System", assetType: "Software", department: "IT Operations", classification: "High", category: "Software", subCategory: "Enterprise Application", group: "Internal Operations", sensitivity: "Confidential", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "On-Premise", value: 200000, acquisitionDate: "2021-06-01", nextReviewDate: "2025-06-01" },
    { assetId: "AST-006", name: "HR Management System", assetType: "Software", department: "Human Resources", classification: "High", category: "Software", subCategory: "Enterprise Application", group: "Internal Operations", sensitivity: "Confidential", lifecycle: "Active", owner: "emily.brown", custodian: "david.jones", location: "Cloud Azure", value: 50000, acquisitionDate: "2022-03-15", nextReviewDate: "2025-03-15" },
    { assetId: "AST-007", name: "Employee Workstations", assetType: "Hardware", department: "IT Support", classification: "Medium", category: "Hardware", subCategory: "Workstation", group: "Internal Operations", sensitivity: "Internal", lifecycle: "Active", owner: "david.jones", custodian: "david.jones", location: "All Offices", value: 150000, acquisitionDate: "2023-01-01", nextReviewDate: "2025-12-01" },
    { assetId: "AST-008", name: "Development Server", assetType: "Hardware", department: "Product Development", classification: "Medium", category: "Hardware", subCategory: "Server", group: "Development", sensitivity: "Internal", lifecycle: "Active", owner: "lisa.taylor", custodian: "david.jones", location: "Data Center B", value: 30000, acquisitionDate: "2023-09-01", nextReviewDate: "2025-09-01" },
    { assetId: "AST-009", name: "Backup Storage System", assetType: "Hardware", department: "IT Operations", classification: "High", category: "Hardware", subCategory: "Storage Device", group: "Infrastructure", sensitivity: "Restricted", lifecycle: "Active", owner: "bts.admin", custodian: "david.jones", location: "Data Center A", value: 80000, acquisitionDate: "2023-04-01", nextReviewDate: "2025-04-01" },
    { assetId: "AST-010", name: "CRM Database", assetType: "Information", department: "Revenue", classification: "High", category: "Data", subCategory: "Customer Data", group: "Customer Facing", sensitivity: "Confidential", lifecycle: "Active", owner: "james.anderson", custodian: "lisa.taylor", location: "Cloud AWS", value: 75000, acquisitionDate: "2022-06-01", nextReviewDate: "2025-06-01" },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { assetId: asset.assetId },
      update: {},
      create: {
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
  console.log("✅ Assets created");

  // ==================== RISK MANAGEMENT MODULE ====================

  // Create Risk Categories
  const riskCategories = ["Strategic", "Operational", "Financial", "Compliance", "IT/Cyber", "Reputational"];
  const createdRiskCategories: { [key: string]: string } = {};

  for (const name of riskCategories) {
    const category = await prisma.riskCategory.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} risk category` },
    });
    createdRiskCategories[name] = category.id;
  }
  console.log("✅ Risk Categories created");

  // Create Risks
  const risks = [
    { riskId: "RSK-001", name: "Data Breach Risk", category: "IT/Cyber", department: "IT Operations", riskRating: "High", status: "Open" },
    { riskId: "RSK-002", name: "Regulatory Non-Compliance", category: "Compliance", department: "Compliance", riskRating: "High", status: "Mitigate" },
    { riskId: "RSK-003", name: "Vendor Dependency", category: "Operational", department: "Procurement", riskRating: "Medium", status: "Open" },
    { riskId: "RSK-004", name: "Market Competition", category: "Strategic", department: "Revenue", riskRating: "Medium", status: "Accept" },
    { riskId: "RSK-005", name: "Talent Retention", category: "Operational", department: "Human Resources", riskRating: "Medium", status: "Mitigate" },
    { riskId: "RSK-006", name: "System Failure", category: "IT/Cyber", department: "IT Operations", riskRating: "Very High", status: "Mitigate" },
    { riskId: "RSK-007", name: "Financial Loss", category: "Financial", department: "Revenue", riskRating: "High", status: "Open" },
    { riskId: "RSK-008", name: "Reputation Damage", category: "Reputational", department: "Operations", riskRating: "High", status: "Open" },
    { riskId: "RSK-009", name: "Supply Chain Disruption", category: "Operational", department: "Procurement", riskRating: "Medium", status: "Open" },
    { riskId: "RSK-010", name: "Insider Threat", category: "IT/Cyber", department: "IT Operations", riskRating: "High", status: "Mitigate" },
  ];

  for (const risk of risks) {
    await prisma.risk.upsert({
      where: { riskId: risk.riskId },
      update: {},
      create: {
        riskId: risk.riskId,
        name: risk.name,
        categoryId: createdRiskCategories[risk.category],
        departmentId: createdDepts[risk.department],
        ownerId: createdUsers["mike.wilson"],
        riskRating: risk.riskRating,
        status: risk.status,
        likelihood: Math.floor(Math.random() * 5) + 1,
        impact: Math.floor(Math.random() * 5) + 1,
      },
    });
  }
  console.log("✅ Risks created");

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
    const created = await prisma.audit.upsert({
      where: { auditId: audit.auditId },
      update: {},
      create: {
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
    const created = await prisma.auditFinding.upsert({
      where: { findingId: finding.findingId },
      update: {},
      create: {
        findingId: finding.findingId,
        title: finding.title,
        auditId: createdAudits[finding.auditId],
        severity: finding.severity,
        status: finding.status,
      },
    });
    createdFindings[finding.findingId] = created.id;
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
    await prisma.cAPA.upsert({
      where: { capaId: capa.capaId },
      update: {},
      create: {
        capaId: capa.capaId,
        title: capa.title,
        findingId: createdFindings[capa.findingId],
        actionType: capa.actionType,
        status: capa.status,
        dueDate: new Date(capa.dueDate),
      },
    });
  }
  console.log("✅ CAPAs created");

  // Create sample Audit Logs
  const auditLogs = [
    { changeType: "CREATE", entityType: "Control", entityId: "ctrl-1", userName: "admin", changes: '{"name": "New Control"}' },
    { changeType: "UPDATE", entityType: "Risk", entityId: "risk-1", userName: "mike.wilson", changes: '{"status": {"old": "Open", "new": "Mitigate"}}' },
    { changeType: "UPDATE", entityType: "User", entityId: "user-1", userName: "admin", changes: '{"isActive": {"old": true, "new": false}}' },
    { changeType: "CREATE", entityType: "Asset", entityId: "asset-1", userName: "bts.admin", changes: '{"name": "New Server"}' },
    { changeType: "DELETE", entityType: "Stakeholder", entityId: "stake-1", userName: "john.doe", changes: '{"name": "Removed Stakeholder"}' },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log("✅ Audit Logs created");

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
