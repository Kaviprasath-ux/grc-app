import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword1 = await bcrypt.hash("1", 10);

  // Find the GRC Admin customer account
  const grcAdminAccount = await prisma.customerAccount.findFirst({
    where: { code: "GRC_ADMIN_001" },
  });
  if (!grcAdminAccount) {
    console.error("GRC Admin account not found. Run main seed first.");
    return;
  }
  const customerAccountId = grcAdminAccount.id;

  // Enable TPRM on GRC Admin account
  await prisma.customerAccount.update({
    where: { id: customerAccountId },
    data: { isTprmAdded: true },
  });
  console.log("TPRM enabled on GRC Admin account");

  // Create TPRM role users
  const tprmRoleUsers = [
    { userId: "TPRM-RM-001", userName: "remm", email: "remm@baarez.com", firstName: "Rajesh", lastName: "Kumar", fullName: "Rajesh Kumar", designation: "Relationship Manager", tprmRole: "Relationship Manager", roleName: "RelationshipManager" },
    { userId: "TPRM-BO-001", userName: "bowner", email: "bowner@baarez.com", firstName: "Priya", lastName: "Sharma", fullName: "Priya Sharma", designation: "Business Owner", tprmRole: "Business Owner", roleName: "BusinessOwner" },
    { userId: "TPRM-IT-001", userName: "itteam", email: "itteam@baarez.com", firstName: "Amit", lastName: "Patel", fullName: "Amit Patel", designation: "IT Security Lead", tprmRole: "Internal IT Team", roleName: "InternalITTeam" },
    { userId: "TPRM-ASR-001", userName: "assessor1", email: "assessor1@baarez.com", firstName: "Neha", lastName: "Gupta", fullName: "Neha Gupta", designation: "TPRM Assessor", tprmRole: "Assessor", roleName: "TPRMAssessor" },
  ];

  const tprmUserIds: Record<string, string> = {};
  for (const u of tprmRoleUsers) {
    const user = await prisma.user.upsert({
      where: { userId: u.userId },
      update: { password: hashedPassword1, customerAccountId, tprmRole: u.tprmRole },
      create: {
        userId: u.userId,
        userName: u.userName,
        email: u.email,
        password: hashedPassword1,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: u.fullName,
        designation: u.designation,
        role: "Contributor",
        function: "TPRM",
        tprmRole: u.tprmRole,
        isActive: true,
        isBlocked: false,
        customerAccountId,
      },
    });
    tprmUserIds[u.roleName] = user.id;

    const role = await prisma.role.upsert({
      where: { name: u.roleName },
      update: {},
      create: { name: u.roleName, description: `TPRM ${u.tprmRole} role`, isSystem: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  console.log("TPRM Role Users created (remm, bowner, itteam, assessor1 / password: 1)");

  // Find assessments
  const assessments = await prisma.tPRMAssessment.findMany({
    where: { customerAccountId },
    select: { id: true, assessmentCode: true },
  });
  const assessmentMap = new Map(assessments.map(a => [a.assessmentCode, a.id]));

  // ==================== ISSUE REMEDIATIONS ====================
  // Mix of statuses: Open/Assigned to BO (for BO Open tab), Closed/Submitted (for Closed tab), Rejected (for Rejected tab)
  const issueRemediations = [
    // ----- OPEN issues (BO can act on these) -----
    {
      issueCode: "ISS-001",
      assessmentCode: "ASM001",
      questionNo: "IS-01",
      questionText: "Does your organization enforce data encryption for all data at rest using industry-standard algorithms (e.g., AES-256)?",
      questionResponse: "No",
      domainName: "Information Security",
      severity: "High",
      issue: "Vendor does not enforce AES-256 encryption on all storage systems. Legacy databases remain unencrypted, exposing sensitive client data to unauthorized access.",
      risk: "Unencrypted data at rest can be exfiltrated if storage is compromised, leading to regulatory fines (GDPR, PCI-DSS) and reputational damage.",
      recommendation: "Mandate full-disk encryption with AES-256 across all storage tiers. Implement key management via HSM. Target completion within 90 days.",
      reassignComment: "BO please review and coordinate with the vendor for remediation timeline.",
      status: "Assigned to BO",
      dueDate: new Date("2026-04-15"),
      requestedDate: new Date("2026-03-01"),
      responseDate: new Date("2026-03-09"),
      artifactName: "Encryption_Gap_Analysis_Report.pdf",
      artifactUrl: "/uploads/tprm/Encryption_Gap_Analysis_Report.pdf",
    },
    {
      issueCode: "ISS-002",
      assessmentCode: "ASM001",
      questionNo: "IS-02",
      questionText: "Does the vendor implement multi-factor authentication (MFA) for all user access to critical systems?",
      questionResponse: "Partial",
      domainName: "Information Security",
      severity: "Critical",
      issue: "MFA is only enabled for admin accounts. Regular user accounts on production systems rely solely on passwords, increasing the risk of credential-based attacks.",
      risk: "Single-factor authentication on production systems creates a high-risk attack vector. Compromised credentials could lead to unauthorized data access and lateral movement.",
      recommendation: "Deploy MFA for all user accounts accessing production environments. Consider FIDO2/WebAuthn for phishing-resistant authentication.",
      reassignComment: "Critical finding - needs immediate attention from Business Owner.",
      status: "Assigned to BO",
      dueDate: new Date("2026-03-30"),
      requestedDate: new Date("2026-02-28"),
      responseDate: new Date("2026-03-09"),
      artifactName: "MFA_Assessment_Summary.pdf, Access_Control_Matrix.xlsx",
      artifactUrl: "/uploads/tprm/MFA_Assessment_Summary.pdf, /uploads/tprm/Access_Control_Matrix.xlsx",
    },
    {
      issueCode: "ISS-003",
      assessmentCode: "ASM002",
      questionNo: "CS-01",
      questionText: "Does the cloud service provider guarantee data residency within contracted geographic boundaries?",
      questionResponse: "Yes",
      domainName: "Cloud Security",
      severity: "Medium",
      issue: "While data residency is contractually guaranteed, monitoring and audit mechanisms to verify compliance are not automated. Manual checks are performed quarterly.",
      risk: "Without continuous monitoring, data could inadvertently be processed outside contracted regions during failover events, creating regulatory non-compliance.",
      recommendation: "Implement automated data residency monitoring using cloud-native tools (e.g., Azure Policy). Set up real-time alerts for cross-region data transfers.",
      reassignComment: "Please verify with Azure team about their monitoring capabilities.",
      status: "Open",
      dueDate: new Date("2026-05-01"),
      requestedDate: new Date("2026-03-05"),
      responseDate: new Date("2026-03-10"),
    },
    {
      issueCode: "ISS-004",
      assessmentCode: "ASM005",
      questionNo: "RM-01",
      questionText: "Has the vendor updated their risk register to reflect the current threat landscape including emerging AI-based threats?",
      questionResponse: "No",
      domainName: "Risk Management",
      severity: "High",
      issue: "IBM vendor risk register has not been updated since Q2 2025. It does not account for AI-driven threats, supply chain attacks, or zero-day exploit trends observed in H2 2025.",
      risk: "Outdated risk register may result in unmitigated threats. The organization may not be adequately prepared for emerging attack vectors targeting AI/ML pipelines.",
      recommendation: "Request immediate update of vendor risk register. Include AI threat modeling, supply chain risk assessment, and zero-day response procedures.",
      reassignComment: "Annual review flagged this. BO to follow up with IBM security team.",
      status: "Assigned to BO",
      dueDate: new Date("2026-04-01"),
      requestedDate: new Date("2026-03-08"),
      responseDate: new Date("2026-03-10"),
    },
    {
      issueCode: "ISS-005",
      assessmentCode: "ASM006",
      questionNo: "ERP-01",
      questionText: "Are user access reviews conducted at least quarterly with evidence of remediation for identified access violations?",
      questionResponse: "Partial",
      domainName: "ERP Security",
      severity: "Medium",
      issue: "SAP user access reviews are conducted quarterly, but remediation of identified violations takes an average of 45 days. Three privilege escalation findings from Q4 2025 remain unresolved.",
      risk: "Delayed remediation of access violations creates a window for privilege abuse. SOD conflicts may persist, increasing the risk of fraudulent transactions.",
      recommendation: "Enforce a 15-day SLA for remediation of access review findings. Implement automated SOD conflict detection and integrate with SAP GRC Access Control.",
      status: "Pending",
      dueDate: new Date("2026-04-20"),
      requestedDate: new Date("2026-03-02"),
      responseDate: new Date("2026-03-09"),
    },

    // ----- CLOSED issues (BO Closed tab) -----
    {
      issueCode: "ISS-006",
      assessmentCode: "ASM009",
      questionNo: "DB-01",
      questionText: "Is encryption at rest enabled for all database instances, including legacy and development environments?",
      questionResponse: "No",
      domainName: "Database Security",
      severity: "Critical",
      issue: "Oracle legacy database systems (versions 12c and earlier) do not have TDE enabled. Development environments contain production data copies without any encryption.",
      risk: "Unencrypted production data in development environments violates data protection regulations. Legacy systems are vulnerable to data exfiltration.",
      recommendation: "Enable TDE on all Oracle instances immediately. Mask or anonymize production data used in development.",
      reassignComment: "Database security is critical. BO confirmed vendor has completed remediation.",
      status: "Closed",
      dueDate: new Date("2026-03-25"),
      requestedDate: new Date("2026-02-20"),
      responseDate: new Date("2026-03-05"),
      artifactName: "Oracle_TDE_Implementation_Report.pdf",
      artifactUrl: "/uploads/tprm/Oracle_TDE_Implementation_Report.pdf",
    },
    {
      issueCode: "ISS-007",
      assessmentCode: "ASM002",
      questionNo: "CO-01",
      questionText: "Does the vendor maintain current SOC 2 Type II certification with no critical exceptions noted?",
      questionResponse: "Yes",
      domainName: "Compliance",
      severity: "High",
      issue: "SOC 2 Type II report is current but contains two exceptions related to change management notification delays.",
      risk: "SOC 2 exceptions, if not addressed, could escalate to material findings in future audits.",
      recommendation: "Request vendor remediation plan for the two SOC 2 exceptions. Monitor resolution progress in the next assessment cycle.",
      status: "Submitted",
      dueDate: new Date("2026-04-15"),
      requestedDate: new Date("2026-03-01"),
      responseDate: new Date("2026-03-08"),
    },

    // ----- REJECTED issues (BO Rejected tab) -----
    {
      issueCode: "ISS-008",
      assessmentCode: "ASM013",
      questionNo: "ERP-03",
      questionText: "Has custom ABAP code been reviewed for security vulnerabilities using static analysis tools?",
      questionResponse: "No",
      domainName: "ERP Security",
      severity: "High",
      issue: "Custom ABAP code deployed across 12 SAP modules has never been subjected to static code analysis.",
      risk: "Vulnerable custom code in production SAP systems could be exploited for data theft, privilege escalation, or system manipulation.",
      recommendation: "Conduct comprehensive ABAP code scan using SAP Code Vulnerability Analyzer or third-party tools.",
      status: "Rejected",
      dueDate: new Date("2026-04-10"),
      requestedDate: new Date("2026-03-05"),
      responseDate: new Date("2026-03-09"),
    },
    {
      issueCode: "ISS-009",
      assessmentCode: "ASM005",
      questionNo: "NS-01",
      questionText: "Does the vendor perform regular penetration testing on their network infrastructure at least annually?",
      questionResponse: "No",
      domainName: "Network Security",
      severity: "Medium",
      issue: "No penetration testing has been performed on the vendor's external-facing infrastructure in the past 18 months.",
      risk: "Unidentified vulnerabilities in network infrastructure may be exploited by threat actors for unauthorized access.",
      recommendation: "Mandate annual external penetration testing by a qualified third-party firm. Share results and remediation evidence.",
      status: "Rejected",
      dueDate: new Date("2026-04-30"),
      requestedDate: new Date("2026-03-07"),
      responseDate: new Date("2026-03-10"),
    },
    {
      issueCode: "ISS-010",
      assessmentCode: "ASM001",
      questionNo: "BC-01",
      questionText: "Does the vendor have a tested business continuity and disaster recovery plan covering critical services?",
      questionResponse: "Partial",
      domainName: "Business Continuity",
      severity: "Low",
      issue: "BCP/DR plan exists on paper but the last full test was conducted over 2 years ago. Recovery procedures are not validated.",
      risk: "Untested DR plans may fail during an actual incident, leading to extended service disruption.",
      recommendation: "Require the vendor to perform a full DR test within 60 days and provide evidence of successful recovery.",
      status: "Rejected",
      dueDate: new Date("2026-05-15"),
      requestedDate: new Date("2026-03-08"),
      responseDate: new Date("2026-03-10"),
    },
  ];

  // Clean up existing issue remediations for fresh seeding
  await prisma.tPRMRemediationComment.deleteMany({ where: { remediation: { customerAccountId } } });
  await prisma.tPRMIssueRemediation.deleteMany({ where: { customerAccountId } });
  console.log("Cleaned existing TPRM issue remediations");

  let created = 0;
  const remediationIds: Record<string, string> = {};
  for (const rem of issueRemediations) {
    const assessmentId = assessmentMap.get(rem.assessmentCode);
    if (!assessmentId) {
      console.warn(`Assessment ${rem.assessmentCode} not found, skipping ${rem.issueCode}`);
      continue;
    }

    const record = await prisma.tPRMIssueRemediation.create({
      data: {
        issueCode: rem.issueCode,
        customerAccountId,
        assessmentId,
        questionNo: rem.questionNo,
        questionText: rem.questionText,
        questionResponse: rem.questionResponse,
        domainName: rem.domainName,
        severity: rem.severity,
        issue: rem.issue,
        risk: rem.risk,
        recommendation: rem.recommendation,
        reassignComment: rem.reassignComment || null,
        status: rem.status,
        dueDate: rem.dueDate,
        requestedDate: rem.requestedDate,
        responseDate: rem.responseDate || null,
        artifactName: rem.artifactName || null,
        artifactUrl: rem.artifactUrl || null,
        assignedToUserId: tprmUserIds["BusinessOwner"],
        assignedAt: new Date(),
      },
    });
    remediationIds[rem.issueCode] = record.id;
    created++;
  }
  console.log(`TPRM Issue Remediations: ${created} issues created`);

  // ==================== REMEDIATION COMMENTS ====================
  const comments = [
    // ISS-001 comments
    { issueCode: "ISS-001", userId: tprmUserIds["TPRMAssessor"], userRole: "Assessor", message: "Assessor flagged this as high priority. AES-256 encryption gap confirmed across 3 storage tiers." },
    { issueCode: "ISS-001", userId: tprmUserIds["RelationshipManager"], userRole: "Relationship Manager", message: "Contacted vendor security team. They acknowledged the gap and are preparing a remediation timeline." },
    { issueCode: "ISS-001", userId: tprmUserIds["BusinessOwner"], userRole: "Business Owner", message: "BO reviewed. Vendor must provide remediation plan by March 20. Escalating to procurement if no response." },

    // ISS-002 comments
    { issueCode: "ISS-002", userId: tprmUserIds["TPRMAssessor"], userRole: "Assessor", message: "Critical finding: only admin accounts have MFA. 200+ regular users on production without MFA." },
    { issueCode: "ISS-002", userId: tprmUserIds["BusinessOwner"], userRole: "Business Owner", message: "This is unacceptable for production systems. Requesting vendor to deploy MFA within 30 days or face contract review." },

    // ISS-004 comments
    { issueCode: "ISS-004", userId: tprmUserIds["TPRMAssessor"], userRole: "Assessor", message: "IBM risk register review completed. Missing AI threat vectors and supply chain risk categories." },
    { issueCode: "ISS-004", userId: tprmUserIds["RelationshipManager"], userRole: "Relationship Manager", message: "RM scheduled a call with IBM security team for March 15 to discuss risk register update." },

    // ISS-006 (closed) comments
    { issueCode: "ISS-006", userId: tprmUserIds["TPRMAssessor"], userRole: "Assessor", message: "Verified: TDE has been enabled on all Oracle instances. Development data masking confirmed." },
    { issueCode: "ISS-006", userId: tprmUserIds["BusinessOwner"], userRole: "Business Owner", message: "Confirmed remediation complete. Closing this issue." },

    // ISS-008 (rejected) comments
    { issueCode: "ISS-008", userId: tprmUserIds["TPRMAssessor"], userRole: "Assessor", message: "Vendor claims ABAP code review is not feasible within the proposed timeline." },
    { issueCode: "ISS-008", userId: tprmUserIds["BusinessOwner"], userRole: "Business Owner", message: "Rejected - vendor must provide alternative timeline. Code scan cannot be waived." },
  ];

  for (const c of comments) {
    const remId = remediationIds[c.issueCode];
    if (!remId) continue;
    await prisma.tPRMRemediationComment.create({
      data: {
        remediationId: remId,
        userId: c.userId,
        userRole: c.userRole,
        message: c.message,
      },
    });
  }
  console.log(`TPRM Remediation Comments: ${comments.length} comments created`);

  // ==================== VENDOR ISSUES ====================
  // Find vendors
  const vendors = await prisma.tPRMVendor.findMany({
    where: { customerAccountId },
    select: { id: true, name: true },
    take: 5,
  });

  if (vendors.length > 0) {
    // Clean existing vendor issues
    await prisma.tPRMVendorIssue.deleteMany({ where: { customerAccountId } });

    const vendorIssues = [
      {
        vendorId: vendors[0]?.id,
        title: "SLA Breach - Response Time",
        description: "Vendor has breached the agreed SLA for incident response time. Average response time is 6 hours vs contracted 2 hours for P1 incidents.",
        severity: "High",
        dueDate: new Date("2026-04-01"),
        resolution: null,
        status: "Open",
      },
      {
        vendorId: vendors[0]?.id,
        title: "Data Processing Agreement Update Required",
        description: "Current DPA does not cover new data processing activities introduced in Q1 2026. GDPR compliance requires updated agreement.",
        severity: "Medium",
        dueDate: new Date("2026-04-15"),
        resolution: null,
        status: "Open",
      },
      {
        vendorId: vendors[1]?.id || vendors[0]?.id,
        title: "Certificate Expiry - SSL/TLS",
        description: "Vendor's SSL certificate for API endpoint expires in 15 days. No renewal plan communicated.",
        severity: "High",
        dueDate: new Date("2026-03-25"),
        resolution: null,
        status: "Submitted",
      },
      {
        vendorId: vendors[1]?.id || vendors[0]?.id,
        title: "Subcontractor Compliance Gap",
        description: "Vendor's subcontractor for data hosting does not meet ISO 27001 certification requirement specified in the contract.",
        severity: "Medium",
        dueDate: new Date("2026-05-01"),
        resolution: "Vendor has initiated subcontractor audit process. Expected completion by April 20, 2026.",
        status: "Submitted",
      },
      {
        vendorId: vendors[0]?.id,
        title: "Security Incident - Unauthorized Access Attempt",
        description: "Detected unauthorized access attempt to vendor's staging environment which hosts our test data. Vendor confirmed no data was compromised.",
        severity: "High",
        dueDate: new Date("2026-03-15"),
        resolution: "Vendor completed root cause analysis. Access controls strengthened. Firewall rules updated. Incident report shared.",
        status: "Closed",
      },
      {
        vendorId: vendors[2]?.id || vendors[0]?.id,
        title: "Annual Penetration Test Results",
        description: "Vendor's annual penetration test revealed 2 medium and 1 low vulnerability. Remediation evidence pending.",
        severity: "Low",
        dueDate: new Date("2026-04-30"),
        resolution: "All vulnerabilities remediated. Retest report attached confirming closure.",
        status: "Closed",
      },
    ];

    for (const vi of vendorIssues) {
      await prisma.tPRMVendorIssue.create({
        data: {
          customerAccountId,
          vendorId: vi.vendorId,
          title: vi.title,
          description: vi.description,
          severity: vi.severity,
          dueDate: vi.dueDate,
          resolution: vi.resolution,
          status: vi.status,
          reportedById: tprmUserIds["RelationshipManager"],
        },
      });
    }
    console.log(`TPRM Vendor Issues: ${vendorIssues.length} vendor issues created`);
  } else {
    console.warn("No TPRM vendors found. Skipping vendor issues.");
  }

  console.log("\nDone! Login as:");
  console.log("  - 'bowner' / '1' for Business Owner Issue Management");
  console.log("  - 'remm' / '1' for Relationship Manager Issue Management");
  console.log("  - 'itteam' / '1' for IT Team Issue Management");
  console.log("  - 'assessor1' / '1' for Assessor Issue Register");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
