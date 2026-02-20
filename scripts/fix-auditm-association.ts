import prisma from '../src/lib/prisma';

async function fixAuditManagerAssociation() {
  try {
    // Find Abhishek (AuditHead)
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true }
    });

    if (!abhishek) {
      console.log('Error: Abhishek (AuditHead) not found');
      return;
    }

    console.log('Abhishek (AuditHead) ID:', abhishek.id);

    // Update auditm to associate with Abhishek
    const updatedUser = await prisma.user.update({
      where: { userName: 'auditm' },
      data: {
        auditHeadId: abhishek.id
      },
      include: {
        userRoles: {
          include: { role: true }
        },
        auditHead: {
          select: { id: true, fullName: true }
        }
      }
    });

    console.log('\n✓ Successfully updated auditm user:');
    console.log('  Username:', updatedUser.userName);
    console.log('  Full Name:', updatedUser.fullName);
    console.log('  Audit Head ID:', updatedUser.auditHeadId);
    console.log('  Audit Head:', updatedUser.auditHead?.fullName);
    console.log('  Roles:', updatedUser.userRoles.map(ur => ur.role.name).join(', '));
    console.log('\nauditm is now associated with Abhishek and should appear in the User Management page!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAuditManagerAssociation();
