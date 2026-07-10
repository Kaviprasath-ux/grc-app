import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';

// Strip the (encrypted) fileData blob from attachments — return metadata only.
function stripAttachmentBlob(att: {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
  createdAt: Date;
}) {
  return {
    id: att.id,
    fileName: att.fileName,
    fileType: att.fileType,
    fileSize: att.fileSize,
    filePath: att.filePath,
    uploadedBy: att.uploadedBy,
    uploadedByName: att.uploadedByName,
    uploadedAt: att.uploadedAt,
    createdAt: att.createdAt,
  };
}

// GET /api/internal-audit/engagements/[id]/apm - Get the APM for an engagement
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const apm = await prisma.auditEngagementAPM.findUnique({
        where: { engagementId: id },
        include: {
          attachments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!apm) {
        return NextResponse.json(null);
      }

      // Strip fileData blobs from attachments before returning
      const { attachments, ...apmRest } = apm;
      return NextResponse.json({
        ...apmRest,
        attachments: attachments.map(stripAttachmentBlob),
      });
    } catch (error) {
      console.error('Error fetching engagement APM:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement APM' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PUT /api/internal-audit/engagements/[id]/apm - Upsert the APM for an engagement
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: 'User does not have a customer account assigned' },
          { status: 400 }
        );
      }
      const customerAccountId = getCustomerAccountId(session);

      const {
        scope,
        objectives,
        methodology,
        timeline,
        programOverview,
        content,
        startDate,
        endDate,
        status,
      } = body;

      const startDateValue = startDate ? new Date(startDate) : null;
      const endDateValue = endDate ? new Date(endDate) : null;
      const programOverviewValue =
        programOverview && typeof programOverview === 'object'
          ? JSON.stringify(programOverview)
          : null;
      // Full 17-section memorandum content (ApmContent). Only update when
      // provided so callers that save just the program overview don't wipe it.
      const hasContent = content !== undefined;
      const contentValue =
        content && typeof content === 'object' ? JSON.stringify(content) : null;

      const apm = await prisma.auditEngagementAPM.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          scope: scope ?? null,
          objectives: objectives ?? null,
          methodology: methodology ?? null,
          timeline: timeline ?? null,
          programOverview: programOverviewValue,
          content: contentValue,
          startDate: startDateValue,
          endDate: endDateValue,
          status: status ?? 'Draft',
          createdById: session.id,
          createdByName: session.name || null,
        },
        update: {
          scope: scope ?? null,
          objectives: objectives ?? null,
          methodology: methodology ?? null,
          timeline: timeline ?? null,
          // Only overwrite a field when the caller actually sent it, so saving
          // one part of the APM (overview vs full memorandum) never wipes the other.
          ...(programOverview !== undefined ? { programOverview: programOverviewValue } : {}),
          ...(hasContent ? { content: contentValue } : {}),
          ...(startDate !== undefined ? { startDate: startDateValue } : {}),
          ...(endDate !== undefined ? { endDate: endDateValue } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });

      return NextResponse.json(apm);
    } catch (error) {
      console.error('Error saving engagement APM:', error);
      return NextResponse.json(
        { error: 'Failed to save engagement APM' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
