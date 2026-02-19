import prisma from '../src/lib/prisma';

async function deleteAllAbhishekRisks() {
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

    // Count risks before deletion
    const riskCount = await prisma.internalAuditRisk.count({
      where: { auditHeadId: abhishek.id }
    });

    console.log('\nRisks associated with Abhishek:', riskCount);
    console.log('\nDeleting all risk data...\n');

    // Delete all risks associated with Abhishek
    const deletedRisks = await prisma.internalAuditRisk.deleteMany({
      where: {
        auditHeadId: abhishek.id
      }
    });

    console.log('✓ Deleted', deletedRisks.count, 'risk entries');

    // Verify deletion
    const remainingRisks = await prisma.internalAuditRisk.count({
      where: { auditHeadId: abhishek.id }
    });

    console.log('\n✅ Success!');
    console.log('Remaining risks for Abhishek:', remainingRisks);
    console.log('\nRisk Register and Risk Identification pages will now be empty for Abhishek.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllAbhishekRisks();
