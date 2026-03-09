import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

/**
 * GET /api/tprm/rm-issues — Issue Register for RM
 *
 * Replicates the Mendix microflow:
 * 1. Get current user's TPRM account
 * 2. Get all vendors for the tenant, sorted
 * 3. For each vendor → get assessments → for each assessment → get responses (QAAssessment)
 * 4. Count issues by severity (High / Medium / Low) from assessor overrides or AI evaluation
 * 5. Build a risk register entry per vendor (only if total > 0)
 * 6. Also return issue remediation and vendor issue data
 */
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const tab = searchParams.get("tab") || "register";

      // ==================== TAB 1: ISSUE REGISTER ====================
      if (tab === "register") {
        // Get all vendors sorted by name
        const vendors = await prisma.tPRMVendor.findMany({
          where: { ...tenantFilter },
          include: {
            department: { select: { name: true } },
            assessments: {
              include: {
                responses: {
                  select: {
                    poSeverity: true,
                    poStatus: true,
                    assessorSeverity: true,
                    assessorStatus: true,
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        });

        const registerEntries = [];

        for (const vendor of vendors) {
          let highCount = 0;
          let mediumCount = 0;
          let lowCount = 0;

          for (const assessment of vendor.assessments) {
            for (const resp of assessment.responses) {
              // Use assessor override severity if available, otherwise AI severity
              const severity = resp.assessorSeverity || resp.poSeverity;
              // Only count if the status is Unsatisfactory (an actual issue)
              const status = resp.assessorStatus || resp.poStatus;
              if (!severity || (status && status.toLowerCase() === "satisfactory")) continue;

              const sev = severity.toLowerCase();
              if (sev === "high" || sev === "critical") highCount++;
              else if (sev === "medium") mediumCount++;
              else if (sev === "low") lowCount++;
            }
          }

          const total = highCount + mediumCount + lowCount;
          if (total === 0) continue;

          // Determine overall status: if any assessment has open issues
          const hasOpenAssessment = vendor.assessments.some(
            (a) => !["Completed", "Approved", "Closed"].includes(a.status)
          );

          registerEntries.push({
            id: vendor.id,
            department: vendor.department?.name || null,
            vendorName: vendor.name,
            vendorCode: vendor.vendorCode,
            serviceCategory: vendor.serviceCategory,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            total,
            status: hasOpenAssessment ? "Open" : "Closed",
          });
        }

        return NextResponse.json({ data: registerEntries, total: registerEntries.length });
      }

      // ==================== TAB 2: ISSUE REMEDIATION ====================
      if (tab === "remediation") {
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: { customerAccountId },
          include: {
            assessment: {
              include: {
                vendor: { select: { name: true, vendorCode: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const data = remediations.map((rem) => ({
          id: rem.id,
          vendorName: rem.assessment?.vendor?.name || "Unknown",
          vendorCode: rem.assessment?.vendor?.vendorCode || "",
          domain: rem.domainName || null,
          severity: rem.severity || "Medium",
          description: rem.description || null,
          amResponse: rem.amResponse || null,
          requestedDate: rem.requestedDate?.toISOString() || null,
          dueDate: rem.dueDate?.toISOString() || null,
          status: rem.status,
          createdAt: rem.createdAt.toISOString(),
        }));

        return NextResponse.json({ data, total: data.length });
      }

      // ==================== TAB 3: VENDOR ISSUES ====================
      if (tab === "vendor-issues") {
        const issues = await prisma.tPRMVendorIssue.findMany({
          where: { customerAccountId },
          include: {
            vendor: { select: { name: true, vendorCode: true } },
            reportedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const data = issues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          description: issue.description || null,
          vendorName: issue.vendor?.name || "Unknown",
          vendorCode: issue.vendor?.vendorCode || "",
          severity: issue.severity || "Medium",
          dueDate: issue.dueDate?.toISOString() || null,
          resolution: issue.resolution || null,
          status: issue.status,
          reportedBy: issue.reportedBy?.fullName || null,
          createdAt: issue.createdAt.toISOString(),
        }));

        return NextResponse.json({ data, total: data.length });
      }

      return NextResponse.json({ error: "Invalid tab parameter" }, { status: 400 });
    } catch (error) {
      console.error("RM Issues GET error:", error);
      return NextResponse.json({ error: "Failed to fetch issue data" }, { status: 500 });
    }
  },
  { resource: "tprm.rm-issues", action: "view" }
);

// POST /api/tprm/rm-issues — Create a new vendor issue from RM Inventory
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { vendorId, title, description, severity, dueDate } = body;

      if (!vendorId || !title?.trim()) {
        return NextResponse.json({ error: "Vendor ID and title are required" }, { status: 400 });
      }

      // Verify vendor belongs to this tenant
      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id: vendorId, customerAccountId },
        select: { id: true, name: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const issue = await prisma.tPRMVendorIssue.create({
        data: {
          customerAccountId,
          vendorId,
          title,
          description: description || null,
          severity: severity || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "Awaiting Response",
          reportedById: session.id,
        },
        include: {
          vendor: { select: { name: true, vendorCode: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
      });

      // Notify admins/BO about the new vendor issue
      const admins = await prisma.user.findMany({
        where: {
          customerAccountId,
          isActive: true,
          OR: [
            { role: { in: ["GRCAdministrator", "CustomerAdministrator"] } },
            { tprmRole: "Business Owner" },
          ],
        },
        select: { id: true },
        take: 10,
      });

      if (admins.length > 0 && notificationService.notifyTPRMVendorIssueCreated) {
        void notificationService.notifyTPRMVendorIssueCreated({
          customerAccountId,
          actorId: session.id,
          recipientIds: admins.map((a) => a.id),
          issueId: issue.id,
          issueTitle: title,
          vendorName: vendor.name,
        });
      }

      return NextResponse.json(issue, { status: 201 });
    } catch (error) {
      console.error("RM Issues POST error:", error);
      return NextResponse.json({ error: "Failed to create vendor issue" }, { status: 500 });
    }
  },
  { resource: "tprm.rm-issues", action: "create" }
);
