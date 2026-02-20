import prisma from '../src/lib/prisma';

async function checkRisks() {
  try {
    const totalRisks = await prisma.internalAuditRisk.count();
    console.log('Total Risk Register entries in database:', totalRisks);

    const abhishekRisks = await prisma.internalAuditRisk.count({
      where: { auditHeadId: 'cmlhtiqa7001rv2retul7lhdl' }
    });
    console.log('Risk entries associated with Abhishek:', abhishekRisks);

    if (totalRisks === 0) {
      console.log('\n✅ Database is clean - no risk data exists!');
    } else if (abhishekRisks === 0) {
      console.log('\n✅ No risks associated with Abhishek!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRisks();
