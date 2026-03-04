import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/am-assessments — List assessments for AM's vendor(s)
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const tab = searchParams.get('tab') || 'active'; // active, submitted, past, offboard
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Find vendors where this user is the Account Manager (by email, case-insensitive)
      const userEmail = session.email?.toLowerCase();
      if (!userEmail) {
        return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }

      const vendors = await prisma.tPRMVendor.findMany({
        where: {
          customerAccountId,
          accountManagerEmail: { contains: userEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });

      const vendorIds = vendors.map(v => v.id);
      if (vendorIds.length === 0) {
        return NextResponse.json({ data: [], pagination: { total: 0, limit, offset, hasMore: false } });
      }

      // Build status filter based on tab
      let statusFilter: string[] = [];
      switch (tab) {
        case 'active':
          statusFilter = ['Draft', 'In Progress', 'Returned'];
          break;
        case 'submitted':
          statusFilter = ['Submitted', 'Under Review'];
          break;
        case 'past':
          statusFilter = ['Completed', 'Approved', 'Rejected', 'Reviewed'];
          break;
        case 'offboard':
          statusFilter = ['Cancelled', 'Expired'];
          break;
      }

      // Override with explicit status if provided
      if (status) {
        statusFilter = [status];
      }

      const where: Record<string, unknown> = {
        customerAccountId,
        vendorId: { in: vendorIds },
        ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
      };

      if (search) {
        where.OR = [
          { assessmentCode: { contains: search, mode: 'insensitive' } },
          { vendor: { name: { contains: search, mode: 'insensitive' } } },
          { questionnaireTemplate: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [assessments, total] = await Promise.all([
        prisma.tPRMAssessment.findMany({
          where,
          include: {
            vendor: { select: { id: true, name: true, vendorCode: true } },
            initiatedBy: { select: { id: true, fullName: true } },
            assessor: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.tPRMAssessment.count({ where }),
      ]);

      return NextResponse.json({
        data: assessments,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    } catch (error) {
      console.error('AM Assessments GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'view' }
);
