/**
 * Script to create "ah" and "ah1" audit head users with their test data
 * Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-ah-users.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAhUsers() {
  console.log('\n=== Creating AH and AH1 Audit Head Users ===\n');

  const hashedPassword = await bcrypt.hash('1', 10);

  // Get the first customer account
  const customerAccount = await prisma.customerAccount.findFirst();

  if (!customerAccount) {
    console.error('No customer account found! Please run the main seed first.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Using customer account: ${customerAccount.name} (${customerAccount.code})`);
  const customerAccountId = customerAccount.id;

  // Get or create AuditHead role
  const auditHeadRole = await prisma.role.upsert({
    where: { name: 'AuditHead' },
    update: {},
    create: {
      name: 'AuditHead',
      description: 'Full access to Internal Audit module',
      isSystem: true,
    },
  });

  // Get the Internal Audit department or first department
  let auditDept = await prisma.department.findFirst({
    where: { customerAccountId }
  });

  // ==================== Create "ah" user ====================
  console.log('\nCreating user "ah"...');

  let ahUser = await prisma.user.findFirst({
    where: { userName: 'ah', customerAccountId }
  });

  if (!ahUser) {
    ahUser = await prisma.user.create({
      data: {
        userId: 'AH-001',
        userName: 'ah',
        email: 'ah@company.com',
        password: hashedPassword,
        firstName: 'Audit',
        lastName: 'Head',
        fullName: 'Audit Head',
        departmentId: auditDept?.id,
        designation: 'Audit Head',
        customerAccountId,
        isActive: true,
      },
    });
    console.log(`Created user: ${ahUser.fullName} (${ahUser.userName}) - ID: ${ahUser.id}`);
  } else {
    ahUser = await prisma.user.update({
      where: { id: ahUser.id },
      data: { password: hashedPassword },
    });
    console.log(`Updated user: ${ahUser.fullName} (${ahUser.userName}) - ID: ${ahUser.id}`);
  }

  // Assign AuditHead role to "ah"
  const existingAhRole = await prisma.userRole.findFirst({
    where: { userId: ahUser.id, roleId: auditHeadRole.id }
  });
  if (!existingAhRole) {
    await prisma.userRole.create({
      data: { userId: ahUser.id, roleId: auditHeadRole.id },
    });
    console.log(`Assigned AuditHead role to "ah"`);
  }

  // ==================== Create "ah1" user ====================
  console.log('\nCreating user "ah1"...');

  let ah1User = await prisma.user.findFirst({
    where: { userName: 'ah1', customerAccountId }
  });

  if (!ah1User) {
    ah1User = await prisma.user.create({
      data: {
        userId: 'AH1-001',
        userName: 'ah1',
        email: 'ah1@company.com',
        password: hashedPassword,
        firstName: 'Audit',
        lastName: 'Head One',
        fullName: 'Audit Head One',
        departmentId: auditDept?.id,
        designation: 'Audit Head',
        customerAccountId,
        isActive: true,
      },
    });
    console.log(`Created user: ${ah1User.fullName} (${ah1User.userName}) - ID: ${ah1User.id}`);
  } else {
    ah1User = await prisma.user.update({
      where: { id: ah1User.id },
      data: { password: hashedPassword },
    });
    console.log(`Updated user: ${ah1User.fullName} (${ah1User.userName}) - ID: ${ah1User.id}`);
  }

  // Assign AuditHead role to "ah1"
  const existingAh1Role = await prisma.userRole.findFirst({
    where: { userId: ah1User.id, roleId: auditHeadRole.id }
  });
  if (!existingAh1Role) {
    await prisma.userRole.create({
      data: { userId: ah1User.id, roleId: auditHeadRole.id },
    });
    console.log(`Assigned AuditHead role to "ah1"`);
  }

  // ==================== Create Test Data for "ah" ====================
  console.log('\n=== Creating Test Data for "ah" ===\n');

  // Create audit types for "ah"
  const ahTypes = ['Internal Audit - AH', 'Compliance Audit - AH'];
  for (const typeName of ahTypes) {
    const existing = await prisma.auditType.findFirst({
      where: { name: typeName, auditHeadId: ahUser.id }
    });
    if (!existing) {
      await prisma.auditType.create({
        data: {
          name: typeName,
          customerAccountId,
          auditHeadId: ahUser.id,
        }
      });
      console.log(`Created audit type for "ah": ${typeName}`);
    }
  }

  // Create audit category for "ah"
  const ahCatExists = await prisma.auditCategory.findFirst({
    where: { name: 'Financial Audits - AH', auditHeadId: ahUser.id }
  });
  if (!ahCatExists) {
    await prisma.auditCategory.create({
      data: {
        name: 'Financial Audits - AH',
        customerAccountId,
        auditHeadId: ahUser.id,
      }
    });
    console.log(`Created audit category for "ah": Financial Audits - AH`);
  }

  // Create engagement for "ah"
  const ahEngExists = await prisma.auditEngagement.findFirst({
    where: { customerAccountId, auditId: 'AH-ENG-001' }
  });
  let ahEngagement;
  if (!ahEngExists) {
    ahEngagement = await prisma.auditEngagement.create({
      data: {
        auditId: 'AH-ENG-001',
        engagementTitle: 'Annual Financial Audit - AH',
        engagementObjective: 'Conduct annual financial audit',
        status: 'Planned',
        auditType: 'Internal Audit',
        departmentId: auditDept?.id,
        customerAccountId,
        auditHeadId: ahUser.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`Created engagement for "ah": ${ahEngagement.auditId}`);
  } else {
    ahEngagement = ahEngExists;
    console.log(`Engagement exists for "ah": ${ahEngagement.auditId}`);
  }

  // Create risk for "ah"
  const ahRiskExists = await prisma.internalAuditRisk.findFirst({
    where: { customerAccountId, riskId: 'AH-RISK-001' }
  });
  if (!ahRiskExists) {
    await prisma.internalAuditRisk.create({
      data: {
        riskId: 'AH-RISK-001',
        riskName: 'Financial Reporting Risk - AH',
        riskDescription: 'Risk of material misstatement in financial reports',
        status: 'Open',
        riskLevel: 'High',
        customerAccountId,
        auditHeadId: ahUser.id,
        engagementId: ahEngagement.id,
      },
    });
    console.log(`Created risk for "ah": AH-RISK-001`);
  }

  // ==================== Create Test Data for "ah1" ====================
  console.log('\n=== Creating Test Data for "ah1" ===\n');

  // Create audit types for "ah1"
  const ah1Types = ['Operational Audit - AH1', 'IT Audit - AH1'];
  for (const typeName of ah1Types) {
    const existing = await prisma.auditType.findFirst({
      where: { name: typeName, auditHeadId: ah1User.id }
    });
    if (!existing) {
      await prisma.auditType.create({
        data: {
          name: typeName,
          customerAccountId,
          auditHeadId: ah1User.id,
        }
      });
      console.log(`Created audit type for "ah1": ${typeName}`);
    }
  }

  // Create audit category for "ah1"
  const ah1CatExists = await prisma.auditCategory.findFirst({
    where: { name: 'IT Audits - AH1', auditHeadId: ah1User.id }
  });
  if (!ah1CatExists) {
    await prisma.auditCategory.create({
      data: {
        name: 'IT Audits - AH1',
        customerAccountId,
        auditHeadId: ah1User.id,
      }
    });
    console.log(`Created audit category for "ah1": IT Audits - AH1`);
  }

  // Create engagement for "ah1"
  const ah1EngExists = await prisma.auditEngagement.findFirst({
    where: { customerAccountId, auditId: 'AH1-ENG-001' }
  });
  let ah1Engagement;
  if (!ah1EngExists) {
    ah1Engagement = await prisma.auditEngagement.create({
      data: {
        auditId: 'AH1-ENG-001',
        engagementTitle: 'Quarterly IT Security Audit - AH1',
        engagementObjective: 'Review IT security controls',
        status: 'In Progress',
        auditType: 'IT Audit',
        departmentId: auditDept?.id,
        customerAccountId,
        auditHeadId: ah1User.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`Created engagement for "ah1": ${ah1Engagement.auditId}`);
  } else {
    ah1Engagement = ah1EngExists;
    console.log(`Engagement exists for "ah1": ${ah1Engagement.auditId}`);
  }

  // Create risk for "ah1"
  const ah1RiskExists = await prisma.internalAuditRisk.findFirst({
    where: { customerAccountId, riskId: 'AH1-RISK-001' }
  });
  if (!ah1RiskExists) {
    await prisma.internalAuditRisk.create({
      data: {
        riskId: 'AH1-RISK-001',
        riskName: 'Cybersecurity Risk - AH1',
        riskDescription: 'Risk of cyber attacks and data breaches',
        status: 'Open',
        riskLevel: 'Critical',
        customerAccountId,
        auditHeadId: ah1User.id,
        engagementId: ah1Engagement.id,
      },
    });
    console.log(`Created risk for "ah1": AH1-RISK-001`);
  }

  // ==================== Create Scoring Configuration for each user ====================
  console.log('\n=== Creating Scoring Configuration ===\n');

  // Helper function to create scoring config and ranges for a user
  async function createScoringConfigForUser(userId: string, userName: string) {
    // Create or update scoring config
    const existingConfig = await prisma.auditScoringConfig.findFirst({
      where: { customerAccountId, auditHeadId: userId }
    });

    if (!existingConfig) {
      await prisma.auditScoringConfig.create({
        data: {
          customerAccountId,
          auditHeadId: userId,
          probabilityImpactCalcType: 'High of all',
          riskRatingCalcType: 'Addition of all',
        }
      });
      console.log(`Created scoring config for "${userName}"`);
    }

    // Create Risk Factors
    const factors = ['Financial', 'Reputational', 'Regulatory', 'Compliance', 'Operational Complexity'];
    for (const label of factors) {
      const existing = await prisma.auditRiskFactor.findFirst({
        where: { label, customerAccountId, auditHeadId: userId }
      });
      if (!existing) {
        await prisma.auditRiskFactor.create({
          data: { label, customerAccountId, auditHeadId: userId }
        });
      }
    }
    console.log(`Created ${factors.length} risk factors for "${userName}"`);

    // Create Probabilities
    const probabilities = [
      { label: 'Very Low', value: 1 },
      { label: 'Low', value: 2 },
      { label: 'Medium', value: 3 },
      { label: 'High', value: 4 },
      { label: 'Very High', value: 5 },
    ];
    for (const prob of probabilities) {
      const existing = await prisma.auditProbability.findFirst({
        where: { label: prob.label, customerAccountId, auditHeadId: userId }
      });
      if (!existing) {
        await prisma.auditProbability.create({
          data: { label: prob.label, value: prob.value, customerAccountId, auditHeadId: userId }
        });
      }
    }
    console.log(`Created ${probabilities.length} probabilities for "${userName}"`);

    // Create Impacts
    const impacts = [
      { label: 'Very Low', value: 1 },
      { label: 'Low', value: 2 },
      { label: 'Medium', value: 3 },
      { label: 'High', value: 4 },
      { label: 'Very High', value: 5 },
    ];
    for (const impact of impacts) {
      const existing = await prisma.auditImpact.findFirst({
        where: { label: impact.label, customerAccountId, auditHeadId: userId }
      });
      if (!existing) {
        await prisma.auditImpact.create({
          data: { label: impact.label, value: impact.value, customerAccountId, auditHeadId: userId }
        });
      }
    }
    console.log(`Created ${impacts.length} impacts for "${userName}"`);

    // Create Scoring Ranges for each calculation type
    const scoringRangesByType = {
      'High of all': [
        { label: 'Low', lowValue: 50, highValue: null },
        { label: 'Medium', lowValue: 100, highValue: null },
        { label: 'High', lowValue: 250, highValue: null },
      ],
      'Addition of all': [
        { label: 'Low', lowValue: 1, highValue: 5 },
        { label: 'Medium', lowValue: 6, highValue: 12 },
        { label: 'High', lowValue: 13, highValue: 20 },
        { label: 'Extreme', lowValue: 21, highValue: 25 },
      ],
      'Product of all': [
        { label: 'Low', lowValue: 0, highValue: 5 },
        { label: 'Medium', lowValue: 6, highValue: 12 },
        { label: 'High', lowValue: 13, highValue: 20 },
        { label: 'Extreme', lowValue: 21, highValue: 100 },
      ],
    };

    for (const [calcType, ranges] of Object.entries(scoringRangesByType)) {
      for (const range of ranges) {
        const existing = await prisma.auditScoringRange.findFirst({
          where: {
            label: range.label,
            calculationType: calcType,
            customerAccountId,
            auditHeadId: userId
          }
        });
        if (!existing) {
          await prisma.auditScoringRange.create({
            data: {
              label: range.label,
              lowValue: range.lowValue,
              highValue: range.highValue,
              calculationType: calcType,
              customerAccountId,
              auditHeadId: userId,
            }
          });
        }
      }
    }
    console.log(`Created scoring ranges for all calculation types for "${userName}"`);
  }

  // Create scoring config for both users
  await createScoringConfigForUser(ahUser.id, 'ah');
  await createScoringConfigForUser(ah1User.id, 'ah1');

  // ==================== Summary ====================
  console.log('\n=== Summary ===\n');
  console.log('Users created/updated:');
  console.log(`  - ah (password: 1) - ID: ${ahUser.id}`);
  console.log(`  - ah1 (password: 1) - ID: ${ah1User.id}`);
  console.log('\nTest data created for each user:');
  console.log('  - Audit Types (with auditHeadId)');
  console.log('  - Audit Categories (with auditHeadId)');
  console.log('  - Engagements (with auditHeadId)');
  console.log('  - Risks (with auditHeadId)');
  console.log('  - Scoring Configuration');
  console.log('  - Risk Factors');
  console.log('  - Probabilities');
  console.log('  - Impacts');
  console.log('  - Scoring Ranges (for all 3 calculation types)');
  console.log('\nEach user will only see their OWN data due to tenant filtering.');
  console.log('\nYou can now login with "ah" or "ah1" (password: 1)');

  await prisma.$disconnect();
}

seedAhUsers().catch(console.error);
