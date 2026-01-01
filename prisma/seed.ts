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
    const category = await prisma.riskCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdRiskCategories[cat.name] = category.id;
  }
  console.log("✅ Risk Categories created");

  // Create Risk Types
  const riskTypes = ["Inherent", "Residual", "Target"];
  const createdRiskTypes: { [key: string]: string } = {};

  for (const name of riskTypes) {
    const type = await prisma.riskType.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} risk assessment type` },
    });
    createdRiskTypes[name] = type.id;
  }
  console.log("✅ Risk Types created");

  // Create Risk Threats
  const threats = [
    { name: "Cyber Attack", description: "Malicious cyber intrusion or attack" },
    { name: "Natural Disaster", description: "Earthquakes, floods, hurricanes, etc." },
    { name: "Human Error", description: "Mistakes or negligence by employees" },
    { name: "System Failure", description: "Hardware or software malfunction" },
    { name: "Third-Party Failure", description: "Vendor or partner service disruption" },
    { name: "Data Theft", description: "Unauthorized access to sensitive data" },
    { name: "Malware", description: "Viruses, ransomware, and other malicious software" },
    { name: "Phishing", description: "Social engineering attacks via email" },
    { name: "Insider Threat", description: "Malicious actions by internal actors" },
    { name: "Supply Chain Attack", description: "Compromise through supply chain" },
  ];
  const createdThreats: { [key: string]: string } = {};

  for (const threat of threats) {
    const created = await prisma.riskThreat.upsert({
      where: { name: threat.name },
      update: {},
      create: threat,
    });
    createdThreats[threat.name] = created.id;
  }
  console.log("✅ Risk Threats created");

  // Create Risk Vulnerabilities
  const vulnerabilities = [
    { name: "Weak Authentication", description: "Insufficient password policies or MFA" },
    { name: "Unpatched Systems", description: "Systems without latest security patches" },
    { name: "Misconfiguration", description: "Incorrectly configured systems or services" },
    { name: "Lack of Encryption", description: "Data not encrypted at rest or in transit" },
    { name: "Poor Access Controls", description: "Excessive or improper access rights" },
    { name: "Inadequate Logging", description: "Insufficient audit trails and monitoring" },
    { name: "Legacy Systems", description: "Outdated systems lacking security updates" },
    { name: "Missing Backups", description: "Insufficient or untested backup procedures" },
    { name: "Untrained Staff", description: "Employees lacking security awareness" },
    { name: "Shadow IT", description: "Unauthorized technology usage" },
  ];
  const createdVulnerabilities: { [key: string]: string } = {};

  for (const vuln of vulnerabilities) {
    const created = await prisma.riskVulnerability.upsert({
      where: { name: vuln.name },
      update: {},
      create: vuln,
    });
    createdVulnerabilities[vuln.name] = created.id;
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
    await prisma.riskCause.upsert({
      where: { name: cause.name },
      update: {},
      create: cause,
    });
  }
  console.log("✅ Risk Causes created");

  // Create Risks with enhanced data
  // Status: Awaiting Approval, Pending Assessment, Open, In Progress, Closed
  // Strategy: Treat, Transfer, Avoid, Accept
  const risks = [
    { riskId: "RISK-0001", name: "Data Breach Risk", description: "Risk of unauthorized access to sensitive customer and business data", category: "IT/Cyber", department: "IT Operations", likelihood: 4, impact: 5, status: "Open", responseStrategy: "Treat" },
    { riskId: "RISK-0002", name: "Regulatory Non-Compliance", description: "Failure to comply with GDPR, PCI-DSS, and other regulations", category: "Compliance", department: "Compliance", likelihood: 3, impact: 4, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RISK-0003", name: "Vendor Dependency", description: "Over-reliance on critical third-party vendors", category: "Operational", department: "Procurement", likelihood: 3, impact: 3, status: "Pending Assessment", responseStrategy: "Transfer" },
    { riskId: "RISK-0004", name: "Market Competition", description: "Increased competition affecting market share", category: "Strategic", department: "Revenue", likelihood: 4, impact: 3, status: "Open", responseStrategy: "Accept" },
    { riskId: "RISK-0005", name: "Talent Retention", description: "Difficulty retaining key technical talent", category: "Operational", department: "Human Resources", likelihood: 3, impact: 3, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RISK-0006", name: "System Failure", description: "Critical system downtime affecting operations", category: "IT/Cyber", department: "IT Operations", likelihood: 3, impact: 5, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RISK-0007", name: "Financial Loss", description: "Unexpected financial losses from operations", category: "Financial", department: "Revenue", likelihood: 2, impact: 4, status: "Awaiting Approval", responseStrategy: null },
    { riskId: "RISK-0008", name: "Reputation Damage", description: "Negative publicity affecting brand value", category: "Reputational", department: "Operations", likelihood: 2, impact: 5, status: "Pending Assessment", responseStrategy: null },
    { riskId: "RISK-0009", name: "Supply Chain Disruption", description: "Interruption in supply chain operations", category: "Operational", department: "Procurement", likelihood: 3, impact: 3, status: "Open", responseStrategy: "Avoid" },
    { riskId: "RISK-0010", name: "Insider Threat", description: "Malicious or negligent actions by employees", category: "IT/Cyber", department: "IT Operations", likelihood: 2, impact: 4, status: "Closed", responseStrategy: "Treat" },
    { riskId: "RISK-0011", name: "Cloud Security", description: "Security vulnerabilities in cloud infrastructure", category: "IT/Cyber", department: "IT Operations", likelihood: 3, impact: 4, status: "In Progress", responseStrategy: "Treat" },
    { riskId: "RISK-0012", name: "Business Continuity", description: "Inability to recover from major disruptions", category: "Operational", department: "Operations", likelihood: 2, impact: 5, status: "Awaiting Approval", responseStrategy: null },
  ];

  const createdRisks: { [key: string]: string } = {};
  for (const risk of risks) {
    const riskScore = risk.likelihood * risk.impact;
    // Rating: Catastrophic, Very high, High, Low Risk (matching website)
    let riskRating = "Low Risk";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very high";
    else if (riskScore >= 10) riskRating = "High";

    const created = await prisma.risk.upsert({
      where: { riskId: risk.riskId },
      update: {},
      create: {
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
  console.log("✅ Risks created");

  // Create Risk-Threat mappings
  const riskThreatMappings = [
    { riskId: "RISK-0001", threats: ["Cyber Attack", "Data Theft", "Malware", "Phishing"] },
    { riskId: "RISK-0006", threats: ["System Failure", "Natural Disaster"] },
    { riskId: "RISK-0010", threats: ["Insider Threat", "Data Theft"] },
    { riskId: "RISK-0011", threats: ["Cyber Attack", "Malware", "Misconfiguration"] },
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
    { riskId: "RISK-0001", vulns: ["Weak Authentication", "Poor Access Controls", "Lack of Encryption"] },
    { riskId: "RISK-0006", vulns: ["Unpatched Systems", "Legacy Systems", "Missing Backups"] },
    { riskId: "RISK-0010", vulns: ["Poor Access Controls", "Inadequate Logging", "Untrained Staff"] },
    { riskId: "RISK-0011", vulns: ["Misconfiguration", "Unpatched Systems", "Shadow IT"] },
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
    { assessmentId: "RA-0001", riskId: "RISK-0001", likelihood: 4, impact: 5, status: "Approved", date: "2025-01-15" },
    { assessmentId: "RA-0002", riskId: "RISK-0006", likelihood: 3, impact: 5, status: "Approved", date: "2025-01-10" },
    { assessmentId: "RA-0003", riskId: "RISK-0002", likelihood: 3, impact: 4, status: "Submitted", date: "2025-01-20" },
  ];

  for (const assessment of assessments) {
    const riskScore = assessment.likelihood * assessment.impact;
    let riskRating = "Low";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very High";
    else if (riskScore >= 10) riskRating = "High";
    else if (riskScore >= 5) riskRating = "Medium";

    await prisma.riskAssessment.upsert({
      where: { assessmentId: assessment.assessmentId },
      update: {},
      create: {
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
  console.log("✅ Risk Assessments created");

  // Create Risk Responses
  // Response Type: Treat, Transfer, Avoid, Accept (matching website)
  const responses = [
    { responseId: "RR-0001", riskId: "RISK-0001", responseType: "Treat", actionTitle: "Implement Multi-Factor Authentication", status: "In Progress", dueDate: "2025-03-01" },
    { responseId: "RR-0002", riskId: "RISK-0001", responseType: "Treat", actionTitle: "Deploy Data Loss Prevention", status: "Open", dueDate: "2025-04-01" },
    { responseId: "RR-0003", riskId: "RISK-0006", responseType: "Treat", actionTitle: "Implement High Availability", status: "In Progress", dueDate: "2025-02-15" },
    { responseId: "RR-0004", riskId: "RISK-0010", responseType: "Treat", actionTitle: "Enhanced Access Monitoring", status: "Completed", dueDate: "2025-01-15" },
  ];

  for (const response of responses) {
    await prisma.riskResponse.upsert({
      where: { responseId: response.responseId },
      update: {},
      create: {
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

  // Create comprehensive Audit Logs matching the website
  console.log("Creating Audit Logs...");

  // Helper function to generate reference numbers
  const generateRefNumber = () => Math.floor(Math.random() * 90000000000000000 + 10000000000000000).toString();

  // AuditManagement.EvidenceRequest - 19 attributes (most recent)
  const evidenceRequestLog = await prisma.auditLog.create({
    data: {
      entityType: "AuditManagement.EvidenceRequest",
      referenceNumber: "12103423998878574",
      entityId: "er-001",
      userName: "Deepika",
      type: "Create",
      attributeCount: 19,
      createdAt: new Date("2025-12-30T05:17:00Z"),
    },
  });

  const evidenceRequestChanges = [
    { attributeName: "AIAnswer", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AIResponse", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "Art_ID", moduleName: "Attribute", oldValue: null, newValue: "33" },
    { attributeName: "ArtifactID", moduleName: "Attribute", oldValue: null, newValue: "ER33" },
    { attributeName: "AuditManagement.EvidenceRequest_AuditPlan", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
    { attributeName: "AuditManagement.EvidenceRequest_GRCAccount", moduleName: "Reference", oldValue: "no reference", newValue: "reference unchanged" },
    { attributeName: "AuditManagement.EvidenceRequest_Procedure", moduleName: "Reference set", oldValue: "0 element(s) in set", newValue: "0 new, 0 removed element(s) (total 0)" },
    { attributeName: "AuditManagement.EvidenceRequest_UserAccount", moduleName: "Reference set", oldValue: "0 element(s) in set", newValue: "1 new, 0 removed element(s) (total 1)" },
    { attributeName: "Comment", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "Description", moduleName: "Attribute", oldValue: null, newValue: "Tewst" },
    { attributeName: "HasRequests", moduleName: "Attribute", oldValue: null, newValue: "false" },
    { attributeName: "_ID", moduleName: "Attribute", oldValue: null, newValue: "0" },
    { attributeName: "IsResponded", moduleName: "Attribute", oldValue: null, newValue: "false" },
    { attributeName: "Justification", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "NoOfAttachments", moduleName: "Attribute", oldValue: null, newValue: "0" },
    { attributeName: "NoOfSamples", moduleName: "Attribute", oldValue: null, newValue: "2" },
    { attributeName: "RequestName", moduleName: "Attribute", oldValue: null, newValue: "ISSue" },
    { attributeName: "RequestStatus", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "Title", moduleName: "Attribute", oldValue: null, newValue: null },
  ];

  for (const change of evidenceRequestChanges) {
    await prisma.auditLogChange.create({
      data: { auditLogId: evidenceRequestLog.id, ...change },
    });
  }

  // AuditManagement.AuditPlan - 1 attribute (same time)
  const auditPlanLog1 = await prisma.auditLog.create({
    data: {
      entityType: "AuditManagement.AuditPlan",
      referenceNumber: "76279718688780027",
      entityId: "ap-001",
      userName: "Deepika",
      type: "Change",
      attributeCount: 1,
      createdAt: new Date("2025-12-30T05:17:00Z"),
    },
  });

  await prisma.auditLogChange.create({
    data: {
      auditLogId: auditPlanLog1.id,
      attributeName: "Status",
      moduleName: "Attribute",
      oldValue: "Draft",
      newValue: "In Progress",
    },
  });

  // MOF_Audit.AuditTasksAI - 6 attributes (4 entries)
  const auditTasksRefNumbers = ["139330113471928924", "139330113471928714", "139330113471928654", "139330113471928465"];
  for (let i = 0; i < 4; i++) {
    const auditTasksLog = await prisma.auditLog.create({
      data: {
        entityType: "MOF_Audit.AuditTasksAI",
        referenceNumber: auditTasksRefNumbers[i],
        entityId: `at-00${i + 1}`,
        userName: "anamika",
        type: "Create",
        attributeCount: 6,
        createdAt: new Date("2025-12-29T13:41:00Z"),
      },
    });

    const auditTasksChanges = [
      { attributeName: "TaskName", moduleName: "Attribute", oldValue: null, newValue: `AI Task ${i + 1}` },
      { attributeName: "TaskStatus", moduleName: "Attribute", oldValue: null, newValue: "Pending" },
      { attributeName: "AIProcessed", moduleName: "Attribute", oldValue: null, newValue: "true" },
      { attributeName: "ProcessingDate", moduleName: "Attribute", oldValue: null, newValue: "12/29/2025" },
      { attributeName: "ResultScore", moduleName: "Attribute", oldValue: null, newValue: "85" },
      { attributeName: "IsVerified", moduleName: "Attribute", oldValue: null, newValue: "false" },
    ];

    for (const change of auditTasksChanges) {
      await prisma.auditLogChange.create({
        data: { auditLogId: auditTasksLog.id, ...change },
      });
    }
  }

  // AuditManagement.AuditPlan - 95 attributes
  const auditPlanLog2 = await prisma.auditLog.create({
    data: {
      entityType: "AuditManagement.AuditPlan",
      referenceNumber: "76279718688946370",
      entityId: "ap-002",
      userName: "anamika",
      type: "Create",
      attributeCount: 95,
      createdAt: new Date("2025-12-29T13:41:00Z"),
    },
  });

  const auditPlanChanges = [
    { attributeName: "AcknowledgementDueDate", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AssetCIA", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AssetName", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AuditeeDelayedResponseEscalate", moduleName: "Attribute", oldValue: null, newValue: "false" },
    { attributeName: "AuditeeResponseDate", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AuditeeTeam", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AuditID", moduleName: "Attribute", oldValue: null, newValue: "0029" },
    { attributeName: "AuditItem", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "AuditManagement.Attachments_AuditPlan", moduleName: "Reference", oldValue: "no reference", newValue: "reference unchanged" },
    { attributeName: "AuditManagement.AuditPlan_Approver", moduleName: "Reference", oldValue: "no reference", newValue: "reference unchanged" },
    { attributeName: "AuditManagement.AuditPlan_Assignee", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
    { attributeName: "AuditManagement.AuditPlan_Department", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
    { attributeName: "AuditManagement.AuditPlan_Framework", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
    { attributeName: "AuditPlanStatus", moduleName: "Attribute", oldValue: null, newValue: "Draft" },
    { attributeName: "AuditScope", moduleName: "Attribute", oldValue: null, newValue: "Full Audit" },
    { attributeName: "AuditType", moduleName: "Attribute", oldValue: null, newValue: "Internal" },
    { attributeName: "ComplianceScore", moduleName: "Attribute", oldValue: null, newValue: "0" },
    { attributeName: "ControlCategory", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "ControlDomain", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "ControlOwner", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "CreatedBy", moduleName: "Attribute", oldValue: null, newValue: "anamika" },
    { attributeName: "CreatedDate", moduleName: "Attribute", oldValue: null, newValue: "12/29/2025" },
    { attributeName: "Description", moduleName: "Attribute", oldValue: null, newValue: "Annual IT Security Audit" },
    { attributeName: "DueDate", moduleName: "Attribute", oldValue: null, newValue: "01/31/2026" },
    { attributeName: "EndDate", moduleName: "Attribute", oldValue: null, newValue: null },
    { attributeName: "EvidenceCount", moduleName: "Attribute", oldValue: null, newValue: "0" },
    { attributeName: "FindingsCount", moduleName: "Attribute", oldValue: null, newValue: "0" },
    { attributeName: "IsActive", moduleName: "Attribute", oldValue: null, newValue: "true" },
    { attributeName: "IsApproved", moduleName: "Attribute", oldValue: null, newValue: "false" },
    { attributeName: "IsCompleted", moduleName: "Attribute", oldValue: null, newValue: "false" },
  ];

  // Add more attributes to reach 95
  for (let i = 30; i < 95; i++) {
    auditPlanChanges.push({
      attributeName: `Attribute_${i}`,
      moduleName: "Attribute",
      oldValue: null,
      newValue: null,
    });
  }

  for (const change of auditPlanChanges) {
    await prisma.auditLogChange.create({
      data: { auditLogId: auditPlanLog2.id, ...change },
    });
  }

  // Risk.RiskAssessment - 1 attribute
  const riskAssessmentLog = await prisma.auditLog.create({
    data: {
      entityType: "Risk.RiskAssessment",
      referenceNumber: "115123265474812347",
      entityId: "ra-001",
      userName: "bts",
      type: "Change",
      attributeCount: 1,
      createdAt: new Date("2025-12-29T13:32:00Z"),
    },
  });

  await prisma.auditLogChange.create({
    data: {
      auditLogId: riskAssessmentLog.id,
      attributeName: "DueDate",
      moduleName: "Attribute",
      oldValue: "12/24/2025 (UTC)",
      newValue: "12/29/2025 (UTC)",
    },
  });

  // Compliance.Evidence - 30 attributes (12 entries)
  const evidenceRefNumbers = [
    "112027040731400770", "112027040731400654", "112027040731400497", "112027040731400344",
    "112027040731400254", "112027040731400155", "112027040731399991", "112027040731399881",
    "112027040731399706", "112027040731399640", "112027040731399444", "112027040731399419"
  ];
  for (let i = 0; i < 12; i++) {
    const evidenceLog = await prisma.auditLog.create({
      data: {
        entityType: "Compliance.Evidence",
        referenceNumber: evidenceRefNumbers[i],
        entityId: `ev-00${i + 1}`,
        userName: "bts",
        type: "Create",
        attributeCount: 30,
        createdAt: new Date("2025-12-29T12:28:00Z"),
      },
    });

    const evidenceChanges = [
      { attributeName: "EvidenceName", moduleName: "Attribute", oldValue: null, newValue: `Evidence Document ${i + 1}` },
      { attributeName: "EvidenceType", moduleName: "Attribute", oldValue: null, newValue: "Document" },
      { attributeName: "EvidenceStatus", moduleName: "Attribute", oldValue: null, newValue: "Pending" },
      { attributeName: "UploadDate", moduleName: "Attribute", oldValue: null, newValue: "12/29/2025" },
      { attributeName: "ReviewDate", moduleName: "Attribute", oldValue: null, newValue: null },
      { attributeName: "Compliance.Evidence_Control", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
      { attributeName: "Compliance.Evidence_Framework", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
      { attributeName: "Compliance.Evidence_Department", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
      { attributeName: "Compliance.Evidence_Assignee", moduleName: "Reference", oldValue: "no reference", newValue: "reference added" },
      { attributeName: "IsValid", moduleName: "Attribute", oldValue: null, newValue: "true" },
      { attributeName: "ValidFrom", moduleName: "Attribute", oldValue: null, newValue: "12/29/2025" },
      { attributeName: "ValidTo", moduleName: "Attribute", oldValue: null, newValue: "12/29/2026" },
      { attributeName: "Description", moduleName: "Attribute", oldValue: null, newValue: `Description for evidence ${i + 1}` },
      { attributeName: "AttachmentCount", moduleName: "Attribute", oldValue: null, newValue: "1" },
      { attributeName: "CommentCount", moduleName: "Attribute", oldValue: null, newValue: "0" },
    ];

    // Add more to reach 30
    for (let j = 15; j < 30; j++) {
      evidenceChanges.push({
        attributeName: `EvidenceField_${j}`,
        moduleName: "Attribute",
        oldValue: null,
        newValue: null,
      });
    }

    for (const change of evidenceChanges) {
      await prisma.auditLogChange.create({
        data: { auditLogId: evidenceLog.id, ...change },
      });
    }
  }

  // Add more varied audit log entries for comprehensive testing
  const additionalLogs = [
    { entityType: "Organization.Department", userName: "bts.admin", type: "Create", attributeCount: 5, date: "2025-12-28T10:00:00Z" },
    { entityType: "Organization.User", userName: "bts.admin", type: "Create", attributeCount: 12, date: "2025-12-28T09:30:00Z" },
    { entityType: "Risk.RiskRegister", userName: "mike.wilson", type: "Change", attributeCount: 8, date: "2025-12-27T15:00:00Z" },
    { entityType: "Compliance.Control", userName: "john.doe", type: "Create", attributeCount: 15, date: "2025-12-27T14:00:00Z" },
    { entityType: "Asset.AssetInventory", userName: "bts.admin", type: "Create", attributeCount: 10, date: "2025-12-26T11:00:00Z" },
    { entityType: "AuditManagement.Finding", userName: "sarah.smith", type: "Create", attributeCount: 7, date: "2025-12-26T10:00:00Z" },
    { entityType: "Compliance.Exception", userName: "john.doe", type: "Change", attributeCount: 6, date: "2025-12-25T16:00:00Z" },
    { entityType: "Organization.Process", userName: "bts.admin", type: "Create", attributeCount: 9, date: "2025-12-25T14:00:00Z" },
    { entityType: "Governance.Policy", userName: "john.doe", type: "Change", attributeCount: 11, date: "2025-12-24T12:00:00Z" },
    { entityType: "Risk.RiskTreatment", userName: "mike.wilson", type: "Create", attributeCount: 4, date: "2025-12-24T10:00:00Z" },
  ];

  for (const log of additionalLogs) {
    const auditLog = await prisma.auditLog.create({
      data: {
        entityType: log.entityType,
        referenceNumber: generateRefNumber(),
        entityId: `entity-${Math.random().toString(36).substr(2, 9)}`,
        userName: log.userName,
        type: log.type,
        attributeCount: log.attributeCount,
        createdAt: new Date(log.date),
      },
    });

    // Add corresponding changes
    for (let i = 0; i < log.attributeCount; i++) {
      await prisma.auditLogChange.create({
        data: {
          auditLogId: auditLog.id,
          attributeName: `Field_${i + 1}`,
          moduleName: i % 3 === 0 ? "Reference" : "Attribute",
          oldValue: i % 2 === 0 ? "Previous Value" : null,
          newValue: `New Value ${i + 1}`,
        },
      });
    }
  }

  console.log("✅ Audit Logs created with comprehensive data");

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
