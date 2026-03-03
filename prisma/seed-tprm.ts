import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTPRM() {
  console.log("🌱 Seeding TPRM data...");

  // Get tprmcust customer account
  const tprmCust = await prisma.customerAccount.findUnique({
    where: { code: "GRC_002" },
  });
  if (!tprmCust) {
    console.error("tprmcust account not found");
    return;
  }
  const caId = tprmCust.id;

  // Get superadmin user
  const superadmin = await prisma.user.findFirst({
    where: { userName: "superadmin" },
  });
  if (!superadmin) {
    console.error("Superadmin not found");
    return;
  }

  // Vendors
  const vendors = [
    { vendorCode: "VEN001", name: "IBM Corporation", contactEmail: "vendor@ibm.com", contactPhone: "+1-800-IBM-7378", accountManagerName: "James Watson", serviceCategory: "IT Services", status: "Onboarded", onboardedDate: new Date("2025-01-15") },
    { vendorCode: "VEN002", name: "Microsoft Azure", contactEmail: "azure@microsoft.com", contactPhone: "+1-800-642-7676", accountManagerName: "Sarah Chen", serviceCategory: "Cloud Infrastructure", status: "Onboarded", onboardedDate: new Date("2025-02-01") },
    { vendorCode: "VEN003", name: "Deloitte Consulting", contactEmail: "info@deloitte.com", contactPhone: "+1-212-489-1600", accountManagerName: "Robert Miller", serviceCategory: "Consulting", status: "Onboarding" },
    { vendorCode: "VEN004", name: "Palo Alto Networks", contactEmail: "sales@paloaltonetworks.com", contactPhone: "+1-408-753-4000", accountManagerName: "Emily Davis", serviceCategory: "Cybersecurity", status: "Onboarding" },
    { vendorCode: "VEN005", name: "SAP SE", contactEmail: "info@sap.com", contactPhone: "+49-6227-7-47474", accountManagerName: "Hans Mueller", serviceCategory: "ERP Systems", status: "Onboarded", onboardedDate: new Date("2024-11-20") },
    { vendorCode: "VEN006", name: "Accenture", contactEmail: "contact@accenture.com", contactPhone: "+1-312-842-5012", accountManagerName: "Lisa Park", serviceCategory: "Digital Transformation", status: "Onboarding" },
    { vendorCode: "VEN007", name: "AWS (Amazon)", contactEmail: "aws-sales@amazon.com", contactPhone: "+1-206-266-1000", accountManagerName: "David Kim", serviceCategory: "Cloud Infrastructure", status: "Onboarded", onboardedDate: new Date("2025-03-10") },
    { vendorCode: "VEN008", name: "Oracle", contactEmail: "info@oracle.com", contactPhone: "+1-650-506-7000", accountManagerName: "Maria Garcia", serviceCategory: "Database Services", status: "Offboarding", onboardedDate: new Date("2023-06-15") },
    { vendorCode: "VEN009", name: "Wipro Technologies", contactEmail: "info@wipro.com", contactPhone: "+91-80-2844-0011", accountManagerName: "Ravi Sharma", serviceCategory: "IT Outsourcing", status: "Onboarding" },
    { vendorCode: "VEN010", name: "CrowdStrike", contactEmail: "sales@crowdstrike.com", contactPhone: "+1-888-512-8906", accountManagerName: "Alex Johnson", serviceCategory: "Endpoint Security", status: "Onboarded", onboardedDate: new Date("2025-04-01") },
  ];

  const vendorMap: Record<string, string> = {};
  for (const v of vendors) {
    const existing = await prisma.tPRMVendor.findFirst({
      where: { customerAccountId: caId, vendorCode: v.vendorCode },
    });
    if (!existing) {
      const created = await prisma.tPRMVendor.create({
        data: { customerAccountId: caId, ...v },
      });
      vendorMap[v.vendorCode] = created.id;
    } else {
      vendorMap[v.vendorCode] = existing.id;
    }
  }
  console.log(`✅ TPRM Vendors: ${Object.keys(vendorMap).length}`);

  // Assessments
  const assessments = [
    { assessmentCode: "ASM001", vendorCode: "VEN001", assessmentType: "Onboarding Assessment", status: "Completed", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-01-10"), completionDate: new Date("2025-01-20"), questionnaireTemplate: "Standard Onboarding v2" },
    { assessmentCode: "ASM002", vendorCode: "VEN002", assessmentType: "Onboarding Assessment", status: "Approved", assessmentResult: "Satisfactory", vendorSubmissionDate: new Date("2025-01-25"), approvalDate: new Date("2025-02-05"), completionDate: new Date("2025-02-05"), questionnaireTemplate: "Cloud Provider Assessment" },
    { assessmentCode: "ASM003", vendorCode: "VEN003", assessmentType: "Onboarding Assessment", status: "In Progress", vendorSubmissionDate: new Date("2025-06-01"), questionnaireTemplate: "Consulting Firm Assessment" },
    { assessmentCode: "ASM004", vendorCode: "VEN004", assessmentType: "Onboarding Assessment", status: "Submitted", vendorSubmissionDate: new Date("2025-05-15"), questionnaireTemplate: "Security Vendor Assessment" },
    { assessmentCode: "ASM005", vendorCode: "VEN001", assessmentType: "Periodic Assessment", status: "Under Review", vendorSubmissionDate: new Date("2025-07-01"), questionnaireTemplate: "Annual Review Template" },
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

  const asmMap: Record<string, string> = {};
  for (const a of assessments) {
    const { vendorCode, ...rest } = a;
    const existing = await prisma.tPRMAssessment.findFirst({
      where: { customerAccountId: caId, assessmentCode: a.assessmentCode },
    });
    if (!existing) {
      const created = await prisma.tPRMAssessment.create({
        data: {
          customerAccountId: caId,
          vendorId: vendorMap[vendorCode],
          initiatedById: superadmin.id,
          ...rest,
        },
      });
      asmMap[a.assessmentCode] = created.id;
    } else {
      asmMap[a.assessmentCode] = existing.id;
    }
  }
  console.log(`✅ TPRM Assessments: ${Object.keys(asmMap).length}`);

  // Assessment Logs
  const logs = [
    { assessmentCode: "ASM001", domainName: "Information Security", questionNo: "IS-01", questionTitle: "Data Encryption Policy", logMessage: "Vendor confirmed AES-256 encryption for data at rest", apiUrl: "/api/v1/assessment/submit" },
    { assessmentCode: "ASM001", domainName: "Information Security", questionNo: "IS-02", questionTitle: "Access Control Mechanisms", logMessage: "Multi-factor authentication implemented across all systems", apiUrl: "/api/v1/assessment/submit" },
    { assessmentCode: "ASM001", domainName: "Business Continuity", questionNo: "BC-01", questionTitle: "Disaster Recovery Plan", logMessage: "DR plan reviewed and approved. RTO: 4 hours, RPO: 1 hour", documentName: "IBM_DR_Plan_2025.pdf" },
    { assessmentCode: "ASM002", domainName: "Cloud Security", questionNo: "CS-01", questionTitle: "Data Residency", logMessage: "All data stored in EU region as per contract", apiUrl: "/api/v1/cloud/compliance" },
    { assessmentCode: "ASM002", domainName: "Cloud Security", questionNo: "CS-02", questionTitle: "Service Level Agreement", logMessage: "99.99% uptime SLA confirmed", documentName: "Azure_SLA_2025.pdf" },
    { assessmentCode: "ASM002", domainName: "Compliance", questionNo: "CO-01", questionTitle: "SOC 2 Type II", logMessage: "SOC 2 Type II report provided and verified", documentName: "Azure_SOC2_Report.pdf" },
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
    { assessmentCode: "ASM020", domainName: "Endpoint Security", questionNo: "ES-02", questionTitle: "Incident Response", logMessage: "Incident response SLA met - avg response time: 15 minutes", apiUrl: "/api/v1/crowdstrike/incident-metrics" },
    { assessmentCode: "ASM020", domainName: "Compliance", questionNo: "CO-03", questionTitle: "PCI DSS Compliance", logMessage: "PCI DSS Level 1 compliance verified", documentName: "CrowdStrike_PCI_Cert.pdf" },
  ];

  let logCount = 0;
  for (const log of logs) {
    const { assessmentCode, ...rest } = log;
    const assessmentId = asmMap[assessmentCode];
    if (assessmentId) {
      await prisma.tPRMAssessmentLog.create({
        data: { customerAccountId: caId, assessmentId, ...rest },
      });
      logCount++;
    }
  }
  console.log(`✅ TPRM Assessment Logs: ${logCount}`);

  // ==================== QUESTIONNAIRE DATA (SIG-style) ====================

  // Domains
  const domainNames = [
    "B. Nth Party Management",
    "C. Information Assurance",
    "D. Asset and Information Management",
    "E. Human Resources Security",
    "F. Physical and Environmental Security",
    "G. IT Operations Management",
    "H. Access Control",
    "I. Application Management",
    "J. Cybersecurity Incident Management",
    "K. Operational Resilience",
    "L. Compliance Management",
    "M. Endpoint Security",
    "N. Network Security",
    "O. Environmental, Social, and Governance (ESG)",
    "P. Privacy Management",
    "R. Artificial Intelligence",
    "S. Supply Chain Risk Management (SCRM)",
    "T. Threat Management",
    "U. Server Security",
    "V. Cloud Services",
  ];

  const domainMap: Record<string, string> = {};
  for (let i = 0; i < domainNames.length; i++) {
    const name = domainNames[i];
    const domain = await prisma.tPRMDomain.upsert({
      where: { customerAccountId_name: { customerAccountId: caId, name } },
      update: {},
      create: { customerAccountId: caId, name, sortOrder: i + 1 },
    });
    domainMap[name] = domain.id;
  }
  console.log(`✅ TPRM Domains: ${Object.keys(domainMap).length}`);

  // Master Questions (one per domain, matching VerifAI Template2)
  const questionsData = [
    { domain: "B. Nth Party Management", text: "Is there a third party risk management program that is reviewed and approved by management which includes 4th and Nth parties as part of the program?" },
    { domain: "C. Information Assurance", text: "Has the organization implemented and documented an information security program and policy that is communicated, monitored, maintained, continually improved, and approved by management?" },
    { domain: "D. Asset and Information Management", text: "Is there an asset management program approved by management, communicated to constituents and has an owner to maintain, review, and manage asset controls?" },
    { domain: "E. Human Resources Security", text: "Are Human Resources policies and procedures approved by management, communicated to constituents and have an owner to maintain and review?" },
    { domain: "F. Physical and Environmental Security", text: "Has management approved a physical security program that is communicated to all parties involved, with an assigned owner responsible for maintenance and review?" },
    { domain: "G. IT Operations Management", text: "Does the organization's executive leadership ensure Information Technology Operation's policies and procedures are established and aligned with organizational strategy, and communicated to the entire organization?" },
    { domain: "H. Access Control", text: "Has management approved an access control policy, communicated it to constituents, appointed an owner to maintain it, and reviewed it?" },
    { domain: "I. Application Management", text: "Are applications used to transmit, process, or store scoped data?" },
    { domain: "J. Cybersecurity Incident Management", text: "Has management approved and communicated a Cybersecurity Incident Management Program with a designated owner to maintain and review it?" },
    { domain: "K. Operational Resilience", text: "Has the organization established a Business Resilience Policy, designated an owner to maintain and review it, and communicated it?" },
    { domain: "L. Compliance Management", text: "Are there policies and procedures to ensure compliance with applicable legislative, regulatory, and contractual requirements?" },
    { domain: "M. Endpoint Security", text: "Do desktops, laptops, tablets, or smartphones transmit, process, or store scoped data?" },
    { domain: "N. Network Security", text: "Does the organization build and maintain a secure network and systems?" },
    { domain: "O. Environmental, Social, and Governance (ESG)", text: "Does the organization have and adhere to an environmental policy that sets out clear commitments and targets to improve the organization's footprint?" },
    { domain: "P. Privacy Management", text: "Is there collection, access, processing, disclosure, or retention of any classification of personal information or personal data of individuals on behalf of the client?" },
    { domain: "R. Artificial Intelligence", text: "Does the organization have a process to inform personnel of legal and regulatory considerations and requirements specific to its industry, sector, and business purpose, and the application context of the deployed AI system(s)?" },
    { domain: "S. Supply Chain Risk Management (SCRM)", text: "Does your organization have access control policies for suppliers, developers, and service providers that are passed down to sub-tier contractors?" },
    { domain: "T. Threat Management", text: "Is there a centrally managed Vulnerability Management Program and associated Policy that has been approved by management, communicated to appropriate constituents and an owner assigned to maintain and review the policy?" },
    { domain: "U. Server Security", text: "Are servers used for transmitting, processing, or storing scoped data?" },
    { domain: "V. Cloud Services", text: "Are Cloud Hosting services provided?" },
  ];

  const questionIds: string[] = [];
  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];
    const existing = await prisma.tPRMMasterQuestion.findFirst({
      where: { customerAccountId: caId, domainId: domainMap[q.domain], questionText: q.text },
    });
    if (existing) {
      questionIds.push(existing.id);
    } else {
      const created = await prisma.tPRMMasterQuestion.create({
        data: {
          customerAccountId: caId,
          domainId: domainMap[q.domain],
          questionText: q.text,
          sortOrder: i + 1,
          isParentQuestion: true,
        },
      });
      questionIds.push(created.id);
    }
  }
  console.log(`✅ TPRM Master Questions: ${questionIds.length}`);

  // Questionnaire Template (Template2 — SIG-style)
  const template = await prisma.tPRMQuestionnaireTemplate.upsert({
    where: { customerAccountId_templateName: { customerAccountId: caId, templateName: "SIG Assessment" } },
    update: {},
    create: {
      customerAccountId: caId,
      templateName: "SIG Assessment",
      frameworkName: "SIG Assessment",
      templateCategory: "Default",
    },
  });
  console.log(`✅ TPRM Questionnaire Template: ${template.templateName}`);

  // Link questions to template
  let linkCount = 0;
  for (let i = 0; i < questionIds.length; i++) {
    const existing = await prisma.tPRMQuestionnaireQuestion.findUnique({
      where: { templateId_questionId: { templateId: template.id, questionId: questionIds[i] } },
    });
    if (!existing) {
      await prisma.tPRMQuestionnaireQuestion.create({
        data: {
          customerAccountId: caId,
          templateId: template.id,
          questionId: questionIds[i],
          sortOrder: i + 1,
        },
      });
      linkCount++;
    }
  }
  console.log(`✅ TPRM Questionnaire Links: ${linkCount}`);

  console.log("🎉 TPRM seed complete!");
}

seedTPRM()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
