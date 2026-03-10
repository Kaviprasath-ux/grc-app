import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden, canAccessRecord } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper function to calculate risk rating based on score
// Rating values matching website: Catastrophic, Very high, High, Low Risk
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// GET a single risk by ID - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const risk = await prisma.risk.findFirst({
        where: { id, ...tenantFilter },
        include: {
          category: true,
          type: true,
          department: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          impactedAsset: {
            select: {
              id: true,
              assetId: true,
              name: true,
            },
          },
          impactedProcess: {
            select: {
              id: true,
              processCode: true,
              name: true,
            },
          },
          threats: {
            include: { threat: true },
          },
          vulnerabilities: {
            include: { vulnerability: true },
          },
          causes: {
            include: { cause: true },
          },
          controlRisks: {
            include: { control: true, controlStrength: true },
          },
          assessments: {
            orderBy: { assessmentDate: "desc" },
            take: 10,
          },
          responses: {
            orderBy: { createdAt: "desc" },
          },
          activityLogs: {
            where: { activity: "Sent Back" },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!risk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      // Check department scope access
      if (!canAccessRecord(session, "risk.register", "view", {
        departmentId: risk.departmentId,
        ownerId: risk.ownerId,
      })) {
        return forbidden("Access denied - this risk belongs to a different department");
      }

      return NextResponse.json(risk);
    } catch (error) {
      console.error("Error fetching risk:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "view" }
);

// PUT update a risk - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
    const {
      name,
      description,
      riskSources,
      categoryId,
      typeId,
      departmentId,
      ownerId,
      impactedAssetId,
      impactedProcessId,
      likelihood,
      impact,
      inherentLikelihood,
      inherentImpact,
      residualLikelihood,
      residualImpact,
      targetLikelihood,
      targetImpact,
      status,
      assessmentStatus,
      responseStrategy,
      responseStatus,
      treatmentPlan,
      treatmentDueDate,
      treatmentStatus,
      nextReviewDate,
      threats,
      vulnerabilities,
      causes,
      controls,
      riskRating,
      lastAssessmentDate,
      assessmentFormData,
    } = body;

      // Check if risk exists and verify tenant access
      const existingRisk = await prisma.risk.findUnique({
        where: { id },
        select: { customerAccountId: true, likelihood: true, impact: true, departmentId: true, ownerId: true },
      });
      if (!existingRisk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied to this risk");
      }

      // Check department scope access for edit
      if (!canAccessRecord(session, "risk.register", "edit", {
        departmentId: existingRisk.departmentId,
        ownerId: existingRisk.ownerId,
      })) {
        return forbidden("Access denied - this risk belongs to a different department");
      }

      // Calculate scores
      const newLikelihood = likelihood ?? existingRisk.likelihood;
    const newImpact = impact ?? existingRisk.impact;
    const riskScore = newLikelihood * newImpact;
    const calculatedRiskRating = calculateRiskRating(riskScore);

    // Build update data
    const updateData: Record<string, unknown> = {
      name,
      description,
      riskSources,
      categoryId,
      typeId,
      departmentId,
      ownerId,
      impactedAssetId,
      impactedProcessId,
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore,
      riskRating: riskRating || calculatedRiskRating,
      status,
      assessmentStatus,
      responseStrategy,
      treatmentPlan,
      treatmentStatus,
    };

    if (inherentLikelihood !== undefined) updateData.inherentLikelihood = inherentLikelihood;
    if (inherentImpact !== undefined) updateData.inherentImpact = inherentImpact;
    if (body.inherentRiskScore !== undefined) updateData.inherentRiskScore = body.inherentRiskScore;
    if (residualLikelihood !== undefined) updateData.residualLikelihood = residualLikelihood;
    if (residualImpact !== undefined) updateData.residualImpact = residualImpact;
    if (body.residualRiskScore !== undefined) updateData.residualRiskScore = body.residualRiskScore;
    if (targetLikelihood !== undefined) updateData.targetLikelihood = targetLikelihood;
    if (targetImpact !== undefined) updateData.targetImpact = targetImpact;

    if (responseStatus !== undefined) {
      updateData.responseStatus = responseStatus;
    }

    // Handle assessmentFormData (JSON string)
    if (assessmentFormData !== undefined) {
      updateData.assessmentFormData = assessmentFormData;
    }

    // Handle optional date fields
    if (treatmentDueDate !== undefined) {
      updateData.treatmentDueDate = treatmentDueDate ? new Date(treatmentDueDate) : null;
    }
    if (nextReviewDate !== undefined) {
      updateData.nextReviewDate = nextReviewDate ? new Date(nextReviewDate) : null;
    }
    if (lastAssessmentDate !== undefined) {
      updateData.lastAssessmentDate = lastAssessmentDate ? new Date(lastAssessmentDate) : null;
    }

    // Handle target scores
    if (targetLikelihood !== undefined && targetImpact !== undefined) {
      updateData.targetRiskScore = targetLikelihood * targetImpact;
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update risk in a transaction
    const risk = await prisma.$transaction(async (tx) => {
      // Update threat mappings if provided
      if (threats !== undefined) {
        await tx.riskThreatMapping.deleteMany({ where: { riskId: id } });
        if (threats.length > 0) {
          await tx.riskThreatMapping.createMany({
            data: threats.map((threatId: string) => ({
              riskId: id,
              threatId,
            })),
          });
        }
      }

      // Update vulnerability mappings if provided
      if (vulnerabilities !== undefined) {
        await tx.riskVulnerabilityMapping.deleteMany({ where: { riskId: id } });
        if (vulnerabilities.length > 0) {
          await tx.riskVulnerabilityMapping.createMany({
            data: vulnerabilities.map((vulnerabilityId: string) => ({
              riskId: id,
              vulnerabilityId,
            })),
          });
        }
      }

      // Update cause mappings if provided
      if (causes !== undefined) {
        await tx.riskCauseMapping.deleteMany({ where: { riskId: id } });
        if (causes.length > 0) {
          await tx.riskCauseMapping.createMany({
            data: causes.map((causeId: string) => ({
              riskId: id,
              causeId,
            })),
          });
        }
      }

      // Update control mappings if provided
      if (controls !== undefined) {
        await tx.controlRisk.deleteMany({ where: { riskId: id } });
        if (controls.length > 0) {
          await tx.controlRisk.createMany({
            data: controls.map((c: string | { controlId: string; controlStrengthId?: string; justification?: string }) => {
              if (typeof c === "string") return { riskId: id, controlId: c };
              return {
                riskId: id,
                controlId: c.controlId,
                controlStrengthId: c.controlStrengthId || null,
                justification: c.justification || null,
              };
            }),
          });
        }
      }

      // Update risk
      return tx.risk.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          type: true,
          department: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          impactedAsset: {
            select: {
              id: true,
              assetId: true,
              name: true,
            },
          },
          impactedProcess: {
            select: {
              id: true,
              processCode: true,
              name: true,
            },
          },
          threats: {
            include: { threat: true },
          },
          vulnerabilities: {
            include: { vulnerability: true },
          },
          causes: {
            include: { cause: true },
          },
          controlRisks: {
            include: { control: true, controlStrength: true },
          },
        },
      });
    });

      // Notify new owner if owner changed and different from actor
      if (ownerId && ownerId !== existingRisk.ownerId && ownerId !== session.id && session.customerAccountId) {
        await notificationService.notifyRiskAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          ownerId: ownerId,
          riskId: risk.id,
          riskCode: risk.riskId,
          riskName: risk.name,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'Risk', risk.id, { name: risk.name, description: risk.description, riskSources: risk.riskSources });

      return NextResponse.json(risk);
    } catch (error) {
      console.error("Error updating risk:", error);
      return NextResponse.json(
        { error: "Failed to update risk" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "edit" }
);

// PATCH update a risk (partial update) - with tenant and department validation
export const PATCH = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      // Check if risk exists and verify tenant access
      const existingRisk = await prisma.risk.findUnique({
        where: { id },
        select: { customerAccountId: true, departmentId: true, ownerId: true },
      });
      if (!existingRisk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied to this risk");
      }

      // Check department scope access for edit
      if (!canAccessRecord(session, "risk.register", "edit", {
        departmentId: existingRisk.departmentId,
        ownerId: existingRisk.ownerId,
      })) {
        return forbidden("Access denied - this risk belongs to a different department");
      }

      // Build update data from provided fields only
      const updateData: Record<string, unknown> = {};

      if (body.status !== undefined) {
        updateData.status = body.status;
        // Also update assessmentStatus to keep them in sync
        updateData.assessmentStatus = body.status;
      }
      if (body.assessmentStatus !== undefined) {
        updateData.assessmentStatus = body.assessmentStatus;
      }
      // Handle responseStatus separately (for Risk Response Strategy workflow)
      if (body.responseStatus !== undefined) {
        updateData.responseStatus = body.responseStatus;
      }
      if (body.responseStrategy !== undefined) {
        updateData.responseStrategy = body.responseStrategy;
      }
      if (body.treatmentPlan !== undefined) {
        updateData.treatmentPlan = body.treatmentPlan;
      }
      if (body.treatmentStatus !== undefined) {
        updateData.treatmentStatus = body.treatmentStatus;
      }
      if (body.treatmentDueDate !== undefined) {
        updateData.treatmentDueDate = body.treatmentDueDate ? new Date(body.treatmentDueDate) : null;
      }

      // Only update if there's data to update
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      // Update risk and optionally create activity log for send back
      const risk = await prisma.$transaction(async (tx) => {
        // Update the risk
        const updatedRisk = await tx.risk.update({
          where: { id },
          data: updateData,
          include: {
            category: true,
            type: true,
            department: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

        // If responseStatus is "Sent Back" and there's a comment, create activity log
        if (body.responseStatus === "Sent Back" && body.responseComment) {
          await tx.riskActivityLog.create({
            data: {
              riskId: id,
              activity: "Sent Back",
              description: body.responseComment,
              actor: body.responseCommentBy || "Reviewer",
              actorId: session?.id || null,
            },
          });
        }

        // Create activity log for responseStatus change (Risk Response Strategy workflow)
        if (body.responseStatus && body.responseStatus !== "Sent Back") {
          await tx.riskActivityLog.create({
            data: {
              riskId: id,
              activity: `Response Status Changed to ${body.responseStatus}`,
              description: `Risk response strategy status changed to ${body.responseStatus}`,
              actor: session?.name || "User",
              actorId: session?.id || null,
            },
          });
        }

        return updatedRisk;
      });

      // Send notifications based on status changes
      if (session.customerAccountId && risk.ownerId && risk.ownerId !== session.id) {
        // Notify on send-back
        if (body.responseStatus === "Sent Back") {
          await notificationService.notifySentBack({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            assigneeId: risk.ownerId,
            entityType: 'Risk',
            entityId: risk.id,
            entityName: `${risk.riskId}: ${risk.name}`,
            reason: body.responseComment,
            link: `/risks/register/${risk.id}/edit`,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify on approval
        if (body.responseStatus === "Approved" || body.status === "Approved") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: risk.ownerId,
            event: NOTIFICATION_EVENTS.RISK_APPROVED,
            title: 'Risk Approved',
            message: `Risk "${risk.riskId}: ${risk.name}" has been approved.`,
            relatedEntityType: 'risk',
            relatedEntityId: risk.id,
            link: `/risks/register/${risk.id}/edit`,
            metadata: {
              entityName: risk.name,
              riskCode: risk.riskId,
              riskName: risk.name,
              approvedBy: session.name || 'Reviewer',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify on rejection
        if (body.responseStatus === "Rejected" || body.status === "Rejected") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: risk.ownerId,
            event: NOTIFICATION_EVENTS.RISK_REJECTION,
            title: 'Risk Rejected',
            message: `Risk "${risk.riskId}: ${risk.name}" has been rejected.${body.responseComment ? ' Reason: ' + body.responseComment : ''}`,
            relatedEntityType: 'risk',
            relatedEntityId: risk.id,
            link: `/risks/register/${risk.id}/edit`,
            metadata: {
              entityName: risk.name,
              riskCode: risk.riskId,
              riskName: risk.name,
              rejectedBy: session.name || 'Reviewer',
              reason: body.responseComment,
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify on submit for approval
        if (body.responseStatus === "Pending Approval" || body.status === "Pending Approval") {
          await notificationService.send({
            customerAccountId: session.customerAccountId,
            actorId: session.id,
            recipientId: risk.ownerId,
            event: NOTIFICATION_EVENTS.RISK_SUBMIT_FOR_APPROVAL,
            title: 'Risk Submitted for Approval',
            message: `Risk "${risk.riskId}: ${risk.name}" has been submitted for approval.`,
            relatedEntityType: 'risk',
            relatedEntityId: risk.id,
            link: `/risks/register/${risk.id}/edit`,
            metadata: {
              entityName: risk.name,
              riskCode: risk.riskId,
              riskName: risk.name,
              submittedBy: session.name || 'User',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(risk);
    } catch (error) {
      console.error("Error updating risk:", error);
      return NextResponse.json(
        { error: "Failed to update risk", details: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "edit" }
);

// DELETE a risk - with tenant and department validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Check if risk exists and verify tenant access
      const existingRisk = await prisma.risk.findUnique({
        where: { id },
        select: { customerAccountId: true, departmentId: true, ownerId: true },
      });
      if (!existingRisk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied to this risk");
      }

      // Check department scope access for delete
      if (!canAccessRecord(session, "risk.register", "delete", {
        departmentId: existingRisk.departmentId,
        ownerId: existingRisk.ownerId,
      })) {
        return forbidden("Access denied - this risk belongs to a different department");
      }

      await prisma.risk.delete({ where: { id } });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'Risk', id);

      return NextResponse.json({ message: "Risk deleted successfully" });
    } catch (error) {
      console.error("Error deleting risk:", error);
      return NextResponse.json(
        { error: "Failed to delete risk" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "delete" }
);
