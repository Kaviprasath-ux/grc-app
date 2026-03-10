import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/asr-assessments — List all assessments for the customer (assessor view)
// Returns all assessments visible to assessors: unassigned + assigned to any assessor
export const GET = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '200');
      console.log(`[ASR] GET /asr-assessments — user=${session.email} limit=${limit}`);

      const assessments = await prisma.tPRMAssessment.findMany({
        where: { customerAccountId, assessmentType: { not: "Offboard Assessment" } },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true } },
          initiatedBy: { select: { id: true, fullName: true } },
          assessor: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      console.log(`[ASR] GET /asr-assessments — OK, returned ${assessments.length} assessments`);
      return NextResponse.json({ data: assessments });
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);
