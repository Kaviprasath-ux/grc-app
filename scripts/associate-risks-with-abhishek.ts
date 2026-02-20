import prisma from '../src/lib/prisma';

async function associateRisksWithAuditHead() {
  try {
    // Find Abhishek (AuditHead)
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true }
    });

    if (!abhishek) {
      console.log('Error: Abhishek user not found');
      return;
    }

    console.log('Found Abhishek (AuditHead):', abhishek.fullName);
    console.log('Audit Head ID:', abhishek.id);
    console.log('\nAssociating risk data with Abhishek...\n');

    // Count risks with no audit head
    const risksWithoutAuditHead = await prisma.internalAuditRisk.count({
      where: {
        auditHeadId: null
      }
    });

    console.log('Risks without audit head association:', risksWithoutAuditHead);

    // Update all risks that have no audit head to be associated with Abhishek
    const updatedRisks = await prisma.internalAuditRisk.updateMany({
      where: {
        auditHeadId: null
      },
      data: {
        auditHeadId: abhishek.id
      }
    });

    console.log('✓ Associated', updatedRisks.count, 'risk entries with Abhishek');

    // Verify the update
    const abhishekRisks = await prisma.internalAuditRisk.count({
      where: { auditHeadId: abhishek.id }
    });

    console.log('\n✅ Success! Abhishek now has', abhishekRisks, 'risk entries');
    console.log('\nThese risks will now appear in:');
    console.log('  - Risk Register page');
    console.log('  - Risk Identification page');
    console.log('\nWhen Abhishek logs in, he will only see his own risk data.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

associateRisksWithAuditHead();
