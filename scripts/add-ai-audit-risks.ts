/**
 * Add dummy internal audit risks for AI audit risk selection testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const riskTemplates = [
  {
    riskName: 'Unauthorized Access to Financial Systems',
    riskDescription: 'Risk of unauthorized users gaining access to financial systems and sensitive data, leading to potential data breaches or fraudulent transactions.',
    sectionProcess: 'IT Security',
    subProcess: 'Access Control',
    activity: 'User Authentication',
    inherentLikelihood: 5,
    inherentImpact: 25,
    controlDescription: 'Multi-factor authentication, role-based access control, and regular access reviews',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 25,
  },
  {
    riskName: 'Inadequate Segregation of Duties',
    riskDescription: 'Risk that critical financial processes lack proper segregation of duties, allowing a single individual to execute and approve transactions.',
    sectionProcess: 'Finance Operations',
    subProcess: 'Transaction Processing',
    activity: 'Payment Authorization',
    inherentLikelihood: 10,
    inherentImpact: 25,
    controlDescription: 'Dual authorization for payments above threshold, periodic management review',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 5,
    residualImpact: 10,
  },
  {
    riskName: 'Data Loss or Corruption',
    riskDescription: 'Risk of critical business data being lost or corrupted due to system failures, human error, or cyberattacks.',
    sectionProcess: 'IT Operations',
    subProcess: 'Data Management',
    activity: 'Backup and Recovery',
    inherentLikelihood: 10,
    inherentImpact: 50,
    controlDescription: 'Daily automated backups, weekly backup testing, offsite storage',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 50,
  },
  {
    riskName: 'Non-Compliance with Regulatory Requirements',
    riskDescription: 'Risk of failing to comply with applicable laws, regulations, and industry standards, resulting in penalties or reputational damage.',
    sectionProcess: 'Compliance Management',
    subProcess: 'Regulatory Monitoring',
    activity: 'Compliance Assessment',
    inherentLikelihood: 5,
    inherentImpact: 50,
    controlDescription: 'Quarterly compliance reviews, regulatory change monitoring, training programs',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 25,
  },
  {
    riskName: 'Revenue Recognition Errors',
    riskDescription: 'Risk of incorrectly recognizing revenue leading to misstated financial statements and potential regulatory issues.',
    sectionProcess: 'Financial Reporting',
    subProcess: 'Revenue Accounting',
    activity: 'Revenue Recognition',
    inherentLikelihood: 5,
    inherentImpact: 25,
    controlDescription: 'Revenue recognition policy, management review, external audit',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 10,
  },
  {
    riskName: 'Supplier Fraud or Misconduct',
    riskDescription: 'Risk of fraud, bribery, or unethical practices by suppliers affecting the organization\'s reputation and financial position.',
    sectionProcess: 'Procurement',
    subProcess: 'Supplier Management',
    activity: 'Supplier Due Diligence',
    inherentLikelihood: 5,
    inherentImpact: 10,
    controlDescription: 'Supplier vetting process, code of conduct agreements, periodic supplier audits',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 2,
    residualImpact: 10,
  },
  {
    riskName: 'Business Continuity Disruption',
    riskDescription: 'Risk of significant business interruption due to natural disasters, system failures, or other unforeseen events.',
    sectionProcess: 'Operations',
    subProcess: 'Business Continuity Planning',
    activity: 'Disaster Recovery',
    inherentLikelihood: 2,
    inherentImpact: 50,
    controlDescription: 'Business continuity plan, annual BCP testing, alternative site arrangements',
    controlEffectiveness: 'Effective',
    residualLikelihood: 1,
    residualImpact: 25,
  },
  {
    riskName: 'Payroll Processing Errors',
    riskDescription: 'Risk of errors in payroll calculations, payments, or tax withholdings leading to employee dissatisfaction and compliance issues.',
    sectionProcess: 'Human Resources',
    subProcess: 'Payroll Management',
    activity: 'Payroll Processing',
    inherentLikelihood: 5,
    inherentImpact: 10,
    controlDescription: 'Automated payroll system, monthly reconciliation, supervisor review',
    controlEffectiveness: 'Effective',
    residualLikelihood: 2,
    residualImpact: 5,
  },
  {
    riskName: 'Inventory Shrinkage or Obsolescence',
    riskDescription: 'Risk of inventory loss due to theft, damage, or obsolescence, impacting financial results and operational efficiency.',
    sectionProcess: 'Operations',
    subProcess: 'Inventory Management',
    activity: 'Stock Control',
    inherentLikelihood: 10,
    inherentImpact: 10,
    controlDescription: 'Cycle counts, security measures, obsolescence reviews',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 5,
    residualImpact: 5,
  },
  {
    riskName: 'Cybersecurity Breach',
    riskDescription: 'Risk of external cyberattacks resulting in data theft, system compromise, or operational disruption.',
    sectionProcess: 'IT Security',
    subProcess: 'Cybersecurity',
    activity: 'Threat Management',
    inherentLikelihood: 10,
    inherentImpact: 50,
    controlDescription: 'Firewall, intrusion detection, security awareness training, incident response plan',
    controlEffectiveness: 'Effective',
    residualLikelihood: 5,
    residualImpact: 25,
  },
  {
    riskName: 'Key Person Dependency',
    riskDescription: 'Risk that critical business functions rely heavily on specific individuals, creating vulnerability if they leave.',
    sectionProcess: 'Human Resources',
    subProcess: 'Succession Planning',
    activity: 'Knowledge Management',
    inherentLikelihood: 5,
    inherentImpact: 10,
    controlDescription: 'Cross-training programs, documentation of procedures, succession planning',
    controlEffectiveness: 'Partially Effective',
    residualLikelihood: 2,
    residualImpact: 10,
  },
  {
    riskName: 'Contract Management Failures',
    riskDescription: 'Risk of missing contract renewal dates, unfavorable terms, or non-compliance with contract obligations.',
    sectionProcess: 'Legal and Contracts',
    subProcess: 'Contract Administration',
    activity: 'Contract Monitoring',
    inherentLikelihood: 5,
    inherentImpact: 10,
    controlDescription: 'Contract management system, renewal alerts, periodic contract reviews',
    controlEffectiveness: 'Effective',
    residualLikelihood: 1,
    residualImpact: 10,
  },
];

async function addAIAuditRisks() {
  console.log('Adding dummy internal audit risks for AI audit testing...');

  try {
    // Get the Audit Manager user (auditm)
    const auditManager = await prisma.user.findFirst({
      where: { userName: 'auditm' },
    });

    if (!auditManager) {
      console.error('Audit Manager (auditm) not found');
      return;
    }

    console.log(`Found Audit Manager: ${auditManager.firstName} ${auditManager.lastName}`);

    // Get all departments
    const departments = await prisma.department.findMany({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    if (departments.length === 0) {
      console.error('No departments found for this customer account');
      return;
    }

    console.log(`Found ${departments.length} departments`);

    // Get audit categories
    const categories = await prisma.auditCategory.findMany({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    // Get audit types
    const auditTypes = await prisma.auditType.findMany({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    // Get existing risk count to generate unique IDs
    const existingRisks = await prisma.internalAuditRisk.count({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    let riskCounter = existingRisks + 1;
    let createdCount = 0;

    // Create 3-4 risks per department
    for (const department of departments) {
      const risksForDept = riskTemplates.slice(0, Math.min(3 + Math.floor(Math.random() * 2), riskTemplates.length));

      for (const template of risksForDept) {
        const riskId = `RID${riskCounter.toString().padStart(3, '0')}`;

        // Calculate scores
        const inherentScore = template.inherentLikelihood * template.inherentImpact;
        const residualScore = template.residualLikelihood * template.residualImpact;

        // Determine risk level based on residual score
        let riskLevel = 'Low';
        if (residualScore >= 250) riskLevel = 'Extreme';
        else if (residualScore >= 100) riskLevel = 'High';
        else if (residualScore >= 50) riskLevel = 'Medium';
        else riskLevel = 'Low';

        const risk = await prisma.internalAuditRisk.create({
          data: {
            customerAccountId: auditManager.customerAccountId!,
            auditHeadId: auditManager.auditHeadId,
            riskId,
            riskName: template.riskName,
            riskDescription: template.riskDescription,
            departmentId: department.id,
            sectionProcess: template.sectionProcess,
            subProcess: template.subProcess,
            activity: template.activity,
            categoryId: categories.length > 0 ? categories[Math.floor(Math.random() * categories.length)].id : null,
            auditTypeId: auditTypes.length > 0 ? auditTypes[Math.floor(Math.random() * auditTypes.length)].id : null,
            inherentLikelihood: template.inherentLikelihood,
            inherentImpact: template.inherentImpact,
            inherentScore,
            controlDescription: template.controlDescription,
            controlEffectiveness: template.controlEffectiveness,
            residualLikelihood: template.residualLikelihood,
            residualImpact: template.residualImpact,
            residualScore,
            riskLevel,
            status: 'Open',
            creationDate: new Date(),
          },
        });

        console.log(`  ✅ Created ${riskId}: ${template.riskName} (${riskLevel}) for ${department.name}`);
        createdCount++;
        riskCounter++;
      }
    }

    console.log(`\n✅ Successfully created ${createdCount} internal audit risks across ${departments.length} departments`);
    console.log('\nYou can now test the AI Audit Risk Selection page with these risks!');

  } catch (error) {
    console.error('Error adding AI audit risks:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addAIAuditRisks()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
