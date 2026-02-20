import prisma from '../src/lib/prisma';

async function findUser() {
  try {
    const user = await prisma.user.findFirst({
      where: { userName: 'auditm' },
      include: {
        userRoles: {
          include: { role: true }
        },
        auditHead: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (user) {
      console.log('User found:');
      console.log('ID:', user.id);
      console.log('Username:', user.userName);
      console.log('Full Name:', user.fullName);
      console.log('Email:', user.email);
      console.log('Audit Head ID:', user.auditHeadId);
      console.log('Audit Head:', user.auditHead);
      console.log('Roles:', user.userRoles.map(ur => ur.role.name).join(', '));
      console.log('Customer Account ID:', user.customerAccountId);
    } else {
      console.log('User "auditm" not found in database');
    }

    // Also find Abhishek to see his ID
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true }
    });
    console.log('\nAbhishek (AuditHead):');
    console.log('ID:', abhishek?.id);
    console.log('Full Name:', abhishek?.fullName);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();
