import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/capa - Get CAPA list
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      const whereClause: Record<string, unknown> = {};

      // For Auditee, only show CAPAs where they are the responsible person
      if (isAuditee) {
        whereClause.finding = {
          responsiblePersonId: session.id
        };
      }

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (search) {
        const searchFilter = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { capaId: { contains: search, mode: 'insensitive' } },
          { finding: { findingId: { contains: search, mode: 'insensitive' } } },
        ];

        if (whereClause.OR) {
          whereClause.AND = [
            { OR: whereClause.OR },
            { OR: searchFilter }
          ];
          delete whereClause.OR;
        } else {
          whereClause.OR = searchFilter;
        }
      }

      const capas = await prisma.internalAuditCAPA.findMany({
        where: whereClause,
        include: {
          finding: {
            select: {
              id: true,
              findingId: true,
              finding: true,
              severity: true,
              department: { select: { id: true, name: true } },
              engagement: {
                select: {
                  id: true,
                  auditId: true,
                  engagementTitle: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(capas);
    } catch (error) {
      console.error('Error fetching CAPAs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAPAs' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'view' }
);
