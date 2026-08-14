import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";
import { validateAccountManagerEmails } from "@/lib/tprm-account-manager";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single vendor
export const GET = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: { select: { id: true, name: true } },
          assessments: {
            include: {
              initiatedBy: { select: { id: true, fullName: true } },
              assessor: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      return NextResponse.json(vendor);
    } catch (error) {
      console.error("Error fetching TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory", "tprm.asr-inventory", "tprm.reports"], action: "view" }
);

// PATCH update vendor
export const PATCH = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });
      const body = await req.json();

      const existing = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      // If the AM email is being changed, ensure the new email doesn't belong
      // to a TPRM staff user (Approver / Assessor / Auditor / BO / RM / IT).
      if (body.accountManagerEmail !== undefined && body.accountManagerEmail !== existing.accountManagerEmail) {
        const customerAccountIdForCheck = getCustomerAccountId(session);
        const amCheck = await validateAccountManagerEmails(customerAccountIdForCheck, body.accountManagerEmail);
        if (!amCheck.ok) {
          return NextResponse.json({ error: amCheck.message, conflict: amCheck.conflict }, { status: 409 });
        }
      }

      const vendor = await prisma.tPRMVendor.update({
        where: { id },
        data: {
          name: body.name,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          accountManagerName: body.accountManagerName,
          accountManagerEmail: body.accountManagerEmail,
          serviceCategory: body.serviceCategory,
          serviceDescription: body.serviceDescription,
          departmentId: body.departmentId,
          status: body.status,
          vrr: body.vrr,
          engagementId: body.engagementId,
          vendorCertification: body.vendorCertification,
          vendorUrl: body.vendorUrl,
          password: body.password,
          businessJustification: body.businessJustification,
          accessToNetwork: body.accessToNetwork,
          cloud: body.cloud,
          accessToData: body.accessToData,
          pii: body.pii,
          contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : undefined,
          contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : undefined,
          onboardedDate: body.onboardedDate ? new Date(body.onboardedDate) : undefined,
          offboardedDate: body.offboardedDate ? new Date(body.offboardedDate) : undefined,
          onboardingAnswers: body.onboardingAnswers !== undefined ? JSON.stringify(body.onboardingAnswers) : undefined,
        },
        include: {
          department: { select: { id: true, name: true } },
        },
      });

      const customerAccountId = getCustomerAccountId(session);
      void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, { name: vendor.name, serviceCategory: vendor.serviceCategory });

      // Notify on vendor status changes
      if (body.status && existing.status !== body.status) {

        // Offboarding notifications
        const offboardStatuses = ['Offboarding', 'Offboarded', 'Inactive'];
        if (offboardStatuses.includes(body.status)) {
          if (existing.accountManagerEmail) {
            const am = await prisma.user.findFirst({
              where: {
                customerAccountId,
                email: { equals: existing.accountManagerEmail.split(";")[0].trim(), mode: "insensitive" },
                isActive: true,
              },
              select: { id: true },
            });
            if (am) {
              void notificationService.notifyTPRMVendorOffboarding({
                customerAccountId,
                actorId: session.id,
                recipientId: am.id,
                vendorId: vendor.id,
                vendorName: vendor.name,
                vendorCode: vendor.vendorCode || '',
              });
            }
          }
        }

        // Vendor Terminated — notify internal users + send email to vendor contact
        if (body.status === 'Terminated') {
          const recipientIds: string[] = [];

          // Resolve AM user
          const amEmail = existing.accountManagerEmail?.split(';')[0]?.trim();
          if (amEmail) {
            const amUser = await prisma.user.findFirst({
              where: { customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
              select: { id: true },
            });
            if (amUser) recipientIds.push(amUser.id);
          }

          // Add BO/Admin users
          const boAdmins = await prisma.user.findMany({
            where: {
              customerAccountId, isActive: true,
              OR: [
                { role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } },
                { tprmRole: 'Business Owner' },
              ],
            },
            select: { id: true },
            take: 10,
          });
          for (const u of boAdmins) {
            if (!recipientIds.includes(u.id)) recipientIds.push(u.id);
          }

          // Add assessors from active assessments for this vendor
          const activeAssessments = await prisma.tPRMAssessment.findMany({
            where: {
              customerAccountId,
              vendorId: vendor.id,
              status: { notIn: ['Closed', 'Completed', 'Approved', 'Offboard_Completed'] },
            },
            select: { assessorId: true },
          });
          for (const a of activeAssessments) {
            if (a.assessorId && !recipientIds.includes(a.assessorId)) recipientIds.push(a.assessorId);
          }

          if (recipientIds.length > 0) {
            void notificationService.notifyTPRMVendorTerminated({
              customerAccountId,
              actorId: session.id,
              recipientIds,
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorCode: vendor.vendorCode || '',
              vendorContactEmail: existing.contactEmail,
              reason: body.terminationReason,
            });
          } else if (existing.contactEmail) {
            // Even if no internal recipients, still email the vendor
            void notificationService.notifyTPRMVendorTerminated({
              customerAccountId,
              actorId: session.id,
              recipientIds: [],
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorCode: vendor.vendorCode || '',
              vendorContactEmail: existing.contactEmail,
              reason: body.terminationReason,
            });
          }
        }
      }

      return NextResponse.json(vendor);
    } catch (error) {
      console.error("Error updating TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to update vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "edit" }
);

// DELETE vendor
export const DELETE = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      const existing = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      await prisma.tPRMVendor.delete({ where: { id } });

      const customerAccountId = getCustomerAccountId(session);
      void deleteRecordTranslations(customerAccountId, 'TPRMVendor', id);

      return NextResponse.json({ message: "Vendor deleted" });
    } catch (error) {
      console.error("Error deleting TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "delete" }
);
