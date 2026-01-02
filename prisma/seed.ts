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
    const created = await prisma.framework.upsert({
      where: { name: framework.name },
      update: {
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
      create: framework,
    });
    createdFrameworks[framework.name] = created.id;
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
      const created = await prisma.requirementCategory.upsert({
        where: { id: key },
        update: {},
        create: {
          id: key,
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
  console.log("✅ Requirement Categories created (46 domains/chapters)");

  // Create Requirements for each category
  const requirements = [
    // ISO 27001:2022 Requirements - Context
    { category: "ISO 27001:2022-4", code: "4.1", name: "Understanding the organization and its context", description: "The organization shall determine external and internal issues relevant to its purpose", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.2", name: "Understanding needs and expectations", description: "The organization shall determine interested parties and their requirements", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.3", name: "Determining the scope of the ISMS", description: "The organization shall determine the boundaries and applicability of the ISMS", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-4", code: "4.4", name: "Information security management system", description: "The organization shall establish, implement, maintain and continually improve an ISMS", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // ISO 27001:2022 Requirements - Leadership
    { category: "ISO 27001:2022-5", code: "5.1", name: "Leadership and commitment", description: "Top management shall demonstrate leadership and commitment to the ISMS", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-5", code: "5.2", name: "Policy", description: "Top management shall establish an information security policy", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-5", code: "5.3", name: "Organizational roles, responsibilities and authorities", description: "Top management shall ensure responsibilities and authorities are assigned", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // ISO 27001:2022 Requirements - Planning
    { category: "ISO 27001:2022-6", code: "6.1", name: "Actions to address risks and opportunities", description: "Plan actions to address risks and opportunities", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { category: "ISO 27001:2022-6", code: "6.2", name: "Information security objectives and planning", description: "Establish information security objectives at relevant functions and levels", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { category: "ISO 27001:2022-6", code: "6.3", name: "Planning of changes", description: "Plan changes to the ISMS in a systematic manner", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

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
      await prisma.requirement.upsert({
        where: { id: `${req.category}-${req.code}` },
        update: {},
        create: {
          id: `${req.category}-${req.code}`,
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
  console.log("✅ Requirements created (40 sample requirements)");

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
      await prisma.control.upsert({
        where: { controlCode: `CTRL-${String(controlIndex).padStart(4, "0")}` },
        update: {},
        create: {
          controlCode: `CTRL-${String(controlIndex).padStart(4, "0")}`,
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

  let policyIdx = 1;
  for (const policy of policies) {
    const code = `POL-${String(policyIdx++).padStart(3, "0")}`;
    await prisma.policy.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: policy.name,
        documentType: policy.documentType,
        departmentId: createdDepts[policy.department],
        status: policy.status,
        version: "1.0",
      },
    });
  }
  console.log("✅ Policies created");

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
      await prisma.evidence.create({
        data: {
          evidenceCode: `EVD-${String(evidenceIdx++).padStart(3, "0")}`,
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
  console.log("✅ Evidence requests created (15 evidence items)");

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
    await prisma.exception.create({
      data: {
        exceptionCode: `EXC-${String(exceptionIdx++).padStart(3, "0")}`,
        name: exception.name,
        category: exception.category,
        departmentId: createdDepts[exception.department],
        status: exception.status,
        startDate: new Date(exception.startDate),
        endDate: new Date(exception.endDate),
      },
    });
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
    await prisma.kPI.upsert({
      where: { code: kpi.code },
      update: {},
      create: {
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
    await prisma.artifact.upsert({
      where: { artifactCode: artifact.artifactCode },
      update: {},
      create: {
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
  console.log("✅ Artifacts created");

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
