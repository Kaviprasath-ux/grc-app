import prisma from '../src/lib/prisma';

async function deleteAllRisks() {
  try {
    // Count total risks
    const totalRisks = await prisma.internalAuditRisk.count();
    console.log('Total risks in database:', totalRisks);

    if (totalRisks === 0) {
      console.log('\n✅ No risks found in database');
      return;
    }

    console.log('\nDeleting all risks...\n');

    // Delete all risks
    const deleted = await prisma.internalAuditRisk.deleteMany({});

    console.log('✓ Deleted', deleted.count, 'risk entries');

    // Verify deletion
    const remaining = await prisma.internalAuditRisk.count();
    console.log('\n✅ Success!');
    console.log('Remaining risks in database:', remaining);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllRisks();
