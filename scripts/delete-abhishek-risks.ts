import prisma from '../src/lib/prisma';

async function deleteAbhishekRisks() {
  try {
    // Find Abhishek user
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true }
    });

    if (!abhishek) {
      console.log('Error: Abhishek user not found');
      return;
    }

    console.log('Found Abhishek:', abhishek.fullName, '(ID:', abhishek.id + ')');
    console.log('\nDeleting risk data associated with Abhishek...\n');

    // Delete from InternalAuditRisk (Risk Register)
    const deletedRiskRegister = await prisma.internalAuditRisk.deleteMany({
      where: {
        auditHeadId: abhishek.id
      }
    });

    console.log('✓ Deleted', deletedRiskRegister.count, 'entries from Risk Register (InternalAuditRisk)');

    console.log('\n✅ Successfully deleted all risk data for Abhishek!');
    console.log('\nNote: Risk Register and Risk Identification use the same table (InternalAuditRisk),');
    console.log('so deleting from Risk Register also removes data from Risk Identification page.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAbhishekRisks();
