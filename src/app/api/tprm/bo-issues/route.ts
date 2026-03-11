import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

/**
 * GET /api/tprm/bo-issues — Issue data for Business Owner
 *
 * Tab 1 (register): Same issue register as RM (vendor-level counts)
 * Tab 2 (remediation): Issues with status "Assigned to BO" or related
 * Tab 3 (vendor-issues): Vendor-level issues
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
              const severity = resp.assessorSeverity || resp.poSeverity;
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

          const hasOpenAssessment = vendor.assessments.some(
            (a) => !["Completed", "Approved", "Closed", "Offboard_Completed"].includes(a.status)
          );

          // If vendor is offboarded, mark as Closed regardless
          const isOffboarded = vendor.status === "Offboarded";

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
            status: isOffboarded ? "Offboarded" : hasOpenAssessment ? "Open" : "Closed",
          });
        }

        return NextResponse.json({ data: registerEntries, total: registerEntries.length });
      }

      // ==================== TAB 2: ISSUE REMEDIATION ====================
      if (tab === "remediation") {
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            status: { in: ["Assigned to BO", "Submitted", "Closed", "Terminated", "Sent to Vendor"] },
          },
          include: {
            assessment: {
              include: {
                vendor: { select: { id: true, name: true, vendorCode: true } },
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
          vendorId: rem.assessment?.vendor?.id || null,
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

        const vendor = await prisma.tPRMVendor.findFirst({
          where: { id: vendorId, customerAccountId },
          select: { name: true },
        });

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
      console.error("BO Issues GET error:", error);
      return NextResponse.json({ error: "Failed to fetch issue data" }, { status: 500 });
    }
  },
  { resource: "tprm.bo-issues", action: "view" }
);

// PATCH /api/tprm/bo-issues — BO actions on remediations (status change + comment)
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
        return NextResponse.json({ error: "Remediation not found" }, { status: 404 });
      }

      // Add comment if provided
      if (addComment && typeof addComment === "string" && addComment.trim()) {
        const comment = await prisma.tPRMRemediationComment.create({
          data: {
            remediationId: id,
            userId: session.id,
            userRole: "Business Owner",
            message: addComment.trim(),
          },
        });
        void translateRecord(customerAccountId, 'TPRMRemediationComment', comment.id, { message: comment.message });

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
      console.error("BO Issues PATCH error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
  },
  { resource: "tprm.bo-issues", action: "edit" }
);
