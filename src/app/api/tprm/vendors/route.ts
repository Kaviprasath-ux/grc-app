import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";
import { translateRecord } from "@/lib/translation-service";
import { checkVendorLimit } from "@/lib/tprm-subscription";
import { validateAccountManagerEmails, provisionAccountManagerUser } from "@/lib/tprm-account-manager";
import { sendTemplatedEmail } from "@/lib/email-service";
import { getAppUrl } from "@/config/app-url";

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

      // Check that required configuration has been completed before allowing vendor onboarding
      const [templateCount, serviceCategoryCount] = await Promise.all([
        prisma.tPRMQuestionnaireTemplate.count({ where: { customerAccountId } }),
        prisma.tPRMServiceCategory.count({ where: { customerAccountId } }),
      ]);
      const missingConfig: string[] = [];
      if (templateCount === 0) missingConfig.push('Questionnaire Template');
      if (serviceCategoryCount === 0) missingConfig.push('Service Category');
      if (missingConfig.length > 0) {
        return NextResponse.json({
          error: `Configuration incomplete. Please complete the TPRM setup before onboarding vendors. Missing: ${missingConfig.join(', ')}.`,
          configIncomplete: true,
          missing: missingConfig,
        }, { status: 422 });
      }

      // Reject onboarding if the Account Manager email belongs to an existing
      // TPRM staff user (Approver / Assessor / Auditor / BO / RM / Internal IT).
      // Only true Account Managers can be reused across multiple vendors.
      const amCheck = await validateAccountManagerEmails(customerAccountId, body.accountManagerEmail);
      if (!amCheck.ok) {
        return NextResponse.json({ error: amCheck.message, conflict: amCheck.conflict }, { status: 409 });
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

      // When a Business Owner or Relationship Manager onboards a vendor, the
      // vendor inherits the onboarder's department — the vendor belongs to
      // the same line of business that the BO/RM represents. The department is
      // a TPRMDepartment (TPRMVendor.departmentId is an FK to TPRMDepartment),
      // so we read the onboarder's tprmDepartmentId. For other roles
      // (e.g. CustomerAdmin onboarding on behalf of someone) we honour
      // whatever TPRMDepartment id the form supplied.
      const onboarderRoles: string[] = Array.isArray(session?.roles) ? (session.roles as string[]) : [];
      const onboarderIsBoOrRm = onboarderRoles.some((r) => r === 'BusinessOwner' || r === 'RelationshipManager');
      let effectiveDepartmentId: string | null = body.departmentId ?? null;
      if (onboarderIsBoOrRm) {
        const onboarder = await prisma.user.findUnique({
          where: { id: session.id },
          select: { tprmDepartmentId: true },
        });
        if (onboarder?.tprmDepartmentId) effectiveDepartmentId = onboarder.tprmDepartmentId;
      }

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
          departmentId: effectiveDepartmentId,
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

      // Auto-register the vendor in the Continuous Monitoring module so it
      // shows up there the moment onboarding completes (and inherits a link
      // back to this TPRMVendor via `tprmVendorId`). Skipped when no URL was
      // captured — the monitoring pipeline needs a domain to scan. Idempotent
      // against the same URL under this customer.
      try {
        if (vendor.vendorUrl) {
          const normalizedURL = vendor.vendorUrl.startsWith("http")
            ? vendor.vendorUrl
            : `https://${vendor.vendorUrl}`;
          const existingMon = await prisma.tPRMMonitoringVendor.findFirst({
            where: { customerAccountId, vendorURL: normalizedURL },
          });
          if (existingMon) {
            if (!existingMon.tprmVendorId) {
              await prisma.tPRMMonitoringVendor.update({
                where: { id: existingMon.id },
                data: { tprmVendorId: vendor.id, vendorOnboarded: true, vendorName: vendor.name },
              });
            }
          } else {
            await prisma.tPRMMonitoringVendor.create({
              data: {
                customerAccountId,
                vendorName: vendor.name,
                vendorURL: normalizedURL,
                vendorOnboarded: true,
                tprmVendorId: vendor.id,
              },
            });
          }
        }
      } catch (monErr) {
        console.error("[TPRM Vendor POST] Failed to auto-create monitoring record:", monErr);
      }

      // Provision / notify the vendor's Account Manager.
      //  - New AM: create a login (username = AM email, password = the one the
      //    BO/RM set during onboarding), send an in-app "account created" notice,
      //    and email the AM their username, password, and login link.
      //  - Existing AM (reused across vendors): send the "vendor onboarded"
      //    notice only — the password is never reset.
      if (body.accountManagerEmail) {
        try {
          const am = await provisionAccountManagerUser(customerAccountId, {
            email: body.accountManagerEmail,
            name: body.accountManagerName,
            password: body.password,
          });

          if (am?.created) {
            // In-app notification to the newly created Account Manager.
            void notificationService.notifyTPRMAccountCreated({
              customerAccountId,
              actorId: session.id,
              newUserId: am.userId,
              userName: am.fullName,
              tprmRole: "Account Manager",
            });

            // Email the AM their login credentials + link.
            const amEmail = body.accountManagerEmail.split(";")[0].trim();
            const loginUrl = `${getAppUrl()}/login`;
            void sendTemplatedEmail(
              "TPRM_AM_CREDENTIALS",
              amEmail,
              {
                title: "Your TPRM Account Manager Login",
                message: `An account has been created for you to respond to assessments for "${vendor.name}". Username: ${amEmail} — Password: ${body.password} — Login: ${loginUrl}`,
                vendorName: vendor.name,
                userName: amEmail,
                password: body.password,
                entityLink: loginUrl,
              },
              am.fullName,
            );
          } else if (am) {
            // Existing AM — just notify about the new vendor.
            void notificationService.notifyTPRMVendorOnboarded({
              customerAccountId,
              actorId: session.id,
              recipientId: am.userId,
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorCode: vendor.vendorCode,
            });
          }
        } catch (e) {
          // Don't fail vendor creation if AM provisioning/notification hiccups.
          console.error("[vendors] AM provisioning/notification failed:", (e as Error).message);
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
