import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/evidence-requests - Get evidence requests for an engagement
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

      // Get evidence requests for this engagement
      const evidenceRequests = await prisma.fieldworkEvidenceRequest.findMany({
        where: { engagementId },
        include: {
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform to expected format (include attachmentCount for AI Review / simple_ingest)
      const transformed = evidenceRequests.map(er => ({
        id: er.id,
        title: er.title,
        description: er.description || '',
        status: er.status,
        dueDate: er.dueDate?.toISOString() || null,
        auditee: er.auditeeName || '',
        auditeeId: er.auditeeId || null,
        numberOfSamples: er.sampleSize || null,
        attachmentCount: er.attachments?.length ?? 0,
      }));

      return NextResponse.json(transformed);
    } catch (error) {
      console.error('Error fetching evidence requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch evidence requests' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/evidence-requests - Create a new evidence request
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

      // Get auditee name if auditeeId provided
      let auditeeName = body.auditee || null;
      if (body.auditeeId) {
        const auditee = await prisma.user.findUnique({
          where: { id: body.auditeeId },
          select: { firstName: true, lastName: true },
        });
        if (auditee) {
          auditeeName = `${auditee.firstName} ${auditee.lastName}`;
        }
      }

      // Create evidence request
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.create({
        data: {
          engagementId,
          title: body.title,
          description: body.description || null,
          status: body.status || 'Pending',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          auditeeId: body.auditeeId || null,
          auditeeName: auditeeName,
          sampleSize: body.numberOfSamples ? String(body.numberOfSamples) : null,
        },
      });

      return NextResponse.json({
        id: evidenceRequest.id,
        title: evidenceRequest.title,
        description: evidenceRequest.description || '',
        status: evidenceRequest.status,
        dueDate: evidenceRequest.dueDate?.toISOString() || null,
        auditee: evidenceRequest.auditeeName || '',
        auditeeId: evidenceRequest.auditeeId || null,
        numberOfSamples: evidenceRequest.sampleSize || null,
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to create evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
