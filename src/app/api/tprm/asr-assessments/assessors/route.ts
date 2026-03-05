import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/asr-assessments/assessors — List assessors for the customer
export const GET = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      console.log(`[ASR] GET /asr-assessments/assessors — user=${session.email}`);

      const assessors = await prisma.user.findMany({
        where: {
          customerAccountId,
          isActive: true,
          OR: [
            { role: 'TPRMAssessor' },
            { tprmRole: 'Assessor' },
          ],
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      });

      console.log(`[ASR] GET /asr-assessments/assessors — OK, found ${assessors.length} assessors`);
      return NextResponse.json(assessors);
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments/assessors — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch assessors' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);
