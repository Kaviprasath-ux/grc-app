import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';

// Resolve a readable name from an auditee-like relation, falling back to "Management".
function resolveAuditeeName(auditee: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!auditee) return 'Management';
  const composed = `${auditee.firstName || ''} ${auditee.lastName || ''}`.trim();
  return auditee.fullName || composed || 'Management';
}

// Resolve a readable name for the assigned auditor, falling back to "[Audit Team]".
function resolveAuditorName(auditor: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!auditor) return '[Audit Team]';
  const composed = `${auditor.firstName || ''} ${auditor.lastName || ''}`.trim();
  return auditor.fullName || composed || '[Audit Team]';
}

// Format a date as a readable string (e.g. "1 January 2026"), else "[Date]".
function formatCommenceDate(date: Date | null): string {
  if (!date) return '[Date]';
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// GET /api/internal-audit/engagements/[id]/announcement - Get or generate the announcement draft
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant (with relations for the default template)
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: { select: { name: true } },
          auditee: {
            select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
          },
          assignedAuditor: {
            select: { fullName: true, firstName: true, lastName: true },
          },
        },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const existing = await prisma.auditEngagementAnnouncement.findUnique({
        where: { engagementId: id },
      });

      if (existing) {
        return NextResponse.json(existing);
      }

      // Build a generated default draft (NOT persisted)
      const engagementTitle = engagement.engagementTitle || engagement.auditId;
      const auditeeName = resolveAuditeeName(engagement.auditee);
      const departmentLabel = engagement.department?.name || engagementTitle;
      const auditorName = resolveAuditorName(engagement.assignedAuditor);
      const commenceDate = engagement.plannedStartDate;
      const commenceDateLabel = formatCommenceDate(commenceDate);

      const subject = `Internal Audit Announcement — ${engagementTitle}`;
      const body = `Dear ${auditeeName},

In line with the approved Internal Audit Plan, we will be conducting an audit of ${departmentLabel}.

The objective of this engagement is to assess the adequacy and effectiveness of governance, risk management, and internal controls.

The audit is scheduled to commence on ${commenceDateLabel}.

The Audit Engagement Team comprises the following:
- ${auditorName}

Kindly find attached the Preliminary Information Request List to facilitate the audit process.

We appreciate your cooperation and remain available for any clarification.

Kind Regards,
Head of Internal Audit`;

      return NextResponse.json({
        id: null,
        engagementId: id,
        recipientName: engagement.auditee ? auditeeName : null,
        recipientEmail: engagement.auditee?.email || null,
        subject,
        body,
        commenceDate,
        status: 'Draft',
        sentAt: null,
        sentById: null,
        sentByName: null,
      });
    } catch (error) {
      console.error('Error fetching engagement announcement:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement announcement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PUT /api/internal-audit/engagements/[id]/announcement - Upsert the announcement draft
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

      const { recipientName, recipientEmail, subject, body: announcementBody, commenceDate } = body;
      const commenceDateValue = commenceDate ? new Date(commenceDate) : null;

      const announcement = await prisma.auditEngagementAnnouncement.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          recipientName: recipientName ?? null,
          recipientEmail: recipientEmail ?? null,
          subject: subject ?? null,
          body: announcementBody ?? null,
          commenceDate: commenceDateValue,
          status: 'Draft',
          createdById: session.id,
          createdByName: session.name || null,
        },
        update: {
          recipientName: recipientName ?? null,
          recipientEmail: recipientEmail ?? null,
          subject: subject ?? null,
          body: announcementBody ?? null,
          commenceDate: commenceDateValue,
        },
      });

      return NextResponse.json(announcement);
    } catch (error) {
      console.error('Error saving engagement announcement:', error);
      return NextResponse.json(
        { error: 'Failed to save engagement announcement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
