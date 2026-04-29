import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, getAMEmail } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

// GET /api/tprm/am-follow-ups/vendor-issues — List vendor issues reported by AM
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'Open';

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

      // RM creates issues with "Awaiting Response" while AM/SME's "Pending" tab passes
      // status="Open" — match both so newly raised issues appear immediately.
      const statusFilter = status === 'Open'
        ? { in: ['Open', 'Awaiting Response'] }
        : status === 'Closed'
          ? { in: ['Closed', 'Resolved'] }
          : status;

      const issues = await prisma.tPRMVendorIssue.findMany({
        where: {
          customerAccountId,
          vendorId: { in: vendorIds },
          status: statusFilter,
        },
        include: {
          vendor: { select: { name: true, vendorCode: true } },
          customerAccount: { select: { name: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ data: issues });
    } catch (error) {
      console.error('AM Vendor Issues GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch vendor issues' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'view' }
);

// PATCH /api/tprm/am-follow-ups/vendor-issues — Update a vendor issue
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, resolution } = body;

      if (!id || typeof resolution !== 'string' || !resolution.trim()) {
        return NextResponse.json({ error: 'Issue ID and response are required' }, { status: 400 });
      }

      // AM/SME can only respond to issues raised against their vendors.
      const userEmail = await getAMEmail(session);
      if (!userEmail) {
        return NextResponse.json({ error: 'No vendor association' }, { status: 403 });
      }

      const issue = await prisma.tPRMVendorIssue.findFirst({
        where: {
          id,
          customerAccountId,
          vendor: {
            accountManagerEmail: { contains: userEmail, mode: 'insensitive' },
          },
        },
      });

      if (!issue) {
        return NextResponse.json({ error: 'Vendor issue not found' }, { status: 404 });
      }

      // AM/SME action: write response and flip status to Submitted so RM/BO see it.
      const status = 'Submitted';
      const updateData: Record<string, unknown> = {
        resolution: resolution.trim(),
        status,
      };

      const updated = await prisma.tPRMVendorIssue.update({
        where: { id },
        data: updateData,
        include: {
          vendor: { select: { name: true, vendorCode: true } },
          customerAccount: { select: { name: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
      });

      // Fire-and-forget translation
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'TPRMVendorIssue', updated.id, {
          title: updated.title,
          description: updated.description,
          resolution: updated.resolution,
        });
      }

      // Notify the reporter (RM/BO) plus tenant admins that the vendor responded.
      if (status !== issue.status) {
        const recipientIds: string[] = [];
        if (issue.reportedById) recipientIds.push(issue.reportedById);

        const admins = await prisma.user.findMany({
          where: {
            customerAccountId,
            isActive: true,
            OR: [
              { role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } },
              { tprmRole: 'Business Owner' },
            ],
          },
          select: { id: true },
          take: 10,
        });
        for (const a of admins) {
          if (!recipientIds.includes(a.id)) recipientIds.push(a.id);
        }

        const vendorName = updated.vendor?.name || '';

        void notificationService.notifyTPRMVendorIssueUpdated({
          customerAccountId,
          actorId: session.id,
          recipientIds,
          issueId: id,
          issueTitle: updated.title || issue.title,
          vendorName,
          newStatus: status,
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Vendor Issues PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update vendor issue' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);
