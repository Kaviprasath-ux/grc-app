import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, getAMEmail } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { saveUploadedFile } from '@/lib/file-upload';
import { translateRecord } from '@/lib/translation-service';
import { notificationService } from '@/lib/notification-service';
import { validateUploadedFiles } from '@/lib/upload-validation';

// GET /api/tprm/am-follow-ups/clarifications — List clarifications for AM's assessments
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'Pending';

      // Find AM's vendor assessments (resolves SME → parent AM email)
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

      const clarifications = await prisma.tPRMClarification.findMany({
        where: {
          customerAccountId,
          assessmentId: { in: assessmentIds },
          status,
        },
        include: {
          assessment: {
            select: { assessmentCode: true, vendor: { select: { name: true } } },
          },
          customerAccount: { select: { name: true } },
          requestedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ data: clarifications });
    } catch (error) {
      console.error('AM Clarifications GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch clarifications' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'view' }
);

// PATCH /api/tprm/am-follow-ups/clarifications — Respond to a clarification
//
// Accepts multipart/form-data (for file attachments) OR application/json
// (legacy). Files, when present, are saved to uploads/tprm/clarifications/<id>
// and their URLs/names stored as comma-separated strings to mirror the pattern
// used by TPRMIssueRemediation.
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      let id = '';
      let amResponse = '';
      const uploadedFiles: File[] = [];

      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        id = (formData.get('id') as string) || '';
        amResponse = (formData.get('amResponse') as string) || '';
        for (const f of formData.getAll('files')) {
          if (f instanceof File && f.size > 0) uploadedFiles.push(f);
        }
      } else {
        const body = await req.json();
        id = body?.id || '';
        amResponse = body?.amResponse || '';
      }

      if (!id || !amResponse?.trim()) {
        return NextResponse.json({ error: 'ID and response are required' }, { status: 400 });
      }

      if (uploadedFiles.length > 0) {
        const check = validateUploadedFiles(uploadedFiles);
        if (!check.ok) {
          return NextResponse.json({ error: check.reason }, { status: 400 });
        }
      }

      const clarification = await prisma.tPRMClarification.findFirst({
        where: { id, customerAccountId },
      });

      if (!clarification) {
        return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
      }

      // Append new files to any existing artifacts (vendor may reply multiple
      // times before the assessor closes the clarification).
      let artifactUrl = clarification.artifactUrl;
      let artifactName = clarification.artifactName;
      if (uploadedFiles.length > 0) {
        const newUrls: string[] = [];
        const newNames: string[] = [];
        for (const file of uploadedFiles) {
          const { urlPath } = await saveUploadedFile(file, `tprm/clarifications/${id}`);
          newUrls.push(urlPath);
          newNames.push(file.name);
        }
        artifactUrl = [artifactUrl, newUrls.join(', ')].filter(Boolean).join(', ');
        artifactName = [artifactName, newNames.join(', ')].filter(Boolean).join(', ');
      }

      const updated = await prisma.tPRMClarification.update({
        where: { id },
        data: {
          amResponse,
          artifactUrl,
          artifactName,
          status: 'Submitted',
        },
      });

      // Fire-and-forget dynamic translation
      if (customerAccountId) void translateRecord(customerAccountId, 'TPRMClarification', updated.id, { rejectComment: updated.rejectComment, amResponse: updated.amResponse });

      // Notify the assessor who requested the clarification
      if (clarification.requestedById) {
        const assessment = await prisma.tPRMAssessment.findFirst({
          where: { id: clarification.assessmentId, customerAccountId },
          select: { assessmentCode: true, vendorId: true },
        });
        const vendor = assessment?.vendorId
          ? await prisma.tPRMVendor.findUnique({ where: { id: assessment.vendorId }, select: { name: true } })
          : null;
        void notificationService.notifyTPRMClarificationResponded({
          customerAccountId,
          actorId: session.id,
          recipientId: clarification.requestedById,
          assessmentId: clarification.assessmentId,
          assessmentCode: assessment?.assessmentCode || '',
          vendorName: vendor?.name || '',
          questionNo: clarification.questionNo,
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Clarifications PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update clarification' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);

// DELETE /api/tprm/am-follow-ups/clarifications?id=xxx&artifactIndex=n
//
// Removes one artifact reference from a clarification. Only permitted while
// the clarification is still in "Pending" status (i.e. not yet submitted or
// closed) — once the vendor has submitted, the record is read-only for them
// and the assessor has visibility into whatever was uploaded.
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      const artifactIndex = parseInt(searchParams.get('artifactIndex') || '-1', 10);

      if (!id || Number.isNaN(artifactIndex) || artifactIndex < 0) {
        return NextResponse.json({ error: 'ID and artifactIndex are required' }, { status: 400 });
      }

      const clarification = await prisma.tPRMClarification.findFirst({
        where: { id, customerAccountId },
      });
      if (!clarification) {
        return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
      }
      if (clarification.status !== 'Pending') {
        return NextResponse.json(
          { error: 'Attachments can only be removed while the clarification is open' },
          { status: 403 },
        );
      }

      const names = clarification.artifactName?.split(', ') || [];
      const urls = clarification.artifactUrl?.split(', ') || [];
      if (artifactIndex >= names.length) {
        return NextResponse.json({ error: 'Artifact index out of range' }, { status: 400 });
      }
      names.splice(artifactIndex, 1);
      urls.splice(artifactIndex, 1);

      const updated = await prisma.tPRMClarification.update({
        where: { id },
        data: {
          artifactName: names.length > 0 ? names.join(', ') : null,
          artifactUrl: urls.length > 0 ? urls.join(', ') : null,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Clarifications DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete artifact' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);
