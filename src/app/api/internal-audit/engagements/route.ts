import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/engagements - Get all audit engagements
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const url = new URL(req.url);
      const departmentId = url.searchParams.get('departmentId');
      const status = url.searchParams.get('status');
      const year = url.searchParams.get('year');
      const search = url.searchParams.get('search');

      const whereClause: Record<string, unknown> = {};

      if (departmentId && departmentId !== 'all') {
        whereClause.departmentId = departmentId;
      }

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (year && year !== 'all') {
        const yearNum = parseInt(year);
        whereClause.OR = [
          { startDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } },
          { endDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } }
        ];
      }

      if (search) {
        whereClause.OR = [
          { auditId: { contains: search } },
          { engagementTitle: { contains: search } }
        ];
      }

      const engagements = await prisma.auditEngagement.findMany({
        where: whereClause,
        include: {
          department: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get assigned auditors for each engagement
      const engagementsWithAuditors = await Promise.all(
        engagements.map(async (engagement) => {
          const fieldworkItems = await prisma.fieldworkEvidenceRequest.findMany({
            where: { engagementId: engagement.id },
            select: {
              auditeeName: true
            },
            distinct: ['auditeeName']
          });

          const auditors = fieldworkItems
            .map(item => item.auditeeName)
            .filter(Boolean);

          return {
            ...engagement,
            assignedAuditors: auditors
          };
        })
      );

      return NextResponse.json(engagementsWithAuditors);
    } catch (error) {
      console.error('Error fetching engagements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagements' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);

// POST /api/internal-audit/engagements - Create a new audit engagement
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();

      const {
        engagementTitle,
        departmentId,
        auditType,
        startDate,
        endDate,
        plannedHours,
        description
      } = body;

      // Generate audit ID
      const count = await prisma.auditEngagement.count();
      const auditId = String(count + 1).padStart(4, '0');

      const engagement = await prisma.auditEngagement.create({
        data: {
          auditId,
          engagementTitle,
          departmentId,
          auditType: auditType || 'Internal Audit',
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          plannedHours: plannedHours || 0,
          actualHours: 0,
          status: 'Planned'
        },
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
      });

      return NextResponse.json(engagement, { status: 201 });
    } catch (error) {
      console.error('Error creating engagement:', error);
      return NextResponse.json(
        { error: 'Failed to create engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'create' }
);
