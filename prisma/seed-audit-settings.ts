/**
 * Seed Internal Audit Settings with Audit Head Isolation
 *
 * This script creates dummy data for all Internal Audit settings tables,
 * ensuring each Audit Head has their own isolated set of settings.
 *
 * Usage: npx tsx prisma/seed-audit-settings.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Internal Audit Settings with Audit Head Isolation...\n');

  // Get AuditHead role
  const auditHeadRole = await prisma.role.findUnique({
    where: { name: 'AuditHead' },
  });

  if (!auditHeadRole) {
    console.log('⚠️  AuditHead role not found. Please run main seed script first.');
    return;
  }

  // Get all users with AuditHead role
  const userRoles = await prisma.userRole.findMany({
    where: { roleId: auditHeadRole.id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          customerAccountId: true,
        },
      },
    },
  });

  const auditHeads = userRoles.map((ur) => ur.user);

  if (auditHeads.length === 0) {
    console.log('⚠️  No Audit Heads found. Please create Audit Head users first.');
    return;
  }

  console.log(`Found ${auditHeads.length} Audit Head(s):\n`);
  auditHeads.forEach((ah) => {
    console.log(`  - ${ah.firstName} ${ah.lastName} (ID: ${ah.id})`);
  });
  console.log('');

  // Seed data for each audit head
  for (const auditHead of auditHeads) {
    console.log(`\n📋 Seeding settings for ${auditHead.firstName} ${auditHead.lastName}...`);

    await seedAuditCategories(auditHead.id, auditHead.customerAccountId);
    await seedAuditTypes(auditHead.id, auditHead.customerAccountId);
    await seedAuditProbability(auditHead.id, auditHead.customerAccountId);
    await seedAuditImpact(auditHead.id, auditHead.customerAccountId);
    await seedNatureOfControls(auditHead.id, auditHead.customerAccountId);
    await seedPeriodicity(auditHead.id, auditHead.customerAccountId);
    await seedProcessFrequency(auditHead.id, auditHead.customerAccountId);
    await seedInternalAuditProcess(auditHead.id, auditHead.customerAccountId);
    await seedEscalationConfig(auditHead.id, auditHead.customerAccountId);
    await seedRiskFactors(auditHead.id, auditHead.customerAccountId);
    await seedScoringConfig(auditHead.id, auditHead.customerAccountId);
    await seedScoringRanges(auditHead.id, auditHead.customerAccountId);

    console.log(`  ✅ Completed for ${auditHead.firstName} ${auditHead.lastName}`);
  }

  console.log('\n✅ All Internal Audit settings seeded successfully!');
}

// Seed Audit Categories
async function seedAuditCategories(auditHeadId: string, customerAccountId: string) {
  const categories = [
    'Financial Audit',
    'Operational Audit',
    'Compliance Audit',
    'IT Audit',
    'Performance Audit',
    'Strategic Audit',
    'Risk-Based Audit',
    'Fraud Investigation',
    'Environmental Audit',
    'Quality Audit',
  ];

  for (const name of categories) {
    await prisma.auditCategory.upsert({
      where: {
        auditHeadId_name: {
          auditHeadId,
          name,
        },
      },
      update: {},
      create: {
        name,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Audit Categories: ${categories.length} items`);
}

// Seed Audit Types
async function seedAuditTypes(auditHeadId: string, customerAccountId: string) {
  const types = [
    'Internal',
    'External',
    'Forensic',
    'Statutory',
    'Compliance',
    'Operational',
    'Information Systems',
    'Financial',
    'Performance',
    'Investigative',
  ];

  for (const name of types) {
    await prisma.auditType.upsert({
      where: {
        auditHeadId_name: {
          auditHeadId,
          name,
        },
      },
      update: {},
      create: {
        name,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Audit Types: ${types.length} items`);
}

// Seed Audit Probability (Likelihood)
async function seedAuditProbability(auditHeadId: string, customerAccountId: string) {
  const probabilities = [
    { label: 'Very Low', value: 1 },
    { label: 'Low', value: 2 },
    { label: 'Medium', value: 3 },
    { label: 'High', value: 4 },
    { label: 'Very High', value: 5 },
  ];

  for (const prob of probabilities) {
    await prisma.auditProbability.upsert({
      where: {
        auditHeadId_label: {
          auditHeadId,
          label: prob.label,
        },
      },
      update: { value: prob.value },
      create: {
        label: prob.label,
        value: prob.value,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Audit Probability: ${probabilities.length} items`);
}

// Seed Audit Impact
async function seedAuditImpact(auditHeadId: string, customerAccountId: string) {
  const impacts = [
    { label: 'Insignificant', value: 1 },
    { label: 'Minor', value: 2 },
    { label: 'Moderate', value: 3 },
    { label: 'Major', value: 4 },
    { label: 'Catastrophic', value: 5 },
  ];

  for (const impact of impacts) {
    await prisma.auditImpact.upsert({
      where: {
        auditHeadId_label: {
          auditHeadId,
          label: impact.label,
        },
      },
      update: { value: impact.value },
      create: {
        label: impact.label,
        value: impact.value,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Audit Impact: ${impacts.length} items`);
}

// Seed Nature of Controls
async function seedNatureOfControls(auditHeadId: string, customerAccountId: string) {
  const controls = [
    'Preventive',
    'Detective',
    'Corrective',
    'Directive',
    'Compensating',
    'Manual',
    'Automated',
    'IT-Dependent',
  ];

  for (const label of controls) {
    await prisma.auditNatureOfControl.upsert({
      where: {
        auditHeadId_label: {
          auditHeadId,
          label,
        },
      },
      update: {},
      create: {
        label,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Nature of Controls: ${controls.length} items`);
}

// Seed Periodicity
async function seedPeriodicity(auditHeadId: string, customerAccountId: string) {
  const periodicities = [
    { interval: 'Monthly', months: 1 },
    { interval: 'Quarterly', months: 3 },
    { interval: 'Semi-Annually', months: 6 },
    { interval: 'Annually', months: 12 },
    { interval: 'Bi-Annually', months: 24 },
    { interval: 'As Needed', months: 0 },
  ];

  for (const period of periodicities) {
    await prisma.auditPeriodicity.upsert({
      where: {
        auditHeadId_interval: {
          auditHeadId,
          interval: period.interval,
        },
      },
      update: { months: period.months },
      create: {
        interval: period.interval,
        months: period.months,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Periodicity: ${periodicities.length} items`);
}

// Seed Process Frequency
async function seedProcessFrequency(auditHeadId: string, customerAccountId: string) {
  const frequencies = [
    'Daily',
    'Weekly',
    'Bi-Weekly',
    'Monthly',
    'Quarterly',
    'Semi-Annually',
    'Annually',
    'Bi-Annually',
    'As Needed',
    'Continuous',
  ];

  for (const name of frequencies) {
    await prisma.processFrequency.upsert({
      where: {
        auditHeadId_name: {
          auditHeadId,
          name,
        },
      },
      update: {},
      create: {
        name,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Process Frequency: ${frequencies.length} items`);
}

// Seed Internal Audit Process
async function seedInternalAuditProcess(auditHeadId: string, customerAccountId: string) {
  const processes = [
    { name: 'Risk Assessment', description: 'Identify and assess risks for audit planning' },
    { name: 'Audit Planning', description: 'Plan audit scope, objectives, and resources' },
    { name: 'Fieldwork', description: 'Execute audit procedures and collect evidence' },
    { name: 'Testing and Evaluation', description: 'Test controls and evaluate findings' },
    { name: 'Reporting', description: 'Document findings and communicate results' },
    { name: 'Follow-up', description: 'Monitor implementation of corrective actions' },
    { name: 'Quality Assurance', description: 'Review audit work for quality and compliance' },
    { name: 'Documentation', description: 'Maintain audit documentation and work papers' },
  ];

  for (const process of processes) {
    await prisma.internalAuditProcess.upsert({
      where: {
        auditHeadId_name: {
          auditHeadId,
          name: process.name,
        },
      },
      update: { description: process.description },
      create: {
        name: process.name,
        description: process.description,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Internal Audit Process: ${processes.length} items`);
}

// Seed Escalation Config
async function seedEscalationConfig(auditHeadId: string, customerAccountId: string) {
  const existing = await prisma.auditEscalationConfig.findFirst({
    where: { auditHeadId },
  });

  if (!existing) {
    await prisma.auditEscalationConfig.create({
      data: {
        auditHeadId,
        customerAccountId,
        responseSubmission: 5, // 5 days
        acknowledgement: 1, // 1 day
        clarification: 2, // 2 days
        issueResolution: 3, // 3 days
      },
    });
    console.log(`    ✓ Escalation Config: Created with default values`);
  } else {
    console.log(`    ✓ Escalation Config: Already exists`);
  }
}

// Seed Risk Factors
async function seedRiskFactors(auditHeadId: string, customerAccountId: string) {
  const riskFactors = [
    'Financial Impact',
    'Operational Disruption',
    'Regulatory Compliance',
    'Reputational Damage',
    'Strategic Misalignment',
    'Data Security',
    'Third-Party Dependencies',
    'Technology Infrastructure',
    'Human Resources',
    'Environmental & Social',
  ];

  for (const label of riskFactors) {
    await prisma.auditRiskFactor.upsert({
      where: {
        auditHeadId_label: {
          auditHeadId,
          label,
        },
      },
      update: {},
      create: {
        label,
        auditHeadId,
        customerAccountId,
      },
    });
  }
  console.log(`    ✓ Risk Factors: ${riskFactors.length} items`);
}

// Seed Scoring Config
async function seedScoringConfig(auditHeadId: string, customerAccountId: string) {
  const existing = await prisma.auditScoringConfig.findFirst({
    where: { auditHeadId },
  });

  if (!existing) {
    await prisma.auditScoringConfig.create({
      data: {
        auditHeadId,
        customerAccountId,
        probabilityImpactCalcType: 'Product of all', // Probability × Impact
        riskRatingCalcType: 'High of all', // Highest risk factor wins
      },
    });
    console.log(`    ✓ Scoring Config: Created (Probability×Impact, High of all factors)`);
  } else {
    console.log(`    ✓ Scoring Config: Already exists`);
  }
}

// Seed Scoring Ranges
async function seedScoringRanges(auditHeadId: string, customerAccountId: string) {
  // Get the scoring config to determine calculation types
  const config = await prisma.auditScoringConfig.findFirst({
    where: { auditHeadId },
  });

  const probabilityImpactCalcType = config?.probabilityImpactCalcType || 'Product of all';
  const riskRatingCalcType = config?.riskRatingCalcType || 'High of all';

  // Scoring ranges for Probability × Impact (Product of all)
  // Max score = 5 × 5 = 25
  const productRanges = [
    { label: 'Low', lowValue: 1, highValue: 6 },      // 1-6
    { label: 'Medium', lowValue: 7, highValue: 12 },  // 7-12
    { label: 'High', lowValue: 13, highValue: 20 },   // 13-20
    { label: 'Extreme', lowValue: 21, highValue: 25 }, // 21-25
  ];

  // Scoring ranges for High of all (takes highest value)
  // Max score = 5 (from probability or impact)
  const highOfAllRanges = [
    { label: 'Low', lowValue: 1, highValue: 2 },      // 1-2
    { label: 'Medium', lowValue: 3, highValue: 3 },   // 3
    { label: 'High', lowValue: 4, highValue: 4 },     // 4
    { label: 'Extreme', lowValue: 5, highValue: 5 },  // 5
  ];

  // Seed for probabilityImpactCalcType
  const piRanges = probabilityImpactCalcType === 'Product of all' ? productRanges : highOfAllRanges;
  for (const range of piRanges) {
    await prisma.auditScoringRange.upsert({
      where: {
        auditHeadId_label_calculationType: {
          auditHeadId,
          label: range.label,
          calculationType: probabilityImpactCalcType,
        },
      },
      update: {
        lowValue: range.lowValue,
        highValue: range.highValue,
      },
      create: {
        label: range.label,
        lowValue: range.lowValue,
        highValue: range.highValue,
        calculationType: probabilityImpactCalcType,
        auditHeadId,
        customerAccountId,
      },
    });
  }

  // Seed for riskRatingCalcType (if different)
  if (riskRatingCalcType !== probabilityImpactCalcType) {
    const rrRanges = riskRatingCalcType === 'Product of all' ? productRanges : highOfAllRanges;
    for (const range of rrRanges) {
      await prisma.auditScoringRange.upsert({
        where: {
          auditHeadId_label_calculationType: {
            auditHeadId,
            label: range.label,
            calculationType: riskRatingCalcType,
          },
        },
        update: {
          lowValue: range.lowValue,
          highValue: range.highValue,
        },
        create: {
          label: range.label,
          lowValue: range.lowValue,
          highValue: range.highValue,
          calculationType: riskRatingCalcType,
          auditHeadId,
          customerAccountId,
        },
      });
    }
  }

  console.log(`    ✓ Scoring Ranges: 4 ranges for each calculation type`);
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
