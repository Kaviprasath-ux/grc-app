import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId } from '@/lib/api-auth';

// POST /api/internal-audit/audit-planning/from-ai - Create audit engagement from AI-generated plan
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        audit_code,
        audit_title,
        audit_objective,
        audit_scope,
        associated_risks,
        audit_tasks,
        department_name,
        departmentId,
      } = body;

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!audit_title || !departmentId) {
        return NextResponse.json(
          { error: 'Audit title and department are required' },
          { status: 400 }
        );
      }

      // Check for duplicate audit plan (same title and department)
      const existingPlan = await prisma.auditEngagement.findFirst({
        where: {
          customerAccountId,
          departmentId,
          engagementTitle: audit_title,
        },
      });

      if (existingPlan) {
        return NextResponse.json(
          { error: 'This audit plan has already been added to Audit Planning.' },
          { status: 409 } // 409 Conflict
        );
      }

      // Generate unique audit ID - scoped to tenant, handles all legacy formats
      const existingEngagements = await prisma.auditEngagement.findMany({
        where: { customerAccountId },
        select: { auditId: true },
      });

      let maxAuditNumber = 0;
      for (const eng of existingEngagements) {
        // Extract trailing number from any format: AUD001, AUD-001, AUD-2025-001
        const match = eng.auditId.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxAuditNumber) maxAuditNumber = num;
        }
      }
      const auditId = `AUD${String(maxAuditNumber + 1).padStart(3, '0')}`;

      // Format the audit tasks as a JSON string for description
      const tasksDescription = audit_tasks
        ?.map((task: any, idx: number) => {
          const steps = task.audit_steps?.slice(0, 3).join('\n  - ') || '';
          return `Task ${idx + 1}: ${task.task_name}\nSteps:\n  - ${steps}`;
        })
        .join('\n\n') || '';

      const fullDescription = `${audit_objective || ''}\n\n${tasksDescription}`;

      // Create audit engagement
      const engagement = await prisma.auditEngagement.create({
        data: {
          auditId,
          engagementTitle: audit_title,
          engagementObjective: audit_objective || null,
          engagementScope: audit_scope || null,
          description: fullDescription.substring(0, 1000), // Limit description length
          departmentId,
          auditType: 'Internal',
          status: 'Planned', // Set status to Planned
          assignedAuditorId: session.id, // Assign to current user
          customerAccountId,
          auditHeadId,
        },
        include: {
          department: true,
          assignedAuditor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Create AI workpapers from audit tasks
      if (audit_tasks && Array.isArray(audit_tasks) && audit_tasks.length > 0) {
        const workpapersData = audit_tasks.map((task: any) => ({
          engagementId: engagement.id,
          task: task.task_name || '',
          steps: JSON.stringify(task.audit_steps || []),
          evidences: JSON.stringify(task.evidence_to_collect || []),
          questionChecklist: JSON.stringify(task.audit_checklist_questions || []),
          comments: '',
          executed: false,
        }));

        await prisma.aiWorkpaper.createMany({
          data: workpapersData,
        });

        console.log(`Created ${workpapersData.length} AI workpapers for engagement ${engagement.id}`);
      }

      return NextResponse.json({
        engagement,
        message: 'Audit plan added successfully with AI workpapers',
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating audit engagement from AI plan:', error);
      return NextResponse.json(
        { error: 'Failed to create audit engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'create' }
);
