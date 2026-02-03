/**
 * Script to clean all Internal Audit dummy data
 * Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/clean-internal-audit.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanInternalAudit() {
  console.log('=== Cleaning Internal Audit Data ===\n');

  // Delete in order to respect foreign key constraints

  // 1. Delete audit documents
  const docs = await prisma.internalAuditDocument.deleteMany({});
  console.log(`Deleted ${docs.count} Internal Audit Documents`);

  // 2. Delete audit CAPAs
  const capas = await prisma.internalAuditCAPA.deleteMany({});
  console.log(`Deleted ${capas.count} Internal Audit CAPAs`);

  // 3. Delete audit findings
  const findings = await prisma.internalAuditFinding.deleteMany({});
  console.log(`Deleted ${findings.count} Internal Audit Findings`);

  // 4. Delete audit workpapers
  const workpapers = await prisma.auditWorkpaper.deleteMany({});
  console.log(`Deleted ${workpapers.count} Audit Workpapers`);

  // 5. Delete audit fieldwork
  const fieldwork = await prisma.auditFieldwork.deleteMany({});
  console.log(`Deleted ${fieldwork.count} Audit Fieldwork`);

  // 6. Delete audit reports
  const reports = await prisma.auditReport.deleteMany({});
  console.log(`Deleted ${reports.count} Audit Reports`);

  // 7. Delete internal audit risks
  const risks = await prisma.internalAuditRisk.deleteMany({});
  console.log(`Deleted ${risks.count} Internal Audit Risks`);

  // 8. Delete audit engagements
  const engagements = await prisma.auditEngagement.deleteMany({});
  console.log(`Deleted ${engagements.count} Audit Engagements`);

  // 9. Delete auditable entities
  const entities = await prisma.auditableEntity.deleteMany({});
  console.log(`Deleted ${entities.count} Auditable Entities`);

  // 10. Delete audit types
  const types = await prisma.auditType.deleteMany({});
  console.log(`Deleted ${types.count} Audit Types`);

  // 11. Delete audit categories
  const categories = await prisma.auditCategory.deleteMany({});
  console.log(`Deleted ${categories.count} Audit Categories`);

  // 12. Delete nature of controls
  const noc = await prisma.auditNatureOfControl.deleteMany({});
  console.log(`Deleted ${noc.count} Nature of Controls`);

  // 13. Delete periodicity
  const periodicity = await prisma.auditPeriodicity.deleteMany({});
  console.log(`Deleted ${periodicity.count} Periodicity`);

  // 14. Delete risk factors
  const riskFactors = await prisma.auditRiskFactor.deleteMany({});
  console.log(`Deleted ${riskFactors.count} Risk Factors`);

  // 15. Delete probability ratings
  const probRatings = await prisma.auditProbability.deleteMany({});
  console.log(`Deleted ${probRatings.count} Probability Ratings`);

  // 16. Delete impact ratings
  const impactRatings = await prisma.auditImpact.deleteMany({});
  console.log(`Deleted ${impactRatings.count} Impact Ratings`);

  // 17. Delete scoring ranges
  const scoringRanges = await prisma.auditScoringRange.deleteMany({});
  console.log(`Deleted ${scoringRanges.count} Scoring Ranges`);

  // 18. Delete scoring config
  const scoringConfig = await prisma.auditScoringConfig.deleteMany({});
  console.log(`Deleted ${scoringConfig.count} Scoring Config`);

  // 19. Delete escalation config
  const escalationConfig = await prisma.auditEscalationConfig.deleteMany({});
  console.log(`Deleted ${escalationConfig.count} Escalation Config`);

  // 20. Delete audit locations
  const locations = await prisma.auditLocation.deleteMany({});
  console.log(`Deleted ${locations.count} Audit Locations`);

  // 21. Delete old Audit and AuditFinding (if any)
  const oldFindings = await prisma.auditFinding.deleteMany({});
  console.log(`Deleted ${oldFindings.count} Old Audit Findings`);

  const oldAudits = await prisma.audit.deleteMany({});
  console.log(`Deleted ${oldAudits.count} Old Audits`);

  console.log('\n=== Done! All Internal Audit data cleaned ===');

  await prisma.$disconnect();
}

cleanInternalAudit().catch(console.error);
