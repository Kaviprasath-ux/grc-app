import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

// GET all vendors with search and pagination
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = { ...tenantFilter };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { vendorCode: { contains: search, mode: "insensitive" } },
          { serviceCategory: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status) where.status = status;

      const [vendors, total] = await Promise.all([
        prisma.tPRMVendor.findMany({
          where,
          include: {
            department: { select: { id: true, name: true } },
            _count: { select: { assessments: true } },
            monitoringVendor: {
              select: {
                id: true,
                vendorName: true,
                vendorURL: true,
                assessments: {
                  where: { isLatest: true },
                  select: {
                    overallScore: true,
                    securityPostureScore: true,
                    threatExposureScore: true,
                    calculatedOverallScore: true,
                    calculatedSecurityPosture: true,
                    calculatedThreatExposure: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.tPRMVendor.count({ where }),
      ]);

      return NextResponse.json({
        data: vendors,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + vendors.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching TPRM vendors:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);

// POST create a new vendor
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const customerAccountId = getCustomerAccountId(session);

      // Generate vendor code
      const count = await prisma.tPRMVendor.count({
        where: { customerAccountId },
      });
      const vendorCode = `VEN${String(count + 1).padStart(3, "0")}`;

      const vendor = await prisma.tPRMVendor.create({
        data: {
          customerAccountId,
          vendorCode,
          name: body.name,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          accountManagerName: body.accountManagerName,
          accountManagerEmail: body.accountManagerEmail,
          serviceCategory: body.serviceCategory,
          serviceDescription: body.serviceDescription,
          departmentId: body.departmentId,
          status: body.status || "Onboarding",
          vrr: body.vrr,
          engagementId: body.engagementId,
          vendorCertification: body.vendorCertification,
          vendorUrl: body.vendorUrl || null,
          businessJustification: body.businessJustification,
          accessToNetwork: body.accessToNetwork ?? false,
          cloud: body.cloud ?? false,
          accessToData: body.accessToData ?? false,
          pii: body.pii ?? false,
          contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : null,
          contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
          onboardedDate: body.onboardedDate ? new Date(body.onboardedDate) : null,
        },
        include: {
          department: { select: { id: true, name: true } },
        },
      });

      // Notify the account manager (if exists) about vendor onboarding
      if (body.accountManagerEmail) {
        const am = await prisma.user.findFirst({
          where: {
            customerAccountId,
            email: { equals: body.accountManagerEmail.split(";")[0].trim(), mode: "insensitive" },
            isActive: true,
          },
          select: { id: true },
        });
        if (am) {
          void notificationService.notifyTPRMVendorOnboarded({
            customerAccountId,
            actorId: session.id,
            recipientId: am.id,
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorCode: vendor.vendorCode,
          });
        }
      }

      return NextResponse.json(vendor, { status: 201 });
    } catch (error) {
      console.error("Error creating TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "create" }
);
