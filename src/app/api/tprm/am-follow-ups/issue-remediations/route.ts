import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, getAMEmail } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { saveUploadedFile } from '@/lib/file-upload';

// GET /api/tprm/am-follow-ups/issue-remediations — List issue remediations for AM
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'Pending';

      // Resolves SME → parent AM email
      const userEmail = await getAMEmail(session);
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

      // "Pending" sub-tab also shows "Sent to Vendor" issues (forwarded by BO)
      const statusFilter = status === "Pending"
        ? { in: ["Pending", "Sent to Vendor"] }
        : status;

      const remediations = await prisma.tPRMIssueRemediation.findMany({
        where: {
          customerAccountId,
          assessmentId: { in: assessmentIds },
          status: statusFilter,
        },
        include: {
          assessment: {
            select: { assessmentCode: true, vendor: { select: { name: true } } },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
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
      const formData = await req.formData();
      const id = formData.get('id') as string;
      const amResponse = formData.get('amResponse') as string;
      const amComment = formData.get('amComment') as string;

      if (!id || !amResponse?.trim()) {
        return NextResponse.json({ error: 'ID and response are required' }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: 'Issue remediation not found' }, { status: 404 });
      }

      // Handle file uploads
      const files = formData.getAll('files');
      let artifactUrl: string | null = null;
      let artifactName: string | null = null;

      if (files && files.length > 0) {
        const uploadedNames: string[] = [];
        const uploadedUrls: string[] = [];
        for (const file of files) {
          if (file instanceof File) {
            const subDir = `tprm/remediations/${id}`;
            const { urlPath } = await saveUploadedFile(file, subDir);
            uploadedNames.push(file.name);
            uploadedUrls.push(urlPath);
          }
        }
        if (uploadedNames.length > 0) {
          artifactName = uploadedNames.join(', ');
          artifactUrl = uploadedUrls.join(', ');
        }
      }

      const updated = await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: {
          amResponse,
          amComment: amComment || amResponse,
          responseDate: new Date(),
          status: 'Submitted',
          ...(artifactName && { artifactName }),
          ...(artifactUrl && { artifactUrl }),
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

// DELETE /api/tprm/am-follow-ups/issue-remediations?id=xxx&artifactIndex=0 — Remove an artifact
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      const artifactIndex = parseInt(searchParams.get('artifactIndex') || '-1');

      if (!id || artifactIndex < 0) {
        return NextResponse.json({ error: 'ID and artifactIndex are required' }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: 'Remediation not found' }, { status: 404 });
      }

      const names = remediation.artifactName?.split(', ') || [];
      const urls = remediation.artifactUrl?.split(', ') || [];

      if (artifactIndex >= names.length) {
        return NextResponse.json({ error: 'Artifact index out of range' }, { status: 400 });
      }

      names.splice(artifactIndex, 1);
      urls.splice(artifactIndex, 1);

      const updated = await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: {
          artifactName: names.length > 0 ? names.join(', ') : null,
          artifactUrl: urls.length > 0 ? urls.join(', ') : null,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Issue Remediations DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete artifact' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);
