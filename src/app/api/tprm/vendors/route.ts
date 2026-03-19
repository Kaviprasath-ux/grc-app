import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";
import { translateRecord } from "@/lib/translation-service";
import { checkVendorLimit } from "@/lib/tprm-subscription";

// GET all vendors with search and pagination
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");
      const mode = searchParams.get("mode"); // "suggest" for vendor name autocomplete, "engagements" for listing engagements by name

      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });

      // Mode: suggest — return distinct vendor names + URL matching search (global across all customers)
      if (mode === "suggest" && search) {
        const vendors = await prisma.tPRMVendor.findMany({
          where: { name: { contains: search, mode: "insensitive" } },
          select: { name: true, vendorUrl: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        // Deduplicate by name, keep the one with a URL if possible
        const nameMap = new Map<string, string | null>();
        for (const v of vendors) {
          if (!nameMap.has(v.name) || (v.vendorUrl && !nameMap.get(v.name))) {
            nameMap.set(v.name, v.vendorUrl);
          }
        }
        return NextResponse.json(
          Array.from(nameMap.entries()).slice(0, 10).map(([name, vendorUrl]) => ({ name, vendorUrl }))
        );
      }

      // Mode: engagements — return engagements for a vendor name within same customer (with onboarding answers)
      if (mode === "engagements" && search) {
        const engagements = await prisma.tPRMVendor.findMany({
          where: { ...tenantFilter, name: { equals: search, mode: "insensitive" } },
          include: { department: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        });
        return NextResponse.json(engagements);
      }

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
            assessments: {
              select: { id: true, status: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
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
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory", "tprm.asr-inventory", "tprm.reports"], action: "view" }
);

// POST create a new vendor
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const customerAccountId = getCustomerAccountId(session);

      // Check subscription plan vendor limit
      const vendorCheck = await checkVendorLimit(customerAccountId);
      if (!vendorCheck.allowed) {
        return NextResponse.json({ error: vendorCheck.message }, { status: 403 });
      }

      // Generate vendor code - reuse existing code for same vendor name, or create new
      let vendorCode: string;
      const existingWithSameName = await prisma.tPRMVendor.findFirst({
        where: { customerAccountId, name: { equals: body.name, mode: "insensitive" } },
        select: { vendorCode: true },
        orderBy: { createdAt: "asc" },
      });

      if (existingWithSameName) {
        // Reuse the base vendor code (e.g. VEN001) from existing vendor with same name
        vendorCode = existingWithSameName.vendorCode.split(".")[0];
      } else {
        // Find the highest existing vendor code number to avoid duplicates after deletions
        const allVendors = await prisma.tPRMVendor.findMany({
          where: { customerAccountId },
          select: { vendorCode: true },
        });
        let maxCodeNum = 0;
        for (const v of allVendors) {
          const base = v.vendorCode.split(".")[0];
          const match = base.match(/^VEN(\d+)$/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > maxCodeNum) maxCodeNum = num;
          }
        }
        vendorCode = `VEN${String(maxCodeNum + 1).padStart(3, "0")}`;
      }

      // Generate engagement ID: vendorCode.N (e.g. VEN001.1, VEN001.2)
      const sameBaseVendors = await prisma.tPRMVendor.findMany({
        where: { customerAccountId, vendorCode: { startsWith: vendorCode } },
        select: { vendorCode: true, engagementId: true },
      });

      // Find the highest engagement number
      let maxEngNum = 0;
      for (const v of sameBaseVendors) {
        const eid = v.engagementId || v.vendorCode;
        const parts = eid.split(".");
        const num = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 0;
        if (!isNaN(num) && num > maxEngNum) maxEngNum = num;
      }
      const engagementNumber = maxEngNum + 1;
      const fullVendorCode = `${vendorCode}.${engagementNumber}`;
      const engagementId = body.engagementId || fullVendorCode;

      const vendor = await prisma.tPRMVendor.create({
        data: {
          customerAccountId,
          vendorCode: fullVendorCode,
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
          engagementId,
          vendorCertification: body.vendorCertification,
          vendorUrl: body.vendorUrl || null,
          password: body.password || null,
          businessJustification: body.businessJustification,
          accessToNetwork: body.accessToNetwork ?? false,
          cloud: body.cloud ?? false,
          accessToData: body.accessToData ?? false,
          pii: body.pii ?? false,
          contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : null,
          contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
          onboardedDate: body.onboardedDate ? new Date(body.onboardedDate) : null,
          onboardingAnswers: body.onboardingAnswers ? JSON.stringify(body.onboardingAnswers) : null,
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

      void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, { name: vendor.name, serviceCategory: vendor.serviceCategory });

      return NextResponse.json(vendor, { status: 201 });
    } catch (error) {
      console.error("Error creating TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "create" }
);
