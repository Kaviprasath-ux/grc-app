import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/findings/[findingId] - Get a specific finding
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, findingId } = await context.params;

      // Get finding with tenant validation
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        include: {
          department: true,
        },
      });

      if (!finding || finding.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, finding.customerAccountId)) {
        return forbidden("Access denied to this finding");
      }

      return NextResponse.json({
        id: finding.id,
        findingId: finding.findingId,
        title: finding.finding,
        description: finding.description || '',
        severity: finding.severity,
        findingType: finding.findingType || '',
        status: finding.status,
        departmentId: finding.departmentId,
        departmentName: finding.department?.name || '',
        responsiblePerson: finding.responsiblePerson || '',
        responsiblePersonId: finding.responsiblePersonId || '',
        identifiedDate: finding.identifiedDate?.toISOString() || null,
        targetDate: finding.targetDate?.toISOString() || null,
        closedDate: finding.closedDate?.toISOString() || null,
        // New audit finding fields
        criteria: finding.criteria || '',
        condition: finding.condition || '',
        cause: finding.cause || '',
        effect: finding.effect || '',
        recommendation: finding.recommendation || '',
      });
    } catch (error) {
      console.error('Error fetching finding:', error);
      return NextResponse.json(
        { error: 'Failed to fetch finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PATCH /api/internal-audit/fieldwork/[id]/findings/[findingId] - Update a finding
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, findingId } = await context.params;
      const body = await req.json();

      // Verify finding exists and belongs to engagement
      const existingFinding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!existingFinding || existingFinding.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingFinding.customerAccountId)) {
        return forbidden("Access denied to this finding");
      }

      // Get responsible person name if ID provided
      let responsiblePersonName = body.responsiblePerson || existingFinding.responsiblePerson;
      if (body.responsiblePersonId && body.responsiblePersonId !== existingFinding.responsiblePersonId) {
        const user = await prisma.user.findUnique({
          where: { id: body.responsiblePersonId },
          select: { fullName: true, firstName: true, lastName: true },
        });
        if (user) {
          responsiblePersonName = user.fullName || `${user.firstName} ${user.lastName}`;
        }
      }

      // Determine closed date
      let closedDate = existingFinding.closedDate;
      if (body.status === 'Closed' && existingFinding.status !== 'Closed') {
        closedDate = new Date();
      } else if (body.status !== 'Closed' && existingFinding.status === 'Closed') {
        closedDate = null;
      }

      // Update finding
      const updatedFinding = await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: {
          finding: body.title !== undefined ? body.title : existingFinding.finding,
          description: body.description !== undefined ? body.description : existingFinding.description,
          severity: body.severity || existingFinding.severity,
          findingType: body.findingType !== undefined ? body.findingType : existingFinding.findingType,
          status: body.status || existingFinding.status,
          departmentId: body.departmentId !== undefined ? (body.departmentId || null) : existingFinding.departmentId,
          responsiblePerson: responsiblePersonName,
          responsiblePersonId: body.responsiblePersonId !== undefined ? (body.responsiblePersonId || null) : existingFinding.responsiblePersonId,
          identifiedDate: body.identifiedDate ? new Date(body.identifiedDate) : existingFinding.identifiedDate,
          targetDate: body.targetDate ? new Date(body.targetDate) : (body.targetDate === null ? null : existingFinding.targetDate),
          closedDate: closedDate,
          // New audit finding fields
          criteria: body.criteria !== undefined ? body.criteria : existingFinding.criteria,
          condition: body.condition !== undefined ? body.condition : existingFinding.condition,
          cause: body.cause !== undefined ? body.cause : existingFinding.cause,
          effect: body.effect !== undefined ? body.effect : existingFinding.effect,
          recommendation: body.recommendation !== undefined ? body.recommendation : existingFinding.recommendation,
        },
        include: {
          department: true,
        },
      });

      // Send CAPA_ASSIGNED notification if responsible person was changed to a different user
      const newAssigneeId = updatedFinding.responsiblePersonId;
      const oldAssigneeId = existingFinding.responsiblePersonId;
      if (
        newAssigneeId &&
        newAssigneeId !== oldAssigneeId &&
        newAssigneeId !== session.id &&
        existingFinding.customerAccountId
      ) {
        await notificationService.notifyCAPAAssigned({
          customerAccountId: existingFinding.customerAccountId,
          actorId: session.id,
          assigneeId: newAssigneeId,
          capaId: updatedFinding.id,
          capaCode: updatedFinding.findingId,
          capaTitle: updatedFinding.finding,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // Fire-and-forget: translate finding fields
      if (existingFinding.customerAccountId) void translateRecord(existingFinding.customerAccountId, 'InternalAuditFinding', updatedFinding.id, { title: updatedFinding.finding, description: updatedFinding.description, recommendation: updatedFinding.recommendation, criteria: updatedFinding.criteria, condition: updatedFinding.condition, cause: updatedFinding.cause, effect: updatedFinding.effect });

      return NextResponse.json({
        id: updatedFinding.id,
        findingId: updatedFinding.findingId,
        title: updatedFinding.finding,
        description: updatedFinding.description || '',
        severity: updatedFinding.severity,
        findingType: updatedFinding.findingType || '',
        status: updatedFinding.status,
        departmentId: updatedFinding.departmentId,
        departmentName: updatedFinding.department?.name || '',
        responsiblePerson: updatedFinding.responsiblePerson || '',
        responsiblePersonId: updatedFinding.responsiblePersonId || '',
        identifiedDate: updatedFinding.identifiedDate?.toISOString() || null,
        targetDate: updatedFinding.targetDate?.toISOString() || null,
        closedDate: updatedFinding.closedDate?.toISOString() || null,
        // New audit finding fields
        criteria: updatedFinding.criteria || '',
        condition: updatedFinding.condition || '',
        cause: updatedFinding.cause || '',
        effect: updatedFinding.effect || '',
        recommendation: updatedFinding.recommendation || '',
      });
    } catch (error) {
      console.error('Error updating finding:', error);
      return NextResponse.json(
        { error: 'Failed to update finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/fieldwork/[id]/findings/[findingId] - Delete a finding
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, findingId } = await context.params;

      // Verify finding exists and belongs to engagement
      const existingFinding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!existingFinding || existingFinding.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existingFinding.customerAccountId)) {
        return forbidden("Access denied to this finding");
      }

      // Delete finding
      await prisma.internalAuditFinding.delete({
        where: { id: findingId },
      });

      // Fire-and-forget: delete translations for removed finding
      if (existingFinding.customerAccountId) void deleteRecordTranslations(existingFinding.customerAccountId, 'InternalAuditFinding', findingId);

      return NextResponse.json({ message: 'Finding deleted successfully' });
    } catch (error) {
      console.error('Error deleting finding:', error);
      return NextResponse.json(
        { error: 'Failed to delete finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);
