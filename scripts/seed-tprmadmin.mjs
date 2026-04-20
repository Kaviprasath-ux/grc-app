import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const TENANT_ID = 'cmma8yemp0001tsfuwz6psruz'; // GRC_002
const USERNAME = 'tprmadmin';
const EMAIL = 'tprmadmin@e2etest.local';
const PASSWORD = '1';
const FULL_NAME = 'TPRM Admin E2E';
const ROLE_NAME = 'TPRMAdmin';

const prisma = new PrismaClient();

try {
  // 1) Upsert the TPRMAdmin role
  const role = await prisma.role.upsert({
    where: { name: ROLE_NAME },
    update: {},
    create: { name: ROLE_NAME, description: 'TPRM super-admin (chatbot E2E)', isSystem: true },
  });
  console.log(`role: id=${role.id} name=${role.name}`);

  // 2) Upsert the user by userName
  const hash = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.user.findFirst({ where: { userName: { equals: USERNAME, mode: 'insensitive' } }, select: { id: true, customerAccountId: true } });

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: EMAIL,
        fullName: FULL_NAME,
        firstName: 'TPRM',
        lastName: 'Admin',
        password: hash,
        isActive: true,
        isBlocked: false,
        customerAccountId: TENANT_ID,
        role: ROLE_NAME,
      },
      select: { id: true, userName: true, email: true, customerAccountId: true },
    });
    console.log(`user UPDATED: id=${user.id}`);
  } else {
    user = await prisma.user.create({
      data: {
        userName: USERNAME,
        email: EMAIL,
        fullName: FULL_NAME,
        firstName: 'TPRM',
        lastName: 'Admin',
        password: hash,
        isActive: true,
        isBlocked: false,
        customerAccountId: TENANT_ID,
        role: ROLE_NAME,
      },
      select: { id: true, userName: true, email: true, customerAccountId: true },
    });
    console.log(`user CREATED: id=${user.id}`);
  }

  // 3) Link user to role via UserRole
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  console.log(`userRole linked: user=${user.id} role=${role.id}`);

  // 4) Verify
  const verify = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      userName: true, email: true, isActive: true, customerAccountId: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });
  console.log('verify:', JSON.stringify(verify));
} finally {
  await prisma.$disconnect();
}
