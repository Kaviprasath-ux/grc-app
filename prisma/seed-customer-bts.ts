import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed CustomerAdmin 'bts' with comprehensive industry-relevant data
 *
 * This creates:
 * 1. CustomerAdmin user 'bts' with password '1'
 * 2. Organization profile and settings
 * 3. Departments, users, stakeholders
 * 4. Workflow data for all modules (Compliance, Risk, Audit, Asset)
 */

async function main() {
  console.log("🏢 Seeding Customer Account 'bts'...");

  // ==================== CREATE CUSTOMERADMIN USER 'bts' ====================
  console.log("\n👤 Creating CustomerAdmin user 'bts'...");

  // Ensure CustomerAdministrator role exists
  const customerAdminRole = await prisma.role.upsert({
    where: { name: "CustomerAdministrator" },
    update: {},
    create: {
      name: "CustomerAdministrator",
      description: "Organization-level admin, manages users and settings",
      isSystem: true,
    },
  });

  // Create bts user
  const btsUser = await prisma.user.upsert({
    where: { userName: "bts" },
    update: {
      password: "1",
      email: "bts@customer.com",
      firstName: "BTS",
      lastName: "Customer",
      fullName: "BTS Customer Admin",
      role: "CustomerAdministrator",
    },
    create: {
      userId: "BTS-001",
      userName: "bts",
      email: "bts@customer.com",
      password: "1",
      firstName: "BTS",
      lastName: "Customer",
      fullName: "BTS Customer Admin",
      designation: "Customer Administrator",
      role: "CustomerAdministrator",
      function: "Administration",
      customerCode: "GRC_001",
    },
  });

  // Assign CustomerAdministrator role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: btsUser.id,
        roleId: customerAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: btsUser.id,
      roleId: customerAdminRole.id,
    },
  });
  console.log("  ✓ CustomerAdmin 'bts' created with password '1'");

  // ==================== CREATE ORGANIZATION ====================
  console.log("\n🏛️ Creating Organization...");

  const organization = await prisma.organization.upsert({
    where: { id: "org-bts" },
    update: {},
    create: {
      id: "org-bts",
      name: "BTS Financial Services",
      email: "info@btsfinancial.com",
      phone: "+1 555 123 4567",
      establishedDate: "2010-03-15",
      employeeCount: 250,
      branchCount: 5,
      headOfficeLocation: "New York, USA",
      headOfficeAddress: "100 Wall Street, Suite 2500, New York, NY 10005",
      website: "https://www.btsfinancial.com",
      description: "BTS Financial Services is a leading financial technology company providing innovative banking solutions, investment management, and regulatory compliance services to institutions worldwide.",
      vision: "To be the most trusted financial technology partner, enabling secure and compliant digital transformation for financial institutions globally.",
      mission: "Empowering financial institutions with cutting-edge technology solutions that ensure regulatory compliance, mitigate risks, and drive operational excellence.",
      value: "Integrity, Innovation, Excellence, Client Focus, Regulatory Compliance",
      ceoMessage: "At BTS Financial Services, we are committed to helping our clients navigate the complex regulatory landscape while delivering innovative solutions that drive growth and efficiency.",
      facebook: "https://facebook.com/btsfinancial",
      youtube: "https://youtube.com/@btsfinancial",
      twitter: "https://twitter.com/btsfinancial",
      linkedin: "https://linkedin.com/company/bts-financial-services",
    },
  });
  console.log("  ✓ Organization created");

  // Create Branches
  await prisma.branch.deleteMany({ where: { organizationId: organization.id } });
  const branches = [
    { location: "London, UK", address: "25 Bank Street, Canary Wharf, London E14 5JP" },
    { location: "Singapore", address: "1 Raffles Place, Tower 2, #20-01, Singapore 048616" },
    { location: "Dubai, UAE", address: "Dubai International Financial Centre, Gate Village 3" },
    { location: "Tokyo, Japan", address: "Marunouchi Building, 2-4-1 Marunouchi, Chiyoda-ku" },
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
    { locationType: "On-Prem", address: "Primary Data Center, New Jersey, USA" },
    { locationType: "Outsourced", vendor: "Amazon Web Services (US-East)" },
    { locationType: "Outsourced", vendor: "Microsoft Azure (West Europe)" },
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
    { name: "Amazon Web Services", serviceType: "IaaS" },
    { name: "Microsoft Azure", serviceType: "PaaS" },
    { name: "Salesforce", serviceType: "SaaS" },
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
    { name: "Executive Management", description: "C-suite and senior leadership" },
    { name: "Information Technology", description: "IT infrastructure, development, and support" },
    { name: "Information Security", description: "Cybersecurity, data protection, and security operations" },
    { name: "Risk Management", description: "Enterprise risk management and assessment" },
    { name: "Compliance", description: "Regulatory compliance and governance" },
    { name: "Internal Audit", description: "Internal audit and assurance" },
    { name: "Finance", description: "Financial operations and accounting" },
    { name: "Human Resources", description: "HR operations and talent management" },
    { name: "Operations", description: "Business operations and processes" },
    { name: "Legal", description: "Legal affairs and contracts" },
  ];

  const createdDepts: Record<string, string> = {};
  for (const dept of departmentData) {
    const created = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    createdDepts[dept.name] = created.id;
  }
  console.log("  ✓ Departments created");

  // ==================== CREATE USERS ====================
  console.log("\n👥 Creating Users...");

  const users = [
    { userId: "BTS-002", userName: "alice.ciso", email: "alice.ciso@btsfinancial.com", firstName: "Alice", lastName: "Chen", department: "Information Security", designation: "Chief Information Security Officer", role: "Reviewer", function: "Security" },
    { userId: "BTS-003", userName: "bob.cro", email: "bob.cro@btsfinancial.com", firstName: "Bob", lastName: "Martinez", department: "Risk Management", designation: "Chief Risk Officer", role: "Reviewer", function: "Risk" },
    { userId: "BTS-004", userName: "carol.cco", email: "carol.cco@btsfinancial.com", firstName: "Carol", lastName: "Johnson", department: "Compliance", designation: "Chief Compliance Officer", role: "Reviewer", function: "Compliance" },
    { userId: "BTS-005", userName: "david.audit", email: "david.audit@btsfinancial.com", firstName: "David", lastName: "Williams", department: "Internal Audit", designation: "Head of Internal Audit", role: "AuditHead", function: "Audit" },
    { userId: "BTS-006", userName: "emma.it", email: "emma.it@btsfinancial.com", firstName: "Emma", lastName: "Thompson", department: "Information Technology", designation: "IT Director", role: "Contributor", function: "IT" },
    { userId: "BTS-007", userName: "frank.risk", email: "frank.risk@btsfinancial.com", firstName: "Frank", lastName: "Davis", department: "Risk Management", designation: "Senior Risk Analyst", role: "Contributor", function: "Risk" },
    { userId: "BTS-008", userName: "grace.compliance", email: "grace.compliance@btsfinancial.com", firstName: "Grace", lastName: "Miller", department: "Compliance", designation: "Compliance Manager", role: "Contributor", function: "Compliance" },
    { userId: "BTS-009", userName: "henry.security", email: "henry.security@btsfinancial.com", firstName: "Henry", lastName: "Wilson", department: "Information Security", designation: "Security Analyst", role: "Contributor", function: "Security" },
    { userId: "BTS-010", userName: "iris.hr", email: "iris.hr@btsfinancial.com", firstName: "Iris", lastName: "Brown", department: "Human Resources", designation: "HR Manager", role: "Auditee", function: "Business" },
    { userId: "BTS-011", userName: "jack.finance", email: "jack.finance@btsfinancial.com", firstName: "Jack", lastName: "Taylor", department: "Finance", designation: "Finance Manager", role: "Auditee", function: "Business" },
  ];

  const createdUsers: Record<string, string> = {};
  createdUsers["bts"] = btsUser.id;

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { userName: user.userName },
      update: {},
      create: {
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        password: "password123",
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
  console.log("  ✓ Users created");

  // ==================== CREATE STAKEHOLDERS ====================
  console.log("\n🤝 Creating Stakeholders...");

  const stakeholders = [
    { name: "Board of Directors", email: "board@btsfinancial.com", type: "Internal", status: "Active" },
    { name: "External Auditors - KPMG", email: "audit@kpmg.com", type: "External", status: "Active" },
    { name: "Regulatory Authority - SEC", email: "compliance@sec.gov", type: "External", status: "Active" },
    { name: "Technology Vendor - Oracle", email: "support@oracle.com", type: "Third Party", status: "Active" },
    { name: "Cloud Provider - AWS", email: "enterprise@aws.com", type: "Third Party", status: "Active" },
    { name: "Insurance Provider", email: "cyber@insureco.com", type: "Third Party", status: "Active" },
    { name: "Legal Counsel - Jones Day", email: "legal@jonesday.com", type: "External", status: "Active" },
  ];

  for (const stakeholder of stakeholders) {
    await prisma.stakeholder.upsert({
      where: { id: `stakeholder-${stakeholder.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `stakeholder-${stakeholder.name.toLowerCase().replace(/\s+/g, '-')}`,
        ...stakeholder,
      },
    });
  }
  console.log("  ✓ Stakeholders created");

  // ==================== CREATE CONTROL DOMAINS ====================
  console.log("\n📋 Creating Control Domains...");

  const domains = [
    { code: "GOV", name: "Governance" },
    { code: "IAM", name: "Identity & Access Management" },
    { code: "DPR", name: "Data Protection" },
    { code: "SEC", name: "Security Operations" },
    { code: "NET", name: "Network Security" },
    { code: "CHG", name: "Change Management" },
    { code: "INC", name: "Incident Management" },
    { code: "BCP", name: "Business Continuity" },
    { code: "VND", name: "Vendor Management" },
    { code: "HRS", name: "Human Resources Security" },
    { code: "PHY", name: "Physical Security" },
    { code: "ASM", name: "Asset Management" },
  ];

  const createdDomains: Record<string, string> = {};
  for (const domain of domains) {
    const created = await prisma.controlDomain.upsert({
      where: { name: domain.name },
      update: { code: domain.code },
      create: domain,
    });
    createdDomains[domain.name] = created.id;
  }
  console.log("  ✓ Control domains created");

  // ==================== CREATE CONTROLS ====================
  console.log("\n🎛️ Creating Controls...");

  const controls = [
    // Governance Controls
    { code: "GOV-01", name: "Information Security Policy", description: "Documented information security policy approved by management", domain: "Governance", status: "Compliant" },
    { code: "GOV-02", name: "Security Roles & Responsibilities", description: "Defined security roles and responsibilities across the organization", domain: "Governance", status: "Compliant" },
    { code: "GOV-03", name: "Risk Management Framework", description: "Established enterprise risk management framework", domain: "Governance", status: "Compliant" },
    { code: "GOV-04", name: "Compliance Management", description: "Regulatory compliance monitoring and reporting process", domain: "Governance", status: "Partial Compliant" },

    // Identity & Access Management Controls
    { code: "IAM-01", name: "User Access Management", description: "Formal user registration and de-registration process", domain: "Identity & Access Management", status: "Compliant" },
    { code: "IAM-02", name: "Privileged Access Management", description: "Restricted and controlled allocation of privileged access rights", domain: "Identity & Access Management", status: "Compliant" },
    { code: "IAM-03", name: "Password Management", description: "Password policy and management system", domain: "Identity & Access Management", status: "Compliant" },
    { code: "IAM-04", name: "Multi-Factor Authentication", description: "MFA implementation for critical systems", domain: "Identity & Access Management", status: "Partial Compliant" },
    { code: "IAM-05", name: "Access Review", description: "Periodic review of user access rights", domain: "Identity & Access Management", status: "Compliant" },

    // Data Protection Controls
    { code: "DPR-01", name: "Data Classification", description: "Data classification and handling procedures", domain: "Data Protection", status: "Compliant" },
    { code: "DPR-02", name: "Data Encryption", description: "Encryption of sensitive data at rest and in transit", domain: "Data Protection", status: "Compliant" },
    { code: "DPR-03", name: "Data Backup", description: "Regular backup and recovery procedures", domain: "Data Protection", status: "Compliant" },
    { code: "DPR-04", name: "Data Retention", description: "Data retention and disposal policies", domain: "Data Protection", status: "Partial Compliant" },
    { code: "DPR-05", name: "Privacy Controls", description: "Personal data protection and privacy controls", domain: "Data Protection", status: "Compliant" },

    // Security Operations Controls
    { code: "SEC-01", name: "Security Monitoring", description: "24/7 security monitoring and alerting", domain: "Security Operations", status: "Compliant" },
    { code: "SEC-02", name: "Vulnerability Management", description: "Regular vulnerability scanning and remediation", domain: "Security Operations", status: "Compliant" },
    { code: "SEC-03", name: "Patch Management", description: "Timely patching of systems and applications", domain: "Security Operations", status: "Partial Compliant" },
    { code: "SEC-04", name: "Malware Protection", description: "Anti-malware and endpoint protection", domain: "Security Operations", status: "Compliant" },
    { code: "SEC-05", name: "Log Management", description: "Centralized logging and log retention", domain: "Security Operations", status: "Compliant" },

    // Network Security Controls
    { code: "NET-01", name: "Firewall Management", description: "Network firewall configuration and management", domain: "Network Security", status: "Compliant" },
    { code: "NET-02", name: "Network Segmentation", description: "Network segmentation and isolation", domain: "Network Security", status: "Compliant" },
    { code: "NET-03", name: "Intrusion Detection", description: "Intrusion detection and prevention systems", domain: "Network Security", status: "Compliant" },
    { code: "NET-04", name: "Secure Remote Access", description: "VPN and secure remote access controls", domain: "Network Security", status: "Compliant" },

    // Change Management Controls
    { code: "CHG-01", name: "Change Management Process", description: "Formal change management process", domain: "Change Management", status: "Compliant" },
    { code: "CHG-02", name: "Change Advisory Board", description: "CAB review for significant changes", domain: "Change Management", status: "Compliant" },
    { code: "CHG-03", name: "Emergency Change Process", description: "Emergency change procedures", domain: "Change Management", status: "Partial Compliant" },

    // Incident Management Controls
    { code: "INC-01", name: "Incident Response Plan", description: "Documented incident response procedures", domain: "Incident Management", status: "Compliant" },
    { code: "INC-02", name: "Incident Classification", description: "Incident classification and prioritization", domain: "Incident Management", status: "Compliant" },
    { code: "INC-03", name: "Incident Communication", description: "Incident communication and escalation procedures", domain: "Incident Management", status: "Compliant" },

    // Business Continuity Controls
    { code: "BCP-01", name: "Business Continuity Plan", description: "Documented business continuity plan", domain: "Business Continuity", status: "Compliant" },
    { code: "BCP-02", name: "Disaster Recovery", description: "IT disaster recovery procedures", domain: "Business Continuity", status: "Partial Compliant" },
    { code: "BCP-03", name: "BCP Testing", description: "Regular BCP testing and exercises", domain: "Business Continuity", status: "Compliant" },

    // Vendor Management Controls
    { code: "VND-01", name: "Vendor Risk Assessment", description: "Third-party vendor risk assessment", domain: "Vendor Management", status: "Compliant" },
    { code: "VND-02", name: "Vendor Contracts", description: "Security requirements in vendor contracts", domain: "Vendor Management", status: "Compliant" },
    { code: "VND-03", name: "Vendor Monitoring", description: "Ongoing vendor performance monitoring", domain: "Vendor Management", status: "Partial Compliant" },

    // Human Resources Security Controls
    { code: "HRS-01", name: "Background Checks", description: "Pre-employment background verification", domain: "Human Resources Security", status: "Compliant" },
    { code: "HRS-02", name: "Security Awareness Training", description: "Security awareness and training program", domain: "Human Resources Security", status: "Compliant" },
    { code: "HRS-03", name: "Termination Procedures", description: "Employee termination and access revocation", domain: "Human Resources Security", status: "Compliant" },

    // Physical Security Controls
    { code: "PHY-01", name: "Physical Access Control", description: "Physical access control to facilities", domain: "Physical Security", status: "Compliant" },
    { code: "PHY-02", name: "Visitor Management", description: "Visitor registration and escort procedures", domain: "Physical Security", status: "Compliant" },
    { code: "PHY-03", name: "CCTV Surveillance", description: "Video surveillance in critical areas", domain: "Physical Security", status: "Compliant" },

    // Asset Management Controls
    { code: "ASM-01", name: "Asset Inventory", description: "Maintained inventory of all assets", domain: "Asset Management", status: "Compliant" },
    { code: "ASM-02", name: "Asset Classification", description: "Asset classification and ownership", domain: "Asset Management", status: "Compliant" },
    { code: "ASM-03", name: "Asset Disposal", description: "Secure asset disposal procedures", domain: "Asset Management", status: "Compliant" },
  ];

  const createdControls: Record<string, string> = {};
  for (const control of controls) {
    const created = await prisma.control.upsert({
      where: { controlCode: control.code },
      update: {
        name: control.name,
        description: control.description,
        status: control.status,
        domainId: createdDomains[control.domain],
      },
      create: {
        controlCode: control.code,
        name: control.name,
        description: control.description,
        status: control.status,
        entities: "Organization Wide",
        domainId: createdDomains[control.domain],
        ownerId: createdUsers["alice.ciso"],
      },
    });
    createdControls[control.code] = created.id;
  }
  console.log("  ✓ Controls created");

  // ==================== CREATE EVIDENCES ====================
  console.log("\n📄 Creating Evidences...");

  const evidences = [
    { code: "EVD-001", name: "Information Security Policy Document", description: "Approved information security policy document", domain: "Governance", recurrence: "Yearly", controlCode: "GOV-01" },
    { code: "EVD-002", name: "RACI Matrix", description: "Security roles and responsibilities RACI matrix", domain: "Governance", recurrence: "Yearly", controlCode: "GOV-02" },
    { code: "EVD-003", name: "Risk Register", description: "Enterprise risk register with assessments", domain: "Risk Management", recurrence: "Quarterly", controlCode: "GOV-03" },
    { code: "EVD-004", name: "User Access Review Report", description: "Quarterly user access review report", domain: "Identity & Access Management", recurrence: "Quarterly", controlCode: "IAM-05" },
    { code: "EVD-005", name: "Privileged Account List", description: "List of privileged accounts with justification", domain: "Identity & Access Management", recurrence: "Monthly", controlCode: "IAM-02" },
    { code: "EVD-006", name: "Encryption Key Management Records", description: "Encryption key management and rotation records", domain: "Data Protection", recurrence: "Quarterly", controlCode: "DPR-02" },
    { code: "EVD-007", name: "Backup Restoration Test Results", description: "Backup restoration test results", domain: "Data Protection", recurrence: "Monthly", controlCode: "DPR-03" },
    { code: "EVD-008", name: "Vulnerability Scan Reports", description: "Monthly vulnerability assessment reports", domain: "Security Operations", recurrence: "Monthly", controlCode: "SEC-02" },
    { code: "EVD-009", name: "Patch Management Status", description: "Patch management compliance report", domain: "Security Operations", recurrence: "Monthly", controlCode: "SEC-03" },
    { code: "EVD-010", name: "Firewall Rule Review", description: "Firewall rule set review documentation", domain: "Network Security", recurrence: "Quarterly", controlCode: "NET-01" },
    { code: "EVD-011", name: "Change Advisory Board Minutes", description: "CAB meeting minutes and decisions", domain: "Change Management", recurrence: "Monthly", controlCode: "CHG-02" },
    { code: "EVD-012", name: "Incident Response Test Results", description: "Incident response drill results", domain: "Incident Management", recurrence: "Quarterly", controlCode: "INC-01" },
    { code: "EVD-013", name: "BCP Test Report", description: "Business continuity plan test report", domain: "Business Continuity", recurrence: "Yearly", controlCode: "BCP-03" },
    { code: "EVD-014", name: "Vendor Risk Assessments", description: "Third-party vendor risk assessment reports", domain: "Vendor Management", recurrence: "Yearly", controlCode: "VND-01" },
    { code: "EVD-015", name: "Security Awareness Training Records", description: "Employee security training completion records", domain: "Human Resources Security", recurrence: "Yearly", controlCode: "HRS-02" },
    { code: "EVD-016", name: "Physical Access Logs", description: "Physical access control system logs", domain: "Physical Security", recurrence: "Monthly", controlCode: "PHY-01" },
    { code: "EVD-017", name: "Asset Inventory Report", description: "Complete asset inventory with classifications", domain: "Asset Management", recurrence: "Quarterly", controlCode: "ASM-01" },
    { code: "EVD-018", name: "MFA Implementation Evidence", description: "Multi-factor authentication deployment evidence", domain: "Identity & Access Management", recurrence: "Quarterly", controlCode: "IAM-04" },
    { code: "EVD-019", name: "Log Retention Policy Compliance", description: "Evidence of log retention policy compliance", domain: "Security Operations", recurrence: "Quarterly", controlCode: "SEC-05" },
    { code: "EVD-020", name: "Network Segmentation Diagram", description: "Network architecture and segmentation documentation", domain: "Network Security", recurrence: "Yearly", controlCode: "NET-02" },
  ];

  const createdEvidences: Record<string, string> = {};
  for (const evidence of evidences) {
    const created = await prisma.evidence.upsert({
      where: { evidenceCode: evidence.code },
      update: {},
      create: {
        evidenceCode: evidence.code,
        name: evidence.name,
        description: evidence.description,
        domain: evidence.domain,
        recurrence: evidence.recurrence,
        status: "Not Uploaded",
        controlId: createdControls[evidence.controlCode],
        departmentId: createdDepts["Compliance"],
        assigneeId: createdUsers["grace.compliance"],
      },
    });
    createdEvidences[evidence.code] = created.id;

    // Link evidence to control
    await prisma.evidenceControl.upsert({
      where: {
        evidenceId_controlId: {
          evidenceId: created.id,
          controlId: createdControls[evidence.controlCode],
        },
      },
      update: {},
      create: {
        evidenceId: created.id,
        controlId: createdControls[evidence.controlCode],
      },
    });
  }
  console.log("  ✓ Evidences created");

  // ==================== CREATE GOVERNANCE (POLICIES) ====================
  console.log("\n📜 Creating Governance Documents...");

  const policies = [
    { code: "POL-001", name: "Information Security Policy", type: "Policy", department: "Information Security", status: "Published" },
    { code: "POL-002", name: "Acceptable Use Policy", type: "Policy", department: "Information Security", status: "Published" },
    { code: "POL-003", name: "Access Control Policy", type: "Policy", department: "Information Security", status: "Published" },
    { code: "POL-004", name: "Data Classification Policy", type: "Policy", department: "Information Security", status: "Published" },
    { code: "POL-005", name: "Incident Response Policy", type: "Policy", department: "Information Security", status: "Published" },
    { code: "POL-006", name: "Business Continuity Policy", type: "Policy", department: "Risk Management", status: "Published" },
    { code: "POL-007", name: "Vendor Management Policy", type: "Policy", department: "Compliance", status: "Draft" },
    { code: "STD-001", name: "Password Standard", type: "Standard", department: "Information Security", status: "Published" },
    { code: "STD-002", name: "Encryption Standard", type: "Standard", department: "Information Security", status: "Published" },
    { code: "STD-003", name: "Network Security Standard", type: "Standard", department: "Information Technology", status: "Published" },
    { code: "STD-004", name: "Logging and Monitoring Standard", type: "Standard", department: "Information Security", status: "Draft" },
    { code: "PRC-001", name: "User Provisioning Procedure", type: "Procedure", department: "Information Technology", status: "Published" },
    { code: "PRC-002", name: "Backup and Recovery Procedure", type: "Procedure", department: "Information Technology", status: "Published" },
    { code: "PRC-003", name: "Change Management Procedure", type: "Procedure", department: "Information Technology", status: "Published" },
    { code: "PRC-004", name: "Incident Handling Procedure", type: "Procedure", department: "Information Security", status: "Published" },
  ];

  for (const policy of policies) {
    await prisma.policy.upsert({
      where: { code: policy.code },
      update: {},
      create: {
        code: policy.code,
        name: policy.name,
        documentType: policy.type,
        version: "1.0",
        status: policy.status,
        departmentId: createdDepts[policy.department],
        assigneeId: createdUsers["grace.compliance"],
        approverId: createdUsers["carol.cco"],
        effectiveDate: new Date("2024-01-01"),
        reviewDate: new Date("2025-01-01"),
      },
    });
  }
  console.log("  ✓ Governance documents created");

  // ==================== CREATE RISKS ====================
  console.log("\n⚠️ Creating Risks...");

  // Create Risk Categories
  const riskCategories = [
    { name: "Strategic", description: "Risks affecting strategic objectives", color: "#3B82F6" },
    { name: "Operational", description: "Risks affecting operations", color: "#10B981" },
    { name: "Financial", description: "Financial and market risks", color: "#F59E0B" },
    { name: "Compliance", description: "Regulatory and compliance risks", color: "#8B5CF6" },
    { name: "IT/Cyber", description: "Technology and cybersecurity risks", color: "#EF4444" },
    { name: "Reputational", description: "Brand and reputation risks", color: "#EC4899" },
  ];

  const createdRiskCategories: Record<string, string> = {};
  for (const cat of riskCategories) {
    const created = await prisma.riskCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdRiskCategories[cat.name] = created.id;
  }

  const risks = [
    { id: "RSK-001", name: "Data Breach", description: "Unauthorized access to sensitive customer data", category: "IT/Cyber", likelihood: 3, impact: 5, status: "Open" },
    { id: "RSK-002", name: "Ransomware Attack", description: "Ransomware infection affecting critical systems", category: "IT/Cyber", likelihood: 3, impact: 5, status: "Open" },
    { id: "RSK-003", name: "Regulatory Non-Compliance", description: "Failure to meet regulatory requirements", category: "Compliance", likelihood: 2, impact: 4, status: "In Progress" },
    { id: "RSK-004", name: "Third-Party Vendor Failure", description: "Critical vendor service disruption", category: "Operational", likelihood: 3, impact: 4, status: "Open" },
    { id: "RSK-005", name: "Insider Threat", description: "Malicious or negligent employee actions", category: "IT/Cyber", likelihood: 2, impact: 4, status: "Open" },
    { id: "RSK-006", name: "Business Continuity Failure", description: "Inability to recover from disaster", category: "Operational", likelihood: 2, impact: 5, status: "In Progress" },
    { id: "RSK-007", name: "Key Person Dependency", description: "Over-reliance on specific individuals", category: "Operational", likelihood: 3, impact: 3, status: "Open" },
    { id: "RSK-008", name: "Market Volatility", description: "Financial losses due to market changes", category: "Financial", likelihood: 4, impact: 3, status: "Open" },
    { id: "RSK-009", name: "Reputational Damage", description: "Negative publicity affecting brand", category: "Reputational", likelihood: 2, impact: 4, status: "Open" },
    { id: "RSK-010", name: "Cloud Service Outage", description: "Extended cloud service unavailability", category: "IT/Cyber", likelihood: 2, impact: 4, status: "Open" },
  ];

  const createdRisks: Record<string, string> = {};
  for (const risk of risks) {
    const riskScore = risk.likelihood * risk.impact;
    let riskRating = "Low";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very High";
    else if (riskScore >= 10) riskRating = "High";
    else if (riskScore >= 5) riskRating = "Medium";

    const created = await prisma.risk.upsert({
      where: { riskId: risk.id },
      update: {},
      create: {
        riskId: risk.id,
        name: risk.name,
        description: risk.description,
        categoryId: createdRiskCategories[risk.category],
        departmentId: createdDepts["Risk Management"],
        ownerId: createdUsers["bob.cro"],
        likelihood: risk.likelihood,
        impact: risk.impact,
        riskScore: riskScore,
        riskRating: riskRating,
        status: risk.status,
        responseStrategy: "Treat",
      },
    });
    createdRisks[risk.id] = created.id;
  }
  console.log("  ✓ Risks created");

  // ==================== CREATE ASSETS ====================
  console.log("\n💻 Creating Assets...");

  // Create Asset Categories
  const assetCategories = [
    { name: "Hardware", description: "Physical computing equipment" },
    { name: "Software", description: "Applications and systems" },
    { name: "Data", description: "Information assets" },
    { name: "Network", description: "Network infrastructure" },
    { name: "People", description: "Human resources" },
  ];

  const createdAssetCategories: Record<string, string> = {};
  for (const cat of assetCategories) {
    const created = await prisma.assetCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdAssetCategories[cat.name] = created.id;
  }

  // Create Asset Sub Categories
  const assetSubCategories = [
    { name: "Server", category: "Hardware" },
    { name: "Workstation", category: "Hardware" },
    { name: "Network Device", category: "Hardware" },
    { name: "Storage Device", category: "Hardware" },
    { name: "Enterprise Application", category: "Software" },
    { name: "Database", category: "Software" },
    { name: "Operating System", category: "Software" },
    { name: "Security Tool", category: "Software" },
    { name: "Customer Data", category: "Data" },
    { name: "Financial Data", category: "Data" },
    { name: "Employee Data", category: "Data" },
  ];

  const createdAssetSubCategories: Record<string, string> = {};
  for (const subCat of assetSubCategories) {
    const key = `${subCat.category}-${subCat.name}`;
    const created = await prisma.assetSubCategory.upsert({
      where: {
        name_categoryId: {
          name: subCat.name,
          categoryId: createdAssetCategories[subCat.category],
        },
      },
      update: {},
      create: {
        name: subCat.name,
        categoryId: createdAssetCategories[subCat.category],
      },
    });
    createdAssetSubCategories[key] = created.id;
  }

  // Create Asset Groups
  const assetGroups = [
    { name: "Core Banking", description: "Core banking systems" },
    { name: "Trading Platform", description: "Trading systems" },
    { name: "Customer Portal", description: "Customer-facing systems" },
    { name: "Internal Operations", description: "Internal business systems" },
    { name: "Security Infrastructure", description: "Security tools and systems" },
  ];

  const createdAssetGroups: Record<string, string> = {};
  for (const group of assetGroups) {
    const created = await prisma.assetGroup.upsert({
      where: { name: group.name },
      update: {},
      create: group,
    });
    createdAssetGroups[group.name] = created.id;
  }

  const assets = [
    { id: "AST-001", name: "Core Banking Server", category: "Hardware", subCategory: "Server", group: "Core Banking", value: 150000, location: "Primary Data Center" },
    { id: "AST-002", name: "Trading Database Server", category: "Hardware", subCategory: "Server", group: "Trading Platform", value: 200000, location: "Primary Data Center" },
    { id: "AST-003", name: "Web Application Server", category: "Hardware", subCategory: "Server", group: "Customer Portal", value: 80000, location: "Cloud - AWS" },
    { id: "AST-004", name: "Core Banking Application", category: "Software", subCategory: "Enterprise Application", group: "Core Banking", value: 500000, location: "On-Premise" },
    { id: "AST-005", name: "Trading Platform", category: "Software", subCategory: "Enterprise Application", group: "Trading Platform", value: 750000, location: "On-Premise" },
    { id: "AST-006", name: "Customer Database", category: "Software", subCategory: "Database", group: "Customer Portal", value: 100000, location: "Primary Data Center" },
    { id: "AST-007", name: "SIEM Solution", category: "Software", subCategory: "Security Tool", group: "Security Infrastructure", value: 120000, location: "Cloud - Azure" },
    { id: "AST-008", name: "Endpoint Protection", category: "Software", subCategory: "Security Tool", group: "Security Infrastructure", value: 50000, location: "Cloud" },
    { id: "AST-009", name: "Network Firewall", category: "Network", subCategory: "Network Device", group: "Security Infrastructure", value: 75000, location: "Primary Data Center" },
    { id: "AST-010", name: "VPN Gateway", category: "Network", subCategory: "Network Device", group: "Security Infrastructure", value: 40000, location: "Primary Data Center" },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { assetId: asset.id },
      update: {},
      create: {
        assetId: asset.id,
        name: asset.name,
        assetType: asset.category,
        categoryId: createdAssetCategories[asset.category],
        subCategoryId: createdAssetSubCategories[`${asset.category}-${asset.subCategory}`],
        groupId: createdAssetGroups[asset.group],
        departmentId: createdDepts["Information Technology"],
        ownerId: createdUsers["emma.it"],
        custodianId: createdUsers["emma.it"],
        value: asset.value,
        location: asset.location,
        status: "Active",
        acquisitionDate: new Date("2023-01-01"),
        nextReviewDate: new Date("2025-06-01"),
      },
    });
  }
  console.log("  ✓ Assets created");

  // ==================== CREATE AUDITS ====================
  console.log("\n🔍 Creating Audits...");

  const audits = [
    { id: "AUD-001", name: "Annual IT General Controls Audit", type: "Internal", department: "Information Technology", status: "Completed" },
    { id: "AUD-002", name: "SOX Compliance Audit", type: "External", department: "Finance", status: "In Progress" },
    { id: "AUD-003", name: "Cybersecurity Assessment", type: "Internal", department: "Information Security", status: "Planned" },
    { id: "AUD-004", name: "Vendor Management Audit", type: "Internal", department: "Compliance", status: "Planned" },
    { id: "AUD-005", name: "Access Control Audit", type: "Internal", department: "Information Security", status: "Completed" },
  ];

  const createdAudits: Record<string, string> = {};
  for (const audit of audits) {
    const created = await prisma.audit.upsert({
      where: { auditId: audit.id },
      update: {},
      create: {
        auditId: audit.id,
        name: audit.name,
        auditType: audit.type,
        departmentId: createdDepts[audit.department],
        auditorId: createdUsers["david.audit"],
        status: audit.status,
        startDate: new Date("2024-01-15"),
        endDate: audit.status === "Completed" ? new Date("2024-03-15") : null,
      },
    });
    createdAudits[audit.id] = created.id;
  }
  console.log("  ✓ Audits created");

  // ==================== CREATE EXCEPTIONS ====================
  console.log("\n⚡ Creating Exceptions...");

  const exceptions = [
    { code: "EXC-001", name: "Legacy System MFA Exception", category: "Control", controlCode: "IAM-04", description: "Legacy trading system cannot support MFA", status: "Approved" },
    { code: "EXC-002", name: "Patch Delay Exception", category: "Control", controlCode: "SEC-03", description: "Critical trading system patch delay due to testing requirements", status: "Pending" },
    { code: "EXC-003", name: "DR Test Postponement", category: "Control", controlCode: "BCP-02", description: "DR test postponed due to system upgrade", status: "Approved" },
    { code: "EXC-004", name: "Vendor Monitoring Gap", category: "Control", controlCode: "VND-03", description: "Temporary gap in vendor monitoring tool", status: "Pending" },
  ];

  for (const exception of exceptions) {
    await prisma.exception.upsert({
      where: { exceptionCode: exception.code },
      update: {},
      create: {
        exceptionCode: exception.code,
        name: exception.name,
        description: exception.description,
        category: exception.category,
        controlId: createdControls[exception.controlCode],
        departmentId: createdDepts["Compliance"],
        requesterId: createdUsers["grace.compliance"],
        approverId: createdUsers["carol.cco"],
        status: exception.status,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      },
    });
  }
  console.log("  ✓ Exceptions created");

  // ==================== CREATE KPIS ====================
  console.log("\n📊 Creating KPIs...");

  const kpis = [
    { code: "KPI-001", objective: "Patch Compliance Rate", description: "Percentage of systems patched within SLA", expectedScore: 95, actualScore: 87, status: "Missed" },
    { code: "KPI-002", objective: "Security Awareness Training Completion", description: "Percentage of employees completing training", expectedScore: 100, actualScore: 98, status: "Achieved" },
    { code: "KPI-003", objective: "Incident Response Time", description: "Average time to respond to security incidents", expectedScore: 100, actualScore: 95, status: "Achieved" },
    { code: "KPI-004", objective: "Access Review Completion", description: "Percentage of access reviews completed on time", expectedScore: 100, actualScore: 100, status: "Achieved" },
    { code: "KPI-005", objective: "Vulnerability Remediation Rate", description: "Critical vulnerabilities remediated within SLA", expectedScore: 90, actualScore: 82, status: "Missed" },
  ];

  for (const kpi of kpis) {
    await prisma.kPI.upsert({
      where: { code: kpi.code },
      update: {},
      create: {
        code: kpi.code,
        objective: kpi.objective,
        description: kpi.description,
        expectedScore: kpi.expectedScore,
        actualScore: kpi.actualScore,
        status: kpi.status,
        reviewDate: new Date(),
        departmentId: createdDepts["Compliance"],
      },
    });
  }
  console.log("  ✓ KPIs created");

  // ==================== CREATE PROCESSES ====================
  console.log("\n⚙️ Creating Processes...");

  const processes = [
    { code: "PRC-IT-001", name: "User Provisioning", type: "Supporting", department: "Information Technology", frequency: "Daily", nature: "Manual + Automated" },
    { code: "PRC-IT-002", name: "Backup Management", type: "Supporting", department: "Information Technology", frequency: "Daily", nature: "Automated" },
    { code: "PRC-IT-003", name: "Change Management", type: "Supporting", department: "Information Technology", frequency: "Weekly", nature: "Manual" },
    { code: "PRC-SEC-001", name: "Vulnerability Management", type: "Supporting", department: "Information Security", frequency: "Monthly", nature: "Manual + Automated" },
    { code: "PRC-SEC-002", name: "Incident Response", type: "Primary", department: "Information Security", frequency: "As needed", nature: "Manual" },
    { code: "PRC-COM-001", name: "Compliance Monitoring", type: "Primary", department: "Compliance", frequency: "Monthly", nature: "Manual" },
    { code: "PRC-RSK-001", name: "Risk Assessment", type: "Primary", department: "Risk Management", frequency: "Quarterly", nature: "Manual" },
    { code: "PRC-AUD-001", name: "Internal Audit", type: "Primary", department: "Internal Audit", frequency: "Quarterly", nature: "Manual" },
  ];

  for (const process of processes) {
    await prisma.process.upsert({
      where: { processCode: process.code },
      update: {},
      create: {
        processCode: process.code,
        name: process.name,
        processType: process.type,
        departmentId: createdDepts[process.department],
        ownerId: createdUsers["emma.it"],
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
    { title: "Online Banking", description: "Customer online banking portal", serviceUser: "External", category: "Financial Services" },
    { title: "Mobile Banking App", description: "Mobile banking application", serviceUser: "External", category: "Financial Services" },
    { title: "Trading Platform", description: "Securities trading platform", serviceUser: "External", category: "Trading Services" },
    { title: "IT Help Desk", description: "Internal IT support services", serviceUser: "Internal", category: "IT Services" },
    { title: "HR Portal", description: "Employee self-service portal", serviceUser: "Internal", category: "HR Services" },
    { title: "Compliance Portal", description: "Compliance monitoring and reporting", serviceUser: "Internal", category: "Compliance Services" },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: `svc-${service.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `svc-${service.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: service.title,
        description: service.description,
        serviceUser: service.serviceUser,
        serviceCategory: service.category,
      },
    });
  }
  console.log("  ✓ Services created");

  // ==================== CREATE ISSUES ====================
  console.log("\n📌 Creating Issues...");

  const issues = [
    { title: "Delayed Security Patch Deployment", domain: "IT", category: "Security", status: "In Progress", department: "Information Technology" },
    { title: "Access Review Backlog", domain: "IT", category: "Compliance", status: "Open", department: "Information Security" },
    { title: "Vendor Contract Renewal Delay", domain: "External", category: "Finance", status: "Pending", department: "Compliance" },
    { title: "BCP Documentation Update", domain: "Internal", category: "Operational", status: "In Progress", department: "Risk Management" },
    { title: "Training Completion Gap", domain: "Internal", category: "Human Resources", status: "Open", department: "Human Resources" },
  ];

  for (const issue of issues) {
    await prisma.issue.upsert({
      where: { id: `issue-${issue.title.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}` },
      update: {},
      create: {
        id: `issue-${issue.title.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
        title: issue.title,
        domain: issue.domain,
        category: issue.category,
        status: issue.status,
        departmentId: createdDepts[issue.department],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log("  ✓ Issues created");

  console.log("\n🎉 Customer Account 'bts' seeding complete!");
  console.log("\n   Login Credentials:");
  console.log("   Username: bts");
  console.log("   Password: 1");
  console.log("   Role: CustomerAdministrator");
}

main()
  .catch((e) => {
    console.error("Error seeding customer data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
