import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';
import { ENGAGEMENT_STAGE_KEYS } from '@/lib/audit-engagement-stages';

// GET /api/internal-audit/engagements/[id] - Get a single engagement
// Uses audit.fieldwork:view to allow auditees to view engagement details
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: {
            select: { id: true, name: true }
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true, fullName: true }
          },
          auditee: {
            select: { id: true, firstName: true, lastName: true, fullName: true }
          },
          report: { select: { id: true } },
        }
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(engagement);
    } catch (error) {
      console.error('Error fetching engagement:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PUT /api/internal-audit/engagements/[id] - Update an engagement
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant (include current assignments for change detection)
      const existingEngagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, assignedAuditorId: true, auditeeId: true },
      });

      if (!existingEngagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const {
        engagementTitle,
        engagementObjective,
        engagementScope,
        departmentId,
        auditType,
        auditRating,
        auditCategoryId,
        auditorId,
        auditeeId,
        startDate,
        targetDate,
        plannedHours,
        initialObservation,
        relatedPolicies,
        status,
        tasks
      } = body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (engagementTitle !== undefined) updateData.engagementTitle = engagementTitle;
      if (engagementObjective !== undefined) updateData.engagementObjective = engagementObjective;
      if (engagementScope !== undefined) updateData.engagementScope = engagementScope;
      if (departmentId !== undefined) updateData.departmentId = departmentId || null;
      if (auditType !== undefined) updateData.auditType = auditType;
      if (auditRating !== undefined) updateData.auditRating = auditRating;
      if (auditCategoryId !== undefined) updateData.auditCategoryId = auditCategoryId || null;
      if (auditorId !== undefined) updateData.assignedAuditorId = auditorId || null;
      if (auditeeId !== undefined) updateData.auditeeId = auditeeId || null;
      if (startDate !== undefined) {
        updateData.plannedStartDate = startDate ? new Date(startDate) : null;
        updateData.startDate = startDate ? new Date(startDate) : null;
      }
      if (targetDate !== undefined) {
        updateData.plannedEndDate = targetDate ? new Date(targetDate) : null;
        updateData.endDate = targetDate ? new Date(targetDate) : null;
      }
      if (plannedHours !== undefined) updateData.plannedHours = plannedHours || 0;
      if (initialObservation !== undefined) updateData.initialObservation = initialObservation;
      if (relatedPolicies !== undefined) updateData.relatedPolicies = relatedPolicies;
      if (status !== undefined) updateData.status = status;

      const engagement = await prisma.auditEngagement.update({
        where: { id },
        data: updateData,
        include: {
          department: {
            select: { id: true, name: true }
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true, fullName: true }
          },
          auditee: {
            select: { id: true, firstName: true, lastName: true, fullName: true }
          }
        }
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'AuditEngagement', engagement.id, { engagementTitle: engagement.engagementTitle, engagementObjective: engagement.engagementObjective, engagementScope: engagement.engagementScope, initialObservation: engagement.initialObservation, relatedPolicies: engagement.relatedPolicies });

      // Notify assigned auditor only if assignment actually changed
      if (auditorId && auditorId !== existingEngagement.assignedAuditorId && auditorId !== session.id && session.customerAccountId) {
        await notificationService.notifyEngagementAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          assigneeId: auditorId,
          engagementId: engagement.id,
          engagementCode: engagement.auditId,
          engagementName: engagement.engagementTitle || engagement.auditId,
          role: 'Auditor',
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }
      // Notify auditee only if assignment actually changed
      if (auditeeId && auditeeId !== existingEngagement.auditeeId && auditeeId !== session.id && session.customerAccountId) {
        await notificationService.notifyEngagementAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          assigneeId: auditeeId,
          engagementId: engagement.id,
          engagementCode: engagement.auditId,
          engagementName: engagement.engagementTitle || engagement.auditId,
          role: 'Auditee',
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json(engagement);
    } catch (error) {
      console.error('Error updating engagement:', error);
      return NextResponse.json(
        { error: 'Failed to update engagement', details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'edit' }
);

// PATCH /api/internal-audit/engagements/[id] - Partial update an engagement (e.g., status change)
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const existingEngagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existingEngagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Only allow specific fields to be updated via PATCH
      const updateData: Record<string, unknown> = {};

      if (body.status !== undefined) {
        updateData.status = body.status;
      }

      // If marking as completed, set actualEndDate if not already set
      if (body.status === 'Completed' && !existingEngagement.actualEndDate) {
        updateData.actualEndDate = new Date();
      }

      // Engagement lifecycle workflow (Phase 2) — validate stage key against the canonical list
      if (body.currentStage !== undefined) {
        if (!ENGAGEMENT_STAGE_KEYS.includes(body.currentStage)) {
          return NextResponse.json({ error: 'Invalid stage key' }, { status: 400 });
        }
        updateData.currentStage = body.currentStage;
      }

      if (body.reportingMode !== undefined) {
        if (body.reportingMode !== 'Continuous' && body.reportingMode !== 'Aggregated') {
          return NextResponse.json({ error: 'Invalid reporting mode' }, { status: 400 });
        }
        updateData.reportingMode = body.reportingMode;
      }

      if (body.stageProgress !== undefined) {
        // Keep only recognized stage keys with allowed statuses
        const cleaned: Record<string, string> = {};
        if (body.stageProgress && typeof body.stageProgress === 'object') {
          for (const [k, v] of Object.entries(body.stageProgress as Record<string, unknown>)) {
            if (ENGAGEMENT_STAGE_KEYS.includes(k) && (v === 'completed' || v === 'in_progress')) {
              cleaned[k] = v;
            }
          }
        }
        updateData.stageProgress = cleaned;
      }

      const engagement = await prisma.auditEngagement.update({
        where: { id },
        data: updateData,
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
      });

      return NextResponse.json(engagement);
    } catch (error) {
      console.error('Error updating engagement:', error);
      return NextResponse.json(
        { error: 'Failed to update engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/engagements/[id] - Delete an engagement
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const existingEngagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existingEngagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      await prisma.auditEngagement.delete({
        where: { id }
      });

      if (existingEngagement.customerAccountId) void deleteRecordTranslations(existingEngagement.customerAccountId, 'AuditEngagement', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting engagement:', error);
      return NextResponse.json(
        { error: 'Failed to delete engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'delete' }
);
