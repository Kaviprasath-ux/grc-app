/**
 * Seed Internal Audit Workflow Data
 *
 * This script creates complete Internal Audit workflow data:
 * - Audit Universe (AuditableEntity)
 * - Audit Engagements (with Completed status for CAPA tracking)
 * - Audit Fieldwork
 * - Findings (for CAPA tracking)
 * - Evidence Requests
 *
 * Usage: npx tsx prisma/seed-internal-audit.ts
 *
 * Prerequisites:
 * - Run main seed.ts first (for customer account, roles)
 * - Run seed-customer-bts.ts (for BTS users including auditees)
 * - Run seed-audit-settings.ts (for audit settings)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Seeding Internal Audit Workflow Data...\n');

  // ==================== GET REQUIRED DATA ====================
  console.log('📋 Fetching required data...');

  // Get customer account
  const customerAccount = await prisma.customerAccount.findUnique({
    where: { code: 'GRC_001' },
  });

  if (!customerAccount) {
    console.error('❌ Customer Account GRC_001 not found. Run seed.ts first.');
    return;
  }
  const customerAccountId = customerAccount.id;
  console.log(`  ✓ Customer Account: ${customerAccount.name}`);

  // Get Audit Head user (david.audit from BTS seed)
  const auditHead = await prisma.user.findFirst({
    where: {
      userName: 'david.audit',
    },
  });

  if (!auditHead) {
    console.error('❌ Audit Head (david.audit) not found. Run seed-customer-bts.ts first.');
    return;
  }
  console.log(`  ✓ Audit Head: ${auditHead.firstName} ${auditHead.lastName}`);

  // Get Auditee users
  const auditeeHR = await prisma.user.findFirst({
    where: { userName: 'iris.hr' },
  });
  const auditeeFinance = await prisma.user.findFirst({
    where: { userName: 'jack.finance' },
  });

  if (!auditeeHR || !auditeeFinance) {
    console.error('❌ Auditee users not found. Run seed-customer-bts.ts first.');
    return;
  }
  console.log(`  ✓ Auditee (HR): ${auditeeHR.firstName} ${auditeeHR.lastName}`);
  console.log(`  ✓ Auditee (Finance): ${auditeeFinance.firstName} ${auditeeFinance.lastName}`);

  // Get departments
  const departments = await prisma.department.findMany({
    where: { customerAccountId },
  });

  if (departments.length === 0) {
    console.error('❌ No departments found. Run seed-customer-bts.ts first.');
    return;
  }
  console.log(`  ✓ Departments: ${departments.length} found`);

  const deptMap: Record<string, string> = {};
  for (const dept of departments) {
    deptMap[dept.name] = dept.id;
  }

  // ==================== CREATE AUDIT UNIVERSE ====================
  console.log('\n🌐 Creating Audit Universe (Auditable Entities)...');

  const auditableEntities = [
    { code: 'AE-HR-001', name: 'HR Payroll Processing', department: 'Human Resources', description: 'Monthly payroll processing and disbursement' },
    { code: 'AE-HR-002', name: 'Employee Onboarding', department: 'Human Resources', description: 'New employee onboarding procedures' },
    { code: 'AE-FIN-001', name: 'Accounts Payable', department: 'Finance', description: 'Vendor payment processing and controls' },
    { code: 'AE-FIN-002', name: 'Financial Reporting', department: 'Finance', description: 'Quarterly and annual financial reporting' },
    { code: 'AE-IT-001', name: 'Access Management', department: 'Information Technology', description: 'User access provisioning and deprovisioning' },
    { code: 'AE-IT-002', name: 'Change Management', department: 'Information Technology', description: 'IT change management process' },
    { code: 'AE-SEC-001', name: 'Incident Response', department: 'Information Security', description: 'Security incident response procedures' },
    { code: 'AE-OPS-001', name: 'Vendor Management', department: 'Operations', description: 'Third-party vendor management' },
  ];

  const createdEntities: Record<string, string> = {};

  for (const entity of auditableEntities) {
    const deptId = deptMap[entity.department];
    if (!deptId) continue;

    const created = await prisma.auditableEntity.upsert({
      where: {
        customerAccountId_entityCode: {
          customerAccountId,
          entityCode: entity.code,
        },
      },
      update: {
        name: entity.name,
        description: entity.description,
        departmentId: deptId,
      },
      create: {
        customerAccountId,
        entityCode: entity.code,
        name: entity.name,
        description: entity.description,
        departmentId: deptId,
        riskRating: 'Medium',
        status: 'Active',
      },
    });
    createdEntities[entity.code] = created.id;
  }
  console.log(`  ✓ Created ${Object.keys(createdEntities).length} auditable entities`);

  // ==================== CREATE AUDIT ENGAGEMENTS ====================
  console.log('\n📅 Creating Audit Engagements...');

  const engagements = [
    {
      auditId: 'AUD-2026-001',
      title: 'HR Payroll Audit Q1 2026',
      objective: 'Assess payroll processing controls and compliance with labor regulations',
      scope: 'Payroll processing, tax withholdings, employee benefits administration',
      department: 'Human Resources',
      entityCode: 'AE-HR-001',
      auditee: auditeeHR,
      status: 'Completed',
      auditType: 'Compliance',
      priority: 'High',
    },
    {
      auditId: 'AUD-2026-002',
      title: 'Accounts Payable Audit Q1 2026',
      objective: 'Review accounts payable controls and vendor payment processes',
      scope: 'Invoice processing, payment approvals, vendor master data',
      department: 'Finance',
      entityCode: 'AE-FIN-001',
      auditee: auditeeFinance,
      status: 'Completed',
      auditType: 'Financial',
      priority: 'High',
    },
    {
      auditId: 'AUD-2026-003',
      title: 'IT Access Management Audit',
      objective: 'Evaluate user access controls and segregation of duties',
      scope: 'User provisioning, access reviews, privileged access management',
      department: 'Information Technology',
      entityCode: 'AE-IT-001',
      auditee: auditeeHR, // IT audit but HR manages access
      status: 'Completed',
      auditType: 'IT Audit',
      priority: 'Medium',
    },
    {
      auditId: 'AUD-2026-004',
      title: 'Financial Reporting Controls Audit',
      objective: 'Assess internal controls over financial reporting',
      scope: 'Journal entries, reconciliations, period-end close procedures',
      department: 'Finance',
      entityCode: 'AE-FIN-002',
      auditee: auditeeFinance,
      status: 'Completed',
      auditType: 'Financial',
      priority: 'High',
    },
    {
      auditId: 'AUD-2026-005',
      title: 'Employee Onboarding Process Audit',
      objective: 'Review employee onboarding procedures and compliance',
      scope: 'Documentation, background checks, training completion',
      department: 'Human Resources',
      entityCode: 'AE-HR-002',
      auditee: auditeeHR,
      status: 'In Progress',
      auditType: 'Operational',
      priority: 'Medium',
    },
  ];

  const createdEngagements: Record<string, string> = {};

  for (const eng of engagements) {
    const deptId = deptMap[eng.department];
    const entityId = createdEntities[eng.entityCode];

    const created = await prisma.auditEngagement.upsert({
      where: {
        customerAccountId_auditId: {
          customerAccountId,
          auditId: eng.auditId,
        },
      },
      update: {
        engagementTitle: eng.title,
        engagementObjective: eng.objective,
        engagementScope: eng.scope,
        status: eng.status,
      },
      create: {
        customerAccountId,
        auditHeadId: auditHead.id,
        auditId: eng.auditId,
        engagementTitle: eng.title,
        engagementObjective: eng.objective,
        engagementScope: eng.scope,
        departmentId: deptId,
        auditableEntityId: entityId,
        auditType: eng.auditType,
        auditeeId: eng.auditee.id,
        status: eng.status,
        priority: eng.priority,
        year: 2026,
        quarter: 'Q1',
        plannedStartDate: new Date('2026-01-15'),
        plannedEndDate: new Date('2026-02-28'),
        actualStartDate: new Date('2026-01-15'),
        actualEndDate: eng.status === 'Completed' ? new Date('2026-02-20') : null,
        plannedHours: 40,
        actualHours: eng.status === 'Completed' ? 38 : 20,
      },
    });
    createdEngagements[eng.auditId] = created.id;

    // Create fieldwork for each engagement
    await prisma.auditFieldwork.upsert({
      where: { engagementId: created.id },
      update: {
        status: eng.status === 'Completed' ? 'Completed' : 'In Progress',
      },
      create: {
        engagementId: created.id,
        startDate: new Date('2026-01-20'),
        targetDate: new Date('2026-02-15'),
        completionDate: eng.status === 'Completed' ? new Date('2026-02-18') : null,
        status: eng.status === 'Completed' ? 'Completed' : 'In Progress',
        scope: eng.scope,
        objectives: eng.objective,
        methodology: 'Risk-based audit approach with sampling and substantive testing',
        hoursSpent: eng.status === 'Completed' ? 35 : 15,
      },
    });
  }
  console.log(`  ✓ Created ${Object.keys(createdEngagements).length} audit engagements with fieldwork`);

  // ==================== CREATE FINDINGS (FOR CAPA TRACKING) ====================
  console.log('\n⚠️  Creating Audit Findings (for CAPA Tracking)...');

  const findings = [
    // HR Payroll Audit findings
    {
      findingId: 'FND-2026-001',
      engagementId: 'AUD-2026-001',
      finding: 'Inadequate Segregation of Duties in Payroll Processing',
      description: 'The same individual can both process payroll changes and approve payments',
      severity: 'High',
      department: 'Human Resources',
      responsiblePerson: `${auditeeHR.firstName} ${auditeeHR.lastName}`,
      responsiblePersonId: auditeeHR.id,
      criteria: 'Payroll processing should have segregation of duties with different individuals for data entry and approval',
      condition: 'Single payroll administrator can make changes and process payments without secondary approval',
      cause: 'Staff shortage and lack of formal policy requiring segregation',
      effect: 'Increased risk of payroll fraud and unauthorized payments',
      recommendation: 'Implement dual control for payroll processing with mandatory secondary approval',
      status: 'Open',
      targetDate: new Date('2026-03-31'),
    },
    {
      findingId: 'FND-2026-002',
      engagementId: 'AUD-2026-001',
      finding: 'Missing Documentation for Overtime Approvals',
      description: 'Overtime payments lack documented supervisor approval in 30% of sampled cases',
      severity: 'Medium',
      department: 'Human Resources',
      responsiblePerson: `${auditeeHR.firstName} ${auditeeHR.lastName}`,
      responsiblePersonId: auditeeHR.id,
      criteria: 'All overtime must be pre-approved by supervisors before payment',
      condition: 'Overtime approved verbally without documented evidence',
      cause: 'Informal approval process and lack of enforcement',
      effect: 'Potential for unauthorized overtime payments and budget overruns',
      recommendation: 'Implement electronic overtime approval workflow with audit trail',
      status: 'Under Review',
      targetDate: new Date('2026-03-15'),
    },
    // Accounts Payable Audit findings
    {
      findingId: 'FND-2026-003',
      engagementId: 'AUD-2026-002',
      finding: 'Duplicate Invoice Payments Detected',
      description: 'Three instances of duplicate payments to vendors totaling $15,000 were identified',
      severity: 'High',
      department: 'Finance',
      responsiblePerson: `${auditeeFinance.firstName} ${auditeeFinance.lastName}`,
      responsiblePersonId: auditeeFinance.id,
      criteria: 'Invoice processing controls should prevent duplicate payments',
      condition: 'System allows processing of invoices with same vendor and amount without warning',
      cause: 'Lack of duplicate detection controls in AP system',
      effect: 'Financial loss due to overpayments, manual recovery efforts required',
      recommendation: 'Implement automated duplicate invoice detection with blocking controls',
      status: 'Open',
      targetDate: new Date('2026-04-15'),
    },
    {
      findingId: 'FND-2026-004',
      engagementId: 'AUD-2026-002',
      finding: 'Vendor Master Data Maintenance Gaps',
      description: 'Vendor bank account changes lack proper verification procedures',
      severity: 'Critical',
      department: 'Finance',
      responsiblePerson: `${auditeeFinance.firstName} ${auditeeFinance.lastName}`,
      responsiblePersonId: auditeeFinance.id,
      criteria: 'Bank account changes require callback verification to known vendor contact',
      condition: 'Changes processed based on email requests without verbal confirmation',
      cause: 'Inadequate vendor verification policy and training',
      effect: 'High risk of business email compromise fraud',
      recommendation: 'Implement mandatory callback verification for all bank account changes',
      status: 'Open',
      targetDate: new Date('2026-03-01'),
    },
    // IT Access Management findings
    {
      findingId: 'FND-2026-005',
      engagementId: 'AUD-2026-003',
      finding: 'Terminated Employee Access Not Revoked Timely',
      description: 'Access for 5 terminated employees remained active for over 30 days post-termination',
      severity: 'High',
      department: 'Information Technology',
      responsiblePerson: `${auditeeHR.firstName} ${auditeeHR.lastName}`,
      responsiblePersonId: auditeeHR.id,
      criteria: 'Access should be revoked within 24 hours of employment termination',
      condition: 'Average time to revoke access was 45 days',
      cause: 'Manual process dependent on HR notification, no automated integration',
      effect: 'Potential unauthorized access to systems and data by former employees',
      recommendation: 'Implement automated access revocation integrated with HR termination process',
      status: 'In Progress',
      targetDate: new Date('2026-02-28'),
    },
    // Financial Reporting findings
    {
      findingId: 'FND-2026-006',
      engagementId: 'AUD-2026-004',
      finding: 'Bank Reconciliation Delays',
      description: 'Monthly bank reconciliations completed 15-20 days after month-end',
      severity: 'Medium',
      department: 'Finance',
      responsiblePerson: `${auditeeFinance.firstName} ${auditeeFinance.lastName}`,
      responsiblePersonId: auditeeFinance.id,
      criteria: 'Bank reconciliations should be completed within 5 business days of month-end',
      condition: 'Reconciliations consistently completed 3-4 weeks after month-end',
      cause: 'Manual reconciliation process and resource constraints',
      effect: 'Delayed detection of errors and potential fraud',
      recommendation: 'Implement automated bank reconciliation tool with daily matching',
      status: 'Open',
      targetDate: new Date('2026-04-30'),
    },
  ];

  for (const finding of findings) {
    const engId = createdEngagements[finding.engagementId];
    const deptId = deptMap[finding.department];

    if (!engId) continue;

    await prisma.internalAuditFinding.upsert({
      where: {
        customerAccountId_findingId: {
          customerAccountId,
          findingId: finding.findingId,
        },
      },
      update: {
        finding: finding.finding,
        description: finding.description,
        status: finding.status,
      },
      create: {
        customerAccountId,
        auditHeadId: auditHead.id,
        findingId: finding.findingId,
        engagementId: engId,
        finding: finding.finding,
        description: finding.description,
        severity: finding.severity,
        departmentId: deptId,
        responsiblePerson: finding.responsiblePerson,
        responsiblePersonId: finding.responsiblePersonId,
        criteria: finding.criteria,
        condition: finding.condition,
        cause: finding.cause,
        effect: finding.effect,
        recommendation: finding.recommendation,
        status: finding.status,
        targetDate: finding.targetDate,
        identifiedDate: new Date('2026-02-01'),
      },
    });
  }
  console.log(`  ✓ Created ${findings.length} audit findings`);

  // ==================== CREATE EVIDENCE REQUESTS ====================
  console.log('\n📎 Creating Evidence Requests...');

  const evidenceRequests = [
    {
      engagementId: 'AUD-2026-001',
      title: 'Payroll Register for January 2026',
      description: 'Complete payroll register showing all payments made in January',
      sampleSize: '3',
      status: 'Submitted',
      category: 'evidence-request',
      auditee: auditeeHR,
    },
    {
      engagementId: 'AUD-2026-001',
      title: 'Overtime Approval Forms',
      description: 'Sample of overtime approval forms for the audit period',
      sampleSize: '10',
      status: 'Pending',
      category: 'evidence-request',
      auditee: auditeeHR,
    },
    {
      engagementId: 'AUD-2026-002',
      title: 'Vendor Master List',
      description: 'Current list of all active vendors with bank details',
      sampleSize: null,
      status: 'Submitted',
      category: 'evidence-request',
      auditee: auditeeFinance,
    },
    {
      engagementId: 'AUD-2026-002',
      title: 'Invoice Processing Samples',
      description: 'Sample invoices with full approval trail',
      sampleSize: '15',
      status: 'Pending',
      category: 'evidence-request',
      auditee: auditeeFinance,
    },
    {
      engagementId: 'AUD-2026-003',
      title: 'User Access Review Report',
      description: 'Quarterly user access review documentation',
      sampleSize: null,
      status: 'Reviewed',
      category: 'evidence-request',
      auditee: auditeeHR,
    },
    {
      engagementId: 'AUD-2026-004',
      title: 'Bank Reconciliation Statements',
      description: 'Monthly bank reconciliation for Q4 2025',
      sampleSize: '3',
      status: 'Submitted',
      category: 'evidence-request',
      auditee: auditeeFinance,
    },
  ];

  let evidenceCount = 0;
  let attachmentCount = 0;
  const createdEvidenceRequests: Array<{ id: string; status: string; title: string }> = [];

  for (const req of evidenceRequests) {
    const engId = createdEngagements[req.engagementId];
    if (!engId) continue;

    const created = await prisma.fieldworkEvidenceRequest.create({
      data: {
        engagementId: engId,
        title: req.title,
        description: req.description,
        sampleSize: req.sampleSize,
        status: req.status,
        category: req.category,
        auditeeId: req.auditee.id,
        auditeeName: `${req.auditee.firstName} ${req.auditee.lastName}`,
        dueDate: new Date('2026-02-15'),
      },
    });
    createdEvidenceRequests.push({ id: created.id, status: req.status, title: req.title });
    evidenceCount++;
  }
  console.log(`  ✓ Created ${evidenceCount} evidence requests`);

  // ==================== CREATE SAMPLE ATTACHMENTS ====================
  console.log('\n📄 Creating Sample Attachments for Evidence Requests...');

  // Sample attachment data for different evidence types
  const sampleAttachments: Record<string, Array<{ fileName: string; fileType: string; fileSize: number }>> = {
    'Payroll Register for January 2026': [
      { fileName: 'Payroll_Register_Jan2026.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 245760 },
      { fileName: 'Payroll_Summary_Jan2026.pdf', fileType: 'application/pdf', fileSize: 125000 },
    ],
    'Vendor Master List': [
      { fileName: 'Vendor_Master_List_2026.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 189440 },
      { fileName: 'Vendor_Bank_Details.pdf', fileType: 'application/pdf', fileSize: 98304 },
    ],
    'User Access Review Report': [
      { fileName: 'Q4_2025_Access_Review.pdf', fileType: 'application/pdf', fileSize: 512000 },
      { fileName: 'Access_Review_Evidence_Screenshots.zip', fileType: 'application/zip', fileSize: 2048000 },
      { fileName: 'User_Access_Matrix.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 156000 },
    ],
    'Bank Reconciliation Statements': [
      { fileName: 'Bank_Recon_Oct2025.pdf', fileType: 'application/pdf', fileSize: 89000 },
      { fileName: 'Bank_Recon_Nov2025.pdf', fileType: 'application/pdf', fileSize: 92000 },
      { fileName: 'Bank_Recon_Dec2025.pdf', fileType: 'application/pdf', fileSize: 95000 },
    ],
  };

  // Add attachments to evidence requests that are Submitted or Reviewed
  for (const evReq of createdEvidenceRequests) {
    if (evReq.status === 'Submitted' || evReq.status === 'Reviewed') {
      const attachments = sampleAttachments[evReq.title];
      if (attachments) {
        for (const att of attachments) {
          await prisma.fieldworkEvidenceAttachment.create({
            data: {
              evidenceRequestId: evReq.id,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              filePath: `/uploads/internal-audit/evidence/${evReq.id}/${att.fileName}`,
              uploadedBy: 'Seeded Data',
            },
          });
          attachmentCount++;
        }
      }
    }
  }
  console.log(`  ✓ Created ${attachmentCount} sample attachments`);

  // ==================== SUMMARY ====================
  console.log('\n' + '='.repeat(60));
  console.log('✅ Internal Audit Workflow Data Seeded Successfully!');
  console.log('='.repeat(60));
  console.log(`
📊 Summary:
   • Auditable Entities: ${Object.keys(createdEntities).length}
   • Audit Engagements: ${Object.keys(createdEngagements).length}
   • Audit Findings: ${findings.length}
   • Evidence Requests: ${evidenceCount}
   • Evidence Attachments: ${attachmentCount}

👤 Test Accounts:
   • Audit Head: david.audit / 1
   • Auditee (HR): iris.hr / 1
   • Auditee (Finance): jack.finance / 1

📝 CAPA Tracking:
   • ${findings.filter(f => f.status === 'Open').length} Open findings
   • ${findings.filter(f => f.status === 'Under Review').length} Under Review findings
   • ${findings.filter(f => f.status === 'In Progress').length} In Progress findings

📎 AI Review Ready:
   • Evidence requests with attachments can now be reviewed by AI
`);
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
