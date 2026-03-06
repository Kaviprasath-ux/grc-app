import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/asr-assessments/approvers — List approvers for the customer
export const GET = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      console.log(`[ASR] GET /asr-assessments/approvers — user=${session.email}`);

      const approvers = await prisma.user.findMany({
        where: {
          customerAccountId,
          isActive: true,
          OR: [
            { role: 'TPRMApprover' },
            { tprmRole: 'Approver' },
          ],
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      });

      console.log(`[ASR] GET /asr-assessments/approvers — OK, found ${approvers.length} approvers`);
      return NextResponse.json(approvers);
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments/approvers — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch approvers' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);
