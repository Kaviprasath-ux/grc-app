import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord } from '@/lib/translation-service';

// GET /api/tprm/remediation-comments?remediationId=xxx — Get comments for a remediation
export const GET = withAuthOnly(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const remediationId = searchParams.get('remediationId');

      if (!remediationId) {
        return NextResponse.json({ error: 'remediationId is required' }, { status: 400 });
      }

      // Verify remediation belongs to this tenant. Pull amComment/responseDate
      // too so we can backfill it as a synthetic comment for historical data
      // that pre-dates the AM-comment-thread mirror.
      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id: remediationId, customerAccountId },
        select: {
          id: true,
          amComment: true,
          amResponse: true,
          responseDate: true,
          assessment: { select: { vendor: { select: { accountManagerEmail: true } } } },
        },
      });

      if (!remediation) {
        return NextResponse.json({ error: 'Remediation not found' }, { status: 404 });
      }

      const comments = await prisma.tPRMRemediationComment.findMany({
        where: { remediationId },
        include: {
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Backfill: if no thread comments exist yet but the AM has submitted a
      // response with a comment, surface that comment as a synthetic first
      // entry. New submissions go through the mirror in /am-follow-ups PATCH,
      // so this only kicks in for legacy remediations and one-off shapes.
      const amText = (remediation.amComment || remediation.amResponse || '').trim();
      if (comments.length === 0 && amText) {
        // Best-effort: find the AM user by the vendor's accountManagerEmail
        const amEmail = remediation.assessment?.vendor?.accountManagerEmail?.split(';')[0]?.trim();
        const amUser = amEmail
          ? await prisma.user.findFirst({
              where: { customerAccountId, email: { equals: amEmail, mode: 'insensitive' } },
              select: { id: true, fullName: true },
            })
          : null;
        return NextResponse.json({
          data: [{
            id: `synthetic-${remediation.id}`,
            userId: amUser?.id || '',
            userRole: 'Account Manager',
            message: amText,
            createdAt: (remediation.responseDate || new Date()).toISOString(),
            user: { fullName: amUser?.fullName || 'Account Manager' },
          }],
        });
      }

      return NextResponse.json({ data: comments });
    } catch (error) {
      console.error('Remediation comments GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
  },
);

// POST /api/tprm/remediation-comments — Add a comment
export const POST = withAuthOnly(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { remediationId, message } = body;

      if (!remediationId || !message?.trim()) {
        return NextResponse.json({ error: 'remediationId and message are required' }, { status: 400 });
      }

      // Verify remediation belongs to this tenant
      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id: remediationId, customerAccountId },
        select: { id: true },
      });

      if (!remediation) {
        return NextResponse.json({ error: 'Remediation not found' }, { status: 404 });
      }

      // Determine role label from session
      const roles = session.roles || [];
      let userRole = 'User';
      if (roles.some((r: string) => r.includes('TPRMAccountManager') || r.includes('AccountManager'))) {
        userRole = 'Account Manager';
      } else if (roles.some((r: string) => r.includes('TPRMApprover') || r.includes('Approver'))) {
        userRole = 'Approver';
      } else if (roles.some((r: string) => r.includes('TPRMAssessor') || r.includes('Assessor') || r.includes('AuditHead') || r.includes('Auditor'))) {
        userRole = 'Assessor';
      } else if (roles.some((r: string) => r.includes('Admin'))) {
        userRole = 'Admin';
      }

      const comment = await prisma.tPRMRemediationComment.create({
        data: {
          remediationId,
          userId: session.id,
          userRole,
          message: message.trim(),
        },
        include: {
          user: { select: { fullName: true } },
        },
      });
      void translateRecord(customerAccountId, 'TPRMRemediationComment', comment.id, { message: comment.message });

      return NextResponse.json(comment, { status: 201 });
    } catch (error) {
      console.error('Remediation comments POST error:', error);
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }
  },
);
