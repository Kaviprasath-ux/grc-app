import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

/**
 * GET /api/tprm/it-issues — Issue data for Internal IT Team
 *
 * Tab 1 (register): Same issue register as RM (vendor-level counts)
 * Tab 2 (remediation): Only issues with status "Assigned to IT"
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
        // IT team sees issues assigned to IT status
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            status: { in: ["Assigned to IT", "Submitted", "Closed", "Rejected"] },
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

      return NextResponse.json({ error: "Invalid tab parameter" }, { status: 400 });
    } catch (error) {
      console.error("IT Issues GET error:", error);
      return NextResponse.json({ error: "Failed to fetch issue data" }, { status: 500 });
    }
  },
  { resource: "tprm.it-issues", action: "view" }
);

// PATCH /api/tprm/it-issues — IT team actions on remediations (submit response, add comment)
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, action, comment, amResponse, artifactUrl, artifactName } = body;

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
      if (comment && typeof comment === "string" && comment.trim()) {
        await prisma.tPRMRemediationComment.create({
          data: {
            remediationId: id,
            userId: session.id,
            userRole: "IT Team",
            message: comment.trim(),
          },
        });
      }

      if (action === "submit") {
        // IT submits their response back to assessor
        const updated = await prisma.tPRMIssueRemediation.update({
          where: { id },
          data: {
            status: "Submitted",
            amResponse: amResponse || null,
            responseDate: new Date(),
            ...(artifactUrl ? { artifactUrl, artifactName: artifactName || null } : {}),
            ...(comment ? { amComment: comment } : {}),
          },
        });
        return NextResponse.json(updated);
      }

      // Just adding a comment without status change
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("IT Issues PATCH error:", error);
      return NextResponse.json({ error: "Failed to update remediation" }, { status: 500 });
    }
  },
  { resource: "tprm.it-issues", action: "edit" }
);
