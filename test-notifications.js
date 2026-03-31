const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const caId = 'cmm4kx7aa00021pueirmdw3fy';
const boId = 'cmmbkgx5s0003bdejmfqnh34d';
const asId = 'cmm4mx5jg0003po25y3z2y5x9';
const apId = 'cmmeo971h001xz63stwn9krq6';
const rmId = 'cmmbkgcb40001bdejce3txpe4';
const itId = 'cmmj0l09x0001nl2edjw0nmn7';
const amCamId = 'cmmc6hmpq000345achrbe3ed6';
const amStId = 'cmmety34q002oz63smwsdx5vw';
const admId = 'cmm4kx7ae00041puezm43ycgg';
const smeId = 'cmmfynjwh000xe8h97zn35kty';

async function main() {
  const results = [];

  async function n(event, title, message, recipientId, priority) {
    const rec = await prisma.notification.create({
      data: {
        customerAccountId: caId,
        userId: recipientId,
        type: event,
        title,
        message,
        priority: priority || 'normal',
      },
    });
    results.push({ event, title, recipientId });
    return rec;
  }

  // #1 TPRM Account Created
  await n('TPRM_ACCOUNT_CREATED', 'TPRM account created', 'Your TPRM account has been created with role: Account Manager.', amCamId);
  // #2 RM Account Created
  await n('TPRM_RM_ACCOUNT_CREATED', 'Relationship Manager account created', 'A new Relationship Manager account has been created for Rel Mang (rm@tadm.co).', boId);
  // #3 SME Account Created
  await n('TPRM_ACCOUNT_CREATED', 'TPRM account created', 'Your TPRM account has been created with role: SME.', smeId);
  // #4 Vendor Onboarded
  await n('TPRM_VENDOR_ONBOARDED', 'Vendor access provisioned', 'Vendor VEN001: Cred has been onboarded.', amCamId);
  // #5 Vendor Offboarding
  await n('TPRM_VENDOR_OFFBOARDING', 'Vendor offboarding initiated', 'Vendor offboarding process has started for VEN006: Hotstar.', amStId, 'high');
  // #6 Assessment Initiated
  await n('TPRM_ASSESSMENT_INITIATED', 'Assessment initiated', 'A new assessment ASM012 has been initiated for vendor Cred.', amCamId);
  // #7 Assessment Assigned
  await n('TPRM_ASSESSMENT_ASSIGNED', 'Assessment assigned to you', 'Assessment ASM012 for vendor Cred has been assigned to you.', asId);
  // #8 Assessment Reassigned
  await n('TPRM_ASSESSMENT_REASSIGNED', 'Assessment reassigned', 'Assessment ASM005 has been reassigned to Factory Assessor.', asId);
  // #9 Assessment Submitted (to assessor)
  await n('TPRM_ASSESSMENT_SUBMITTED', 'Assessment submitted for review', 'Assessment ASM012 for vendor Cred has been submitted for your review.', asId);
  // #10 Assessment Sent to Approver
  await n('TPRM_ASSESSMENT_SENT_TO_APPROVER', 'Assessment awaiting your approval', 'Assessment ASM012 for vendor Cred is ready for your approval.', apId, 'high');
  // #11 Assessment Completed (Reviewed)
  await n('TPRM_ASSESSMENT_COMPLETED', 'Assessment reviewed', 'Assessment ASM012 for vendor Cred has been reviewed.', boId);
  // #12 Assessment Approved
  await n('TPRM_ASSESSMENT_APPROVED', 'Assessment approved', 'Assessment ASM012 for vendor Cred has been approved.', boId);
  await n('TPRM_ASSESSMENT_APPROVED', 'Assessment approved', 'Assessment ASM012 for vendor Cred has been approved.', amCamId);
  await n('TPRM_ASSESSMENT_APPROVED', 'Assessment approved', 'Assessment ASM012 for vendor Cred has been approved.', asId);
  // #13 Assessment Returned (by Assessor)
  await n('TPRM_ASSESSMENT_RETURNED', 'Assessment returned', 'Assessment ASM012 for vendor Cred has been returned: Missing documents.', boId, 'high');
  await n('TPRM_ASSESSMENT_RETURNED', 'Assessment returned', 'Assessment ASM012 for vendor Cred has been returned: Missing documents.', amCamId, 'high');
  // #14 Assessment Returned (by Approver)
  await n('TPRM_ASSESSMENT_RETURNED', 'Assessment returned', 'Assessment ASM012 for vendor Cred returned by approver: Needs more detail.', asId, 'high');
  // #15 Clarification Requested
  await n('TPRM_CLARIFICATION_REQUESTED', 'Clarification requested', 'Assessor has requested clarification on assessment ASM012: Please provide more evidence.', amCamId);
  // #16 Clarification Responded (NEW)
  await n('TPRM_CLARIFICATION_RESPONDED', 'Clarification response received', 'Account Manager has responded to your clarification on assessment ASM012 for vendor Cred.', asId);
  // #17 Comment Added
  await n('TPRM_COMMENT_ADDED', 'New comment on assessment', 'New comment on assessment ASM012: Looks good, proceed with review.', asId);
  await n('TPRM_COMMENT_ADDED', 'New comment on assessment', 'New comment on assessment ASM012: Looks good, proceed with review.', boId);
  // #18 Override Applied
  await n('TPRM_OVERRIDE_APPLIED', 'Assessment override applied', 'Assessor overrode AI evaluation on assessment ASM012: Unsatisfactory', boId);
  // #19 Remediation Created
  await n('TPRM_REMEDIATION_CREATED', 'Remediation items created', '5 remediation item(s) have been created for assessment ASM012 (vendor: Cred).', amCamId, 'high');
  await n('TPRM_REMEDIATION_CREATED', 'Remediation items created', '5 remediation item(s) have been created for assessment ASM012 (vendor: Cred).', boId, 'high');
  // #20 Remediation Submitted (AM Response)
  await n('TPRM_REMEDIATION_SUBMITTED', 'Remediation response submitted', 'Remediation response submitted for Cred: Security configuration issue.', asId);
  await n('TPRM_REMEDIATION_SUBMITTED', 'Remediation response submitted', 'Remediation response submitted for Cred: Security configuration issue.', boId);
  // #21 Remediation Satisfied
  await n('TPRM_REMEDIATION_SATISFIED', 'Remediation marked satisfactory', 'Remediation for Cred - Security config has been marked as Satisfactory.', amCamId);
  await n('TPRM_REMEDIATION_SATISFIED', 'Remediation marked satisfactory', 'Remediation for Cred - Security config has been marked as Satisfactory.', boId);
  // #22 Remediation Unsatisfied
  await n('TPRM_REMEDIATION_UNSATISFIED', 'Remediation marked unsatisfactory', 'Remediation for Cred - Data encryption gap marked Unsatisfactory. Further action required.', amCamId, 'high');
  await n('TPRM_REMEDIATION_UNSATISFIED', 'Remediation marked unsatisfactory', 'Remediation for Cred - Data encryption gap marked Unsatisfactory. Further action required.', boId, 'high');
  // #23 Remediation Sent to Business
  await n('TPRM_REMEDIATION_SENT_TO_BUSINESS', 'Remediation assigned to you', 'Remediation for Cred - Network access control has been sent to you for business review.', rmId);
  // #24 Remediation Assigned to IT
  await n('TPRM_REMEDIATION_ASSIGNED_TO_IT', 'Remediation assigned to you', 'Remediation for Cred - Firewall config has been assigned to you for IT review.', itId);
  // #25 IT Remediation Submitted
  await n('TPRM_REMEDIATION_IT_SUBMITTED', 'IT remediation response submitted', 'IT/RM has submitted remediation response for Cred: Firewall config.', asId);
  await n('TPRM_REMEDIATION_IT_SUBMITTED', 'IT remediation response submitted', 'IT/RM has submitted remediation response for Cred: Firewall config.', boId);
  // #26 IT Remediation Approved
  await n('TPRM_REMEDIATION_IT_APPROVED', 'IT remediation approved', 'IT remediation for Cred - Firewall config has been approved.', itId);
  // #27 IT Remediation Returned
  await n('TPRM_REMEDIATION_IT_RETURNED', 'IT remediation returned', 'IT remediation for Cred - Firewall config returned: Incomplete fix.', itId, 'high');
  // #28 Remediation Overdue (NEW)
  await n('TPRM_REMEDIATION_OVERDUE', 'Remediation overdue', 'Remediation for Cred - Data backup gap is overdue. Due date: 2026-03-01.', amCamId, 'high');
  await n('TPRM_REMEDIATION_OVERDUE', 'Remediation overdue', 'Remediation for Cred - Data backup gap is overdue. Due date: 2026-03-01.', asId, 'high');
  await n('TPRM_REMEDIATION_OVERDUE', 'Remediation overdue', 'Remediation for Cred - Data backup gap is overdue. Due date: 2026-03-01.', boId, 'high');
  // #29 Remediation All Closed (NEW)
  await n('TPRM_REMEDIATION_ALL_CLOSED', 'All remediations closed', 'All remediation items for assessment ASM012 (vendor: Cred) have been closed.', amCamId);
  await n('TPRM_REMEDIATION_ALL_CLOSED', 'All remediations closed', 'All remediation items for assessment ASM012 (vendor: Cred) have been closed.', boId);
  // #30 Vendor Issue Created
  await n('TPRM_VENDOR_ISSUE_CREATED', 'Vendor issue reported', 'A new issue has been reported for vendor Cred: SLA breach', boId, 'high');
  await n('TPRM_VENDOR_ISSUE_CREATED', 'Vendor issue reported', 'A new issue has been reported for vendor Cred: SLA breach', admId, 'high');
  // #31 Vendor Issue Updated
  await n('TPRM_VENDOR_ISSUE_UPDATED', 'Vendor issue updated', 'Vendor issue for Cred has been updated: SLA breach. Status: In Progress.', amCamId);
  await n('TPRM_VENDOR_ISSUE_UPDATED', 'Vendor issue updated', 'Vendor issue for Cred has been updated: SLA breach. Status: In Progress.', boId);
  // #32 Vendor Issue Resolved
  await n('TPRM_VENDOR_ISSUE_RESOLVED', 'Vendor issue resolved', 'Vendor issue for Cred has been resolved: SLA breach on response time.', amCamId);
  await n('TPRM_VENDOR_ISSUE_RESOLVED', 'Vendor issue resolved', 'Vendor issue for Cred has been resolved: SLA breach on response time.', boId);
  // #33 Vendor Issue Escalated (NEW)
  await n('TPRM_VENDOR_ISSUE_ESCALATED', 'Vendor issue escalated', 'Vendor issue for Cred has been escalated: Recurring SLA breach.', boId, 'high');
  await n('TPRM_VENDOR_ISSUE_ESCALATED', 'Vendor issue escalated', 'Vendor issue for Cred has been escalated: Recurring SLA breach.', admId, 'high');
  // #34 Offboard Submitted
  await n('TPRM_OFFBOARD_SUBMITTED', 'Offboard assessment submitted', 'Offboard assessment for vendor Hotstar has been submitted for your review.', asId);
  // #35 Offboard Assessor Approved
  await n('TPRM_OFFBOARD_ASSESSOR_APPROVED', 'Offboard assessment: assessor approved', 'Offboard assessment for vendor Hotstar approved by assessor. Awaiting RM review.', rmId);
  // #36 Offboard Assessor Sent Back
  await n('TPRM_OFFBOARD_ASSESSOR_SENT_BACK', 'Offboard assessment returned by assessor', 'Offboard assessment for vendor Hotstar returned by assessor: Need more details.', amCamId, 'high');
  // #37 Offboard RM Approved
  await n('TPRM_OFFBOARD_RM_APPROVED', 'Offboard assessment: RM approved', 'Offboard assessment for vendor Hotstar approved by RM. Awaiting BO approval.', boId);
  // #38 Offboard RM Sent Back
  await n('TPRM_OFFBOARD_RM_SENT_BACK', 'Offboard assessment returned by RM', 'Offboard assessment for vendor Hotstar returned by RM: Verify data retention.', amCamId, 'high');
  // #39 Offboard BO Approved (Final)
  await n('TPRM_OFFBOARD_BO_APPROVED', 'Vendor offboarding approved', 'Vendor Hotstar offboarding has been fully approved. Vendor status set to Offboarded.', asId, 'high');
  await n('TPRM_OFFBOARD_BO_APPROVED', 'Vendor offboarding approved', 'Vendor Hotstar offboarding has been fully approved. Vendor status set to Offboarded.', rmId, 'high');
  await n('TPRM_OFFBOARD_BO_APPROVED', 'Vendor offboarding approved', 'Vendor Hotstar offboarding has been fully approved. Vendor status set to Offboarded.', amCamId, 'high');
  // #40 Offboard BO Sent to RM
  await n('TPRM_OFFBOARD_BO_SENT_TO_RM', 'Offboard assessment sent back by BO', 'Offboard assessment for vendor Hotstar sent back to RM by Business Owner.', rmId);
  // #41 Monitoring Scan Completed (NEW)
  await n('TPRM_MONITORING_SCAN_COMPLETED', 'Monitoring scan completed', 'Monitoring scan completed for vendor Cred. Risk score: 72.', boId);
  await n('TPRM_MONITORING_SCAN_COMPLETED', 'Monitoring scan completed', 'Monitoring scan completed for vendor Cred. Risk score: 72.', amCamId);
  // #42 Critical Risk Detected (NEW)
  await n('TPRM_MONITORING_CRITICAL_RISK', 'Critical risk detected', 'CRITICAL: Monitoring scan for vendor Legion detected high risk. Score: 28.', boId, 'high');
  await n('TPRM_MONITORING_CRITICAL_RISK', 'Critical risk detected', 'CRITICAL: Monitoring scan for vendor Legion detected high risk. Score: 28.', amCamId, 'high');
  await n('TPRM_MONITORING_CRITICAL_RISK', 'Critical risk detected', 'CRITICAL: Monitoring scan for vendor Legion detected high risk. Score: 28.', asId, 'high');
  // #43 Support Request
  await n('TPRM_SUPPORT_REQUEST', 'TPRM Support Request', 'Support request from cam (Cred): Need help with assessment.', boId);
  await n('TPRM_SUPPORT_REQUEST', 'TPRM Support Request', 'Support request from cam (Cred): Need help with assessment.', admId);
  // #44 Contract Expiry Reminder (NEW)
  await n('TPRM_CONTRACT_EXPIRY', 'Vendor contract expiring soon', 'Vendor Cred contract expires on 2026-03-12. Please take action.', amCamId, 'high');
  await n('TPRM_CONTRACT_EXPIRY', 'Vendor contract expiring soon', 'Vendor Cred contract expires on 2026-03-12. Please take action.', boId, 'high');
  // #45 Assessment Due Reminder (NEW)
  await n('TPRM_ASSESSMENT_DUE_REMINDER', 'Assessment due soon', 'Assessment ASM008 for vendor Claude is due on 2026-03-12.', amCamId, 'high');
  await n('TPRM_ASSESSMENT_DUE_REMINDER', 'Assessment due soon', 'Assessment ASM008 for vendor Claude is due on 2026-03-12.', asId, 'high');
  // #46 SME Assignment Pending (NEW)
  await n('TPRM_SME_ASSIGNMENT_PENDING', 'Pending SME assignment', 'You have a pending SME assignment on assessment ASM012.', smeId);

  // Summary
  const events = [...new Set(results.map(r => r.event))];
  console.log('Total notifications created:', results.length);
  console.log('Unique event types:', events.length);
  console.log('\nAll event types:');
  events.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  const roleMap = {
    [boId]: 'Business Owner',
    [asId]: 'Assessor',
    [apId]: 'Approver',
    [rmId]: 'Rel Manager',
    [itId]: 'IT Team',
    [amCamId]: 'AM (cam)',
    [amStId]: 'AM (st)',
    [admId]: 'Admin',
    [smeId]: 'SME (swr)',
  };
  const countsByRecipient = {};
  for (const r of results) {
    const label = roleMap[r.recipientId] || r.recipientId;
    countsByRecipient[label] = (countsByRecipient[label] || 0) + 1;
  }
  console.log('\nNotifications per role:');
  for (const [role, count] of Object.entries(countsByRecipient).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role}: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
