import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/am-follow-ups/issue-remediations — List issue remediations for AM
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'Pending';

      const userEmail = session.email?.toLowerCase();
      if (!userEmail) {
        return NextResponse.json({ data: [] });
      }

      const vendors = await prisma.tPRMVendor.findMany({
        where: {
          customerAccountId,
          accountManagerEmail: { contains: userEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });

      const vendorIds = vendors.map(v => v.id);
      if (vendorIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const assessments = await prisma.tPRMAssessment.findMany({
        where: { customerAccountId, vendorId: { in: vendorIds } },
        select: { id: true },
      });

      const assessmentIds = assessments.map(a => a.id);

      const remediations = await prisma.tPRMIssueRemediation.findMany({
        where: {
          customerAccountId,
          assessmentId: { in: assessmentIds },
          status,
        },
        include: {
          assessment: {
            select: { assessmentCode: true, vendor: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ data: remediations });
    } catch (error) {
      console.error('AM Issue Remediations GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch issue remediations' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'view' }
);

// PATCH /api/tprm/am-follow-ups/issue-remediations — Respond to an issue remediation
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, amResponse } = body;

      if (!id || !amResponse?.trim()) {
        return NextResponse.json({ error: 'ID and response are required' }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: 'Issue remediation not found' }, { status: 404 });
      }

      const updated = await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: {
          amResponse,
          status: 'Submitted',
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Issue Remediations PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update issue remediation' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);
