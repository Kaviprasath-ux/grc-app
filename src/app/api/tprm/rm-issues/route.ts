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
        // Only show remediations assigned to this RM by the assessor
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            assignedToUserId: session.id,
          },
          include: {
            assessment: {
              include: {
                vendor: { select: { name: true, vendorCode: true } },
              },
            },
            assignedToUser: { select: { fullName: true } },
            comments: {
              include: { user: { select: { fullName: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const data = remediations.map((rem) => ({
          id: rem.id,
          issueCode: rem.issueCode || null,
          vendorName: rem.assessment?.vendor?.name || "Unknown",
          vendorCode: rem.assessment?.vendor?.vendorCode || "",
          domain: rem.domainName || null,
          severity: rem.severity || "Medium",
          description: rem.description || rem.issue || null,
          issue: rem.issue || null,
          risk: rem.risk || null,
          recommendation: rem.recommendation || null,
          questionNo: rem.questionNo || null,
          questionText: rem.questionText || null,
          questionResponse: rem.questionResponse || null,
          reassignComment: rem.reassignComment || null,
          amResponse: rem.amResponse || null,
          amComment: rem.amComment || null,
          assessorComment: rem.assessorComment || null,
          artifactUrl: rem.artifactUrl || null,
          artifactName: rem.artifactName || null,
          assignedTo: rem.assignedToUser?.fullName || null,
          assignedAt: rem.assignedAt?.toISOString() || null,
          requestedDate: rem.requestedDate?.toISOString() || null,
          responseDate: rem.responseDate?.toISOString() || null,
          dueDate: rem.dueDate?.toISOString() || null,
          status: rem.status,
          createdAt: rem.createdAt.toISOString(),
          comments: rem.comments.map((c) => ({
            id: c.id,
            message: c.message,
            userRole: c.userRole || null,
            userName: c.user?.fullName || "Unknown",
            createdAt: c.createdAt.toISOString(),
          })),
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

      // ==================== TAB 4: REGISTER DETAIL (per-vendor issues) ====================
      if (tab === "register-detail") {
        const vendorId = searchParams.get("vendorId");
        if (!vendorId) {
          return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
        }

        // Get vendor name
        const vendor = await prisma.tPRMVendor.findFirst({
          where: { id: vendorId, customerAccountId },
          select: { name: true },
        });

        // Get all remediation issues for this vendor's assessments
        const allRemediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            assessment: { vendorId },
          },
          include: {
            assessment: {
              select: { id: true, assessmentCode: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // Deduplicate: keep latest remediation per assessmentId+questionNo
        const seen = new Set<string>();
        const remediations = allRemediations.filter((rem) => {
          const key = `${rem.assessmentId}:${rem.questionNo || rem.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const data = remediations.map((rem, idx) => ({
          id: rem.id,
          remediationId: rem.id,
          domain: rem.domainName || null,
          severity: rem.severity || "Medium",
          issue: rem.issue || null,
          risk: rem.risk || null,
          recommendation: rem.recommendation || null,
          assessmentCode: rem.assessment?.assessmentCode || null,
          dueDate: rem.dueDate?.toISOString() || null,
          status: rem.status || "Open",
          issueCode: rem.issueCode || `ISS-${String(idx + 1).padStart(3, "0")}`,
          questionNo: rem.questionNo || null,
        }));

        return NextResponse.json({ data, total: data.length, vendorName: vendor?.name || "Unknown" });
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

// PATCH /api/tprm/rm-issues — Update issue remediation status or add comment
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, status, addComment } = body;

      if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: "Issue remediation not found" }, { status: 404 });
      }

      // Add comment if provided
      if (addComment && typeof addComment === "string" && addComment.trim()) {
        await prisma.tPRMRemediationComment.create({
          data: {
            remediationId: id,
            userId: session.id,
            userRole: (session.roles && session.roles[0]) || null,
            message: addComment.trim(),
          },
        });

        if (!status) {
          return NextResponse.json({ success: true });
        }
      }

      // Update status if provided
      if (status) {
        const updated = await prisma.tPRMIssueRemediation.update({
          where: { id },
          data: { status },
        });
        return NextResponse.json(updated);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("RM Issues PATCH error:", error);
      return NextResponse.json({ error: "Failed to update issue remediation" }, { status: 500 });
    }
  },
  { resource: "tprm.rm-issues", action: "edit" }
);
