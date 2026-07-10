import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, getTenantFilter, type AuthenticatedRequest } from '@/lib/api-auth';

type Session = AuthenticatedRequest['user'];

const SUPPORT_ROLE_NAMES = [
  'SupportAgentL1',
  'SupportSpecialistL2',
  'SupportEngineerL3',
  'SupportManager',
  'CustomerAdministrator',
];

// List users who can be assigned support tickets (support-role holders) within
// the tenant. Powers the assignment dropdown in the Agent Console.
export const GET = withAuth(
  async (_req: NextRequest, _ctx, session: Session) => {
    const agents = await prisma.user.findMany({
      where: {
        ...getTenantFilter(session),
        isActive: true,
        userRoles: { some: { role: { name: { in: SUPPORT_ROLE_NAMES } } } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { fullName: 'asc' },
    });

    const result = agents.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      roles: a.userRoles.map((ur) => ur.role.name).filter((n) => SUPPORT_ROLE_NAMES.includes(n)),
    }));

    return NextResponse.json({ agents: result });
  },
  { resource: 'support.tickets', action: 'view' },
);
