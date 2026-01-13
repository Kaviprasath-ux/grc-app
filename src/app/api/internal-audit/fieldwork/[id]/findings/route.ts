import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper to generate finding ID
async function generateFindingId(): Promise<string> {
  const lastFinding = await prisma.internalAuditFinding.findFirst({
    orderBy: { findingId: 'desc' },
    select: { findingId: true },
  });

  if (!lastFinding) {
    return 'FND001';
  }

  const lastNum = parseInt(lastFinding.findingId.replace('FND', ''), 10);
  const nextNum = lastNum + 1;
  return `FND${nextNum.toString().padStart(3, '0')}`;
}

// GET /api/internal-audit/fieldwork/[id]/findings - Get findings for an engagement
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Get findings for this engagement
      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId },
        include: {
          department: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform to expected format
      const transformed = findings.map(f => ({
        id: f.id,
        findingId: f.findingId,
        title: f.finding,
        description: f.description || '',
        severity: f.severity,
        status: f.status,
        departmentId: f.departmentId,
        departmentName: f.department?.name || '',
        responsiblePerson: f.responsiblePerson || '',
        responsiblePersonId: f.responsiblePersonId || '',
        identifiedDate: f.identifiedDate?.toISOString() || null,
        targetDate: f.targetDate?.toISOString() || null,
        closedDate: f.closedDate?.toISOString() || null,
        // New audit finding fields
        criteria: f.criteria || '',
        condition: f.condition || '',
        cause: f.cause || '',
        effect: f.effect || '',
        recommendation: f.recommendation || '',
      }));

      return NextResponse.json(transformed);
    } catch (error) {
      console.error('Error fetching findings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch findings' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/findings - Create a new finding
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;
      const body = await req.json();

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Generate finding ID
      const findingId = await generateFindingId();

      // Get responsible person name if ID provided
      let responsiblePersonName = body.responsiblePerson || null;
      if (body.responsiblePersonId && !responsiblePersonName) {
        const user = await prisma.user.findUnique({
          where: { id: body.responsiblePersonId },
          select: { fullName: true, firstName: true, lastName: true },
        });
        if (user) {
          responsiblePersonName = user.fullName || `${user.firstName} ${user.lastName}`;
        }
      }

      // Create finding with all fields
      const finding = await prisma.internalAuditFinding.create({
        data: {
          findingId,
          engagementId,
          finding: body.title,
          description: body.description || null,
          severity: body.severity || 'Medium',
          status: body.status || 'Open',
          departmentId: body.departmentId || null,
          responsiblePerson: responsiblePersonName,
          responsiblePersonId: body.responsiblePersonId || null,
          identifiedDate: body.identifiedDate ? new Date(body.identifiedDate) : new Date(),
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
          // New fields for audit findings
          criteria: body.criteria || null,
          condition: body.condition || null,
          cause: body.cause || null,
          effect: body.effect || null,
          recommendation: body.recommendation || null,
        },
        include: {
          department: true,
        },
      });

      return NextResponse.json({
        id: finding.id,
        findingId: finding.findingId,
        title: finding.finding,
        description: finding.description || '',
        severity: finding.severity,
        status: finding.status,
        departmentId: finding.departmentId,
        departmentName: finding.department?.name || '',
        responsiblePerson: finding.responsiblePerson || '',
        responsiblePersonId: finding.responsiblePersonId || '',
        identifiedDate: finding.identifiedDate?.toISOString() || null,
        targetDate: finding.targetDate?.toISOString() || null,
        // New audit finding fields
        criteria: finding.criteria || '',
        condition: finding.condition || '',
        cause: finding.cause || '',
        effect: finding.effect || '',
        recommendation: finding.recommendation || '',
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating finding:', error);
      return NextResponse.json(
        { error: 'Failed to create finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
