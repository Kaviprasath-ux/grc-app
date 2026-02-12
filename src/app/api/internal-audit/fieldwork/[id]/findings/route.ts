import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId, getTenantFilter } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper to generate finding ID - scoped to customer account
async function generateFindingId(customerAccountId: string): Promise<string> {
  // Get all findings for this customer to find the highest number
  const findings = await prisma.internalAuditFinding.findMany({
    where: { customerAccountId },
    select: { findingId: true },
  });

  if (findings.length === 0) {
    return 'FND001';
  }

  // Extract numbers and find the maximum
  const numbers = findings
    .map(f => parseInt(f.findingId.replace('FND', ''), 10))
    .filter(n => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  return `FND${nextNum.toString().padStart(3, '0')}`;
}

// GET /api/internal-audit/fieldwork/[id]/findings - Get findings for an engagement
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id: engagementId } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId, ...tenantFilter },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Get findings for this engagement
      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId, ...tenantFilter },
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
  async (req, context: RouteContext, session) => {
    try {
      const { id: engagementId } = await context.params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Get customer account ID - handle missing customerAccountId gracefully
      let customerAccountId: string;
      try {
        customerAccountId = getCustomerAccountId(session);
      } catch (error) {
        console.error('User does not have customerAccountId:', session.id, session.roles);
        return NextResponse.json(
          { error: 'User account not properly configured. Please contact administrator.' },
          { status: 400 }
        );
      }

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId, ...tenantFilter },
      });

      if (!engagement) {
        console.error('Engagement not found:', engagementId, 'tenantFilter:', tenantFilter);
        return NextResponse.json(
          { error: 'Engagement not found or access denied' },
          { status: 404 }
        );
      }

      // Generate finding ID - scoped to customer account
      const findingId = await generateFindingId(customerAccountId);

      // Get audit head ID
      const auditHeadId = getAuditHeadId(session);

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
          customerAccountId,
          auditHeadId,
        },
        include: {
          department: true,
        },
      });

      // Send FINDINGS_CREATED notification to the Audit Head
      if (auditHeadId && auditHeadId !== session.id) {
        await notificationService.send({
          customerAccountId,
          actorId: session.id,
          recipientId: auditHeadId,
          event: NOTIFICATION_EVENTS.FINDINGS_CREATED,
          title: 'New Finding Created',
          message: `A new finding "${finding.findingId}: ${finding.finding}" has been created for engagement ${engagement.auditId}.`,
          relatedEntityType: 'finding',
          relatedEntityId: finding.id,
          link: `/internal-audit/fieldwork/${engagementId}/findings`,
          metadata: {
            findingId: finding.findingId,
            findingTitle: finding.finding,
            severity: finding.severity,
            engagementId: engagement.auditId,
            createdBy: session.name || 'User',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // Send CAPA_ASSIGNED notification if a responsible person was assigned
      if (finding.responsiblePersonId && finding.responsiblePersonId !== session.id) {
        await notificationService.notifyCAPAAssigned({
          customerAccountId,
          actorId: session.id,
          assigneeId: finding.responsiblePersonId,
          capaId: finding.id,
          capaCode: finding.findingId,
          capaTitle: finding.finding,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to create finding: ${errorMessage}` },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
