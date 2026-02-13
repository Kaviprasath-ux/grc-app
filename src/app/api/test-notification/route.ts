import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

// POST - Send a test notification for a specific template
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    try {
      const { templateCode, recipientId } = await req.json();

      if (!templateCode) {
        return NextResponse.json({ error: "templateCode is required" }, { status: 400 });
      }

      // Find a recipient user (use provided or default to a test user)
      let recipient;
      if (recipientId) {
        recipient = await prisma.user.findUnique({ where: { id: recipientId } });
      } else {
        // Find another user in the same customer account
        recipient = await prisma.user.findFirst({
          where: {
            customerAccountId: session.customerAccountId,
            id: { not: session.id }
          }
        });
      }

      if (!recipient) {
        return NextResponse.json({
          error: "No recipient found",
          templateCode,
          skipped: true
        }, { status: 200 });
      }

      // Map template codes to notification events
      const templateToEvent: Record<string, string> = {
        // Audit
        'AUDIT_CREATED': 'AUDIT_CREATED',
        'FINDINGS_CREATED': 'FINDINGS_CREATED',
        'FINDINGS_COMPLETED': 'FINDINGS_COMPLETED',
        'AUDIT_PLAN_CREATED': 'AUDIT_PLAN_CREATED',
        'AUDIT_PLAN_SCHEDULED': 'AUDIT_PLAN_SCHEDULED',
        'AUDIT_PLAN_APPROVAL': 'AUDIT_PLAN_APPROVAL',
        'AUDIT_PLAN_ACKNOWLEDGED': 'AUDIT_PLAN_ACKNOWLEDGED',
        'AUDIT_PLAN_SUBMIT_FOR_ACKNOWLEDGEMENT': 'AUDIT_PLAN_SUBMIT_FOR_ACKNOWLEDGEMENT',
        'WORKPAPER_SUBMITTED': 'WORKPAPER_SUBMITTED',
        'PROCEDURE_ASSIGNED': 'PROCEDURE_ASSIGNED',
        'QUESTION_DELEGATED': 'QUESTION_DELEGATED',
        'QUESTION_CLARIFICATION': 'QUESTION_CLARIFICATION',
        'CONCLUDE_TEST': 'CONCLUDE_TEST',
        'RESPONSE_SUBMITTED': 'RESPONSE_SUBMITTED',
        'INTERVIEW_SCHEDULED': 'INTERVIEW_SCHEDULED',
        'INTERVIEW_RESCHEDULED': 'INTERVIEW_RESCHEDULED',
        'PERIODICITY_INITIATED': 'PERIODICITY_INITIATED',
        'REPORT_PUBLISHED': 'REPORT_PUBLISHED',
        'REPORT_INITIATED': 'REPORT_INITIATED',
        'REPORT_SUBMISSION': 'REPORT_SUBMISSION',
        'FIELDWORK_RESPONSE': 'FIELDWORK_RESPONSE',

        // Evidence
        'EVIDENCE_ASSIGNED': 'EVIDENCE_ASSIGNED',
        'EVIDENCE_SUBMITTED': 'EVIDENCE_SUBMITTED',
        'EVIDENCE_PUBLISHED': 'EVIDENCE_PUBLISHED',

        // Governance
        'GOVERNANCE_APPROVED': 'GOVERNANCE_APPROVED',
        'GOVERNANCE_ASSIGNED': 'GOVERNANCE_ASSIGNED',
        'GOVERNANCE_PUBLISHED': 'GOVERNANCE_PUBLISHED',
        'GOVERNANCE_SUBMIT_FOR_APPROVAL': 'GOVERNANCE_SUBMIT_FOR_APPROVAL',
        'GOVERNANCE_APPROVER': 'GOVERNANCE_APPROVER',
        'RESEND_POLICY': 'RESEND_POLICY',

        // Process
        'PROCESS_CREATED': 'PROCESS_CREATED',
        'PROCESS_SUBMIT_FOR_APPROVAL': 'PROCESS_SUBMIT_FOR_APPROVAL',
        'PROCESS_APPROVED': 'PROCESS_APPROVED',
        'PROCESS_REJECTION': 'PROCESS_REJECTION',
        'PROCESS_ASSIGNED': 'PROCESS_ASSIGNED',

        // Risk
        'RISK_CREATED': 'RISK_CREATED',
        'RISK_ASSIGNED': 'RISK_ASSIGNED',
        'RISK_APPROVED': 'RISK_APPROVED',
        'RISK_SUBMIT_FOR_APPROVAL': 'RISK_SUBMIT_FOR_APPROVAL',
        'RISK_REJECTION': 'RISK_REJECTION',

        // Control
        'CONTROL_ASSIGNED': 'CONTROL_ASSIGNED',
        'CONTROL_COMPLIANT': 'CONTROL_COMPLIANT',
        'ASSESSMENT_COMPLETED': 'ASSESSMENT_COMPLETED',

        // Exception
        'EXCEPTION_ASSIGNED': 'EXCEPTION_ASSIGNED',
        'EXCEPTION_AUTHORIZED': 'EXCEPTION_AUTHORIZED',
        'EXCEPTION_AUTHORIZATION_REQUIRED': 'EXCEPTION_AUTHORIZATION_REQUIRED',
        'EXCEPTION_APPROVED': 'EXCEPTION_APPROVED',
        'EXCEPTION_DENIED': 'EXCEPTION_DENIED',
        'EXCEPTION_SENT_BACK': 'EXCEPTION_SENT_BACK',
        'EXCEPTION_CLOSURE': 'EXCEPTION_CLOSURE',
        'EXCEPTION_CLOSED': 'EXCEPTION_CLOSED',

        // Issue
        'ISSUE_CREATED': 'ISSUE_CREATED',
        'ISSUE_RESOLVED': 'ISSUE_RESOLVED',
        'ISSUE_SUBMIT_FOR_CLOSURE': 'ISSUE_SUBMIT_FOR_CLOSURE',
        'ISSUE_REJECTED': 'ISSUE_REJECTED',
        'ISSUE_RESOLUTION_REMINDER': 'ISSUE_RESOLUTION_REMINDER',
        'ISSUE_ESCALATED': 'ISSUE_ESCALATED',
        'ISSUE_EVIDENCE': 'ISSUE_EVIDENCE',

        // Planned Action
        'PLANNED_ACTION_RAISE': 'PLANNED_ACTION_RAISE',
        'PLANNED_ACTION_REJECTION': 'PLANNED_ACTION_REJECTION',
        'PLANNED_ACTION_SUBMIT_FOR_APPROVAL': 'PLANNED_ACTION_SUBMIT_FOR_APPROVAL',
        'PLANNED_ACTION_APPROVED': 'PLANNED_ACTION_APPROVED',

        // KPI
        'KPI_UPDATED': 'KPI_UPDATED',
        'KPI_SCORE_UPDATED': 'KPI_SCORE_UPDATED',

        // User & System
        'USER_CREATED': 'USER_CREATED',
        'CUSTOMER_ONBOARDED': 'CUSTOMER_ONBOARDED',
        'SYSTEM_ANNOUNCEMENT': 'SYSTEM_ANNOUNCEMENT',

        // Due Reminders
        'EVIDENCE_DUE_REMINDER': 'EVIDENCE_DUE_REMINDER',
        'CAPA_DUE_REMINDER': 'CAPA_DUE_REMINDER',
        'REVIEW_DUE_REMINDER': 'REVIEW_DUE_REMINDER',
        'AUDIT_PLAN_ACKNOWLEDGEMENT_REMINDER': 'AUDIT_PLAN_ACKNOWLEDGEMENT_REMINDER',
        'CLARIFICATION_REMINDER': 'CLARIFICATION_REMINDER',
        'FIELDWORK_RESPONSE_REMINDER': 'FIELDWORK_RESPONSE_REMINDER',
        'ESCALATE_FIELDWORK_RESPONSE': 'ESCALATE_FIELDWORK_RESPONSE',
        'ESCALATE_CLARIFICATION': 'ESCALATE_CLARIFICATION',
        'ESCALATE_ACKNOWLEDGMENT': 'ESCALATE_ACKNOWLEDGMENT',

        // Generic/Workflow
        'GENERIC_NOTIFICATION': 'GENERIC_NOTIFICATION',
        'CAPA_ASSIGNED': 'CAPA_ASSIGNED',
        'ENGAGEMENT_ASSIGNED': 'ENGAGEMENT_ASSIGNED',
        'POLICY_ASSIGNED': 'POLICY_ASSIGNED',
        'ASSET_ASSIGNED': 'ASSET_ASSIGNED',
        'COMMENT_ADDED': 'COMMENT_ADDED',
        'APPROVAL_REQUESTED': 'APPROVAL_REQUESTED',
        'APPROVAL_GRANTED': 'APPROVAL_GRANTED',
        'APPROVAL_DENIED': 'APPROVAL_DENIED',
        'SENT_BACK': 'SENT_BACK',
        'FEEDBACK_REQUESTED': 'FEEDBACK_REQUESTED',
        'STATUS_CHANGED': 'STATUS_CHANGED',
      };

      const event = templateToEvent[templateCode] || templateCode;

      // Send test notification
      await notificationService.send({
        customerAccountId: session.customerAccountId!,
        actorId: session.id,
        recipientId: recipient.id,
        event: event,
        title: `Test: ${templateCode}`,
        message: `This is a test notification for template: ${templateCode}`,
        relatedEntityType: 'test',
        relatedEntityId: 'test-' + Date.now(),
        link: '/dashboard',
        metadata: {
          templateCode,
          testMode: true,
          timestamp: new Date().toISOString(),
        },
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      });

      return NextResponse.json({
        success: true,
        templateCode,
        event,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        message: `Test notification sent for ${templateCode}`
      });

    } catch (error) {
      console.error("Error sending test notification:", error);
      return NextResponse.json(
        {
          error: "Failed to send test notification",
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  },
  { resource: "organization.users", action: "view" }
);

// GET - List all available template codes
export const GET = withAuth(
  async () => {
    const templates = await prisma.emailTemplate.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        subject: true,
        isActive: true,
      },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      total: templates.length,
      templates
    });
  },
  { resource: "organization.users", action: "view" }
);
