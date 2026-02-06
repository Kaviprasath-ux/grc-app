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

      // Generate unique audit ID
      const existingEngagements = await prisma.auditEngagement.count({
        where: { customerAccountId },
      });
      const auditId = `AUD${(existingEngagements + 1).toString().padStart(3, '0')}`;

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
          status: 'Planning', // Start in Planning status
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

      return NextResponse.json({
        engagement,
        message: 'Audit plan added successfully',
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
