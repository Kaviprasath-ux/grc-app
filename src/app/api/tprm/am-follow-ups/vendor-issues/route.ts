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

      const issues = await prisma.tPRMVendorIssue.findMany({
        where: {
          customerAccountId,
          vendorId: { in: vendorIds },
          status,
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

// POST /api/tprm/am-follow-ups/vendor-issues — Create a new vendor issue
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { vendorId, title, description, severity, dueDate } = body;

      if (!vendorId || !title?.trim()) {
        return NextResponse.json({ error: 'Vendor ID and title are required' }, { status: 400 });
      }

      // Verify vendor belongs to this tenant and AM/SME has access
      const userEmail = await getAMEmail(session);
      const vendor = await prisma.tPRMVendor.findFirst({
        where: {
          id: vendorId,
          customerAccountId,
          accountManagerEmail: { contains: userEmail || '', mode: 'insensitive' },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found or access denied' }, { status: 404 });
      }

      const issue = await prisma.tPRMVendorIssue.create({
        data: {
          customerAccountId,
          vendorId,
          title,
          description: description || null,
          severity: severity || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          reportedById: session.id,
        },
        include: {
          vendor: { select: { name: true, vendorCode: true } },
          customerAccount: { select: { name: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
      });

      // Fire-and-forget translation
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'TPRMVendorIssue', issue.id, {
          title: issue.title,
          description: issue.description,
          resolution: issue.resolution,
        });
      }

      // Notify admins/BO about the new vendor issue
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

      if (admins.length > 0) {
        void notificationService.notifyTPRMVendorIssueCreated({
          customerAccountId,
          actorId: session.id,
          recipientIds: admins.map(a => a.id),
          issueId: issue.id,
          issueTitle: title,
          vendorName: vendor?.name || '',
        });
      }

      return NextResponse.json(issue, { status: 201 });
    } catch (error) {
      console.error('AM Vendor Issues POST error:', error);
      return NextResponse.json({ error: 'Failed to create vendor issue' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'create' }
);

// PATCH /api/tprm/am-follow-ups/vendor-issues — Update a vendor issue
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, title, description, severity, dueDate, resolution, status } = body;

      if (!id) {
        return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
      }

      const issue = await prisma.tPRMVendorIssue.findFirst({
        where: { id, customerAccountId },
      });

      if (!issue) {
        return NextResponse.json({ error: 'Vendor issue not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (severity !== undefined) updateData.severity = severity;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (resolution !== undefined) updateData.resolution = resolution;
      if (status !== undefined) updateData.status = status;

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

      // Notify on status changes
      if (status !== undefined && status !== issue.status) {
        // Resolve reporter and admin users
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

        if (status === 'Escalated') {
          // Notify BO and GRC admins about escalation
          const boAdmins = await prisma.user.findMany({
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
          const escalationRecipients = boAdmins.map(a => a.id).filter(rid => !recipientIds.includes(rid));
          const allEscalationRecipients = [...new Set([...recipientIds, ...escalationRecipients])];
          if (allEscalationRecipients.length > 0) {
            void notificationService.notifyTPRMVendorIssueEscalated({
              customerAccountId,
              actorId: session.id,
              recipientIds: allEscalationRecipients,
              issueId: id,
              issueTitle: updated.title || issue.title,
              vendorName,
            });
          }
        } else if (status === 'Resolved' || status === 'Closed') {
          void notificationService.notifyTPRMVendorIssueResolved({
            customerAccountId,
            actorId: session.id,
            recipientIds,
            issueId: id,
            issueTitle: updated.title || issue.title,
            vendorName,
          });
        } else {
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
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Vendor Issues PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update vendor issue' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);
