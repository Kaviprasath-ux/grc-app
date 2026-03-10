import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { saveUploadedFile } from "@/lib/file-upload";

/**
 * GET /api/tprm/it-issues — Issue data for Internal IT Team
 *
 * Tab 1 (register): Same issue register as RM (vendor-level counts)
 * Tab 2 (remediation): Issues assigned to IT across all statuses
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
        const remediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            status: { in: ["Assigned to IT", "IT Submitted", "Returned to IT", "IT Approved"] },
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
          itArtifactUrl: rem.itArtifactUrl || null,
          itArtifactName: rem.itArtifactName || null,
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

      // ==================== TAB 3: REGISTER DETAIL (per-vendor issues) ====================
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
      console.error("IT Issues GET error:", error);
      return NextResponse.json({ error: "Failed to fetch issue data" }, { status: 500 });
    }
  },
  { resource: "tprm.it-issues", action: "view" }
);

// PATCH /api/tprm/it-issues — IT team actions (submit response with comment + attachments)
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const formData = await req.formData();
      const id = formData.get("id") as string;
      const action = formData.get("action") as string;
      const comment = formData.get("comment") as string;

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
      if (comment && comment.trim()) {
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
        // Handle file uploads — IT artifacts stored separately
        const files = formData.getAll("files");
        let itArtifactUrl: string | null = remediation.itArtifactUrl;
        let itArtifactName: string | null = remediation.itArtifactName;

        if (files && files.length > 0) {
          const existingNames = itArtifactName ? itArtifactName.split(", ") : [];
          const existingUrls = itArtifactUrl ? itArtifactUrl.split(", ") : [];
          for (const file of files) {
            if (file instanceof File) {
              const subDir = `tprm/remediations/${id}`;
              const { urlPath } = await saveUploadedFile(file, subDir);
              existingNames.push(file.name);
              existingUrls.push(urlPath);
            }
          }
          itArtifactName = existingNames.join(", ");
          itArtifactUrl = existingUrls.join(", ");
        }

        const updated = await prisma.tPRMIssueRemediation.update({
          where: { id },
          data: {
            status: "IT Submitted",
            responseDate: new Date(),
            ...(comment ? { amComment: comment } : {}),
            ...(itArtifactName !== null ? { itArtifactName } : {}),
            ...(itArtifactUrl !== null ? { itArtifactUrl } : {}),
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

// DELETE /api/tprm/it-issues?id=xxx&artifactIndex=0 — Remove an artifact (only when Returned to IT)
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      const artifactIndex = parseInt(searchParams.get("artifactIndex") || "-1");

      if (!id || artifactIndex < 0) {
        return NextResponse.json({ error: "ID and artifactIndex are required" }, { status: 400 });
      }

      const remediation = await prisma.tPRMIssueRemediation.findFirst({
        where: { id, customerAccountId },
      });

      if (!remediation) {
        return NextResponse.json({ error: "Remediation not found" }, { status: 404 });
      }

      if (remediation.status !== "Returned to IT" && remediation.status !== "Assigned to IT") {
        return NextResponse.json({ error: "Can only delete artifacts on returned or assigned issues" }, { status: 400 });
      }

      // Only delete from IT-uploaded artifacts, not AM artifacts
      const names = remediation.itArtifactName?.split(", ") || [];
      const urls = remediation.itArtifactUrl?.split(", ") || [];

      if (artifactIndex >= names.length) {
        return NextResponse.json({ error: "Artifact index out of range" }, { status: 400 });
      }

      names.splice(artifactIndex, 1);
      urls.splice(artifactIndex, 1);

      const updated = await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: {
          itArtifactName: names.length > 0 ? names.join(", ") : null,
          itArtifactUrl: urls.length > 0 ? urls.join(", ") : null,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("IT Issues DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete artifact" }, { status: 500 });
    }
  },
  { resource: "tprm.it-issues", action: "edit" }
);
