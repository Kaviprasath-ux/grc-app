import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
// External API imports kept for potential fallback
// import { getExternalApiUrl, EXTERNAL_API_SECRETS } from "@/config/external-apis";
import { notificationService } from "@/lib/notification-service";
import { runVendorScan } from "@/lib/openai-vendor-scan";
import { checkAssessmentLimit } from "@/lib/tprm-subscription";

// Save scan response JSON to scan-results folder
async function saveResponseJson(vendorName: string, data: unknown) {
  try {
    const dir = path.join(process.cwd(), "scan-results");
    await mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = (vendorName || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
    const filename = `${safeName}_${ts}.json`;
    await writeFile(path.join(dir, filename), JSON.stringify(data, null, 2), "utf-8");
    console.log(`📁 [SCAN] Saved response → scan-results/${filename}`);
  } catch (err) {
    console.error("⚠️ [SCAN] Failed to save response JSON:", err);
  }
}

// Kept for potential fallback to external API
// function getScanApiUrl(path: string): string {
//   return getExternalApiUrl('PYTHON_BACKEND', path);
// }

// ==================== TYPES ====================

interface MappedHeader {
  name: string;
  present?: boolean;
  value?: string;
  recommendation?: string;
  description?: string;
  platforms?: { server: string }[];
}

interface MappedKPI {
  kpiName: string;
  kpiType?: string;
  securityScore?: number;
  summary?: string;
  riskScore?: number;
  recommendation?: string;
  cveId?: string;
  severity?: string;
  description?: string;
  affectedComponent?: string;
  keyFindings: { statement: string }[];
  sources: { name: string }[];
  vulnerabilities: {
    cveId?: string;
    severity?: string;
    affectedComponent?: string;
    description?: string;
  }[];
}

interface MappedAssessment {
  vendorName: string;
  vendorURL: string;
  jobID: string;
  status: string;
  overallSummary?: string;
  overallScore?: number;
  securityPostureScore?: number;
  threatExposureScore?: number;
  securityPostureSummary?: string;
  threatExposureSummary?: string;
  complianceAndLegal?: {
    privacyPolicyUrl?: string;
    dpaUrl?: string;
    laws: { lawName: string }[];
    certifications: { name: string }[];
  };
  recommendation?: { statement: string };
  kpiDetails: MappedKPI[];
  httpHeaders: MappedHeader[];
}

// ==================== MAPPING ====================

function mapExternalToInternal(
  raw: Record<string, unknown>,
  jobId: string
): MappedAssessment {
  const vendorName = (raw.vendor_name as string) || "";
  // Support both vendor_url (full URL) and vendor_domain (domain only)
  let vendorURL = (raw.vendor_url as string) || (raw.vendor_domain as string) || "";
  if (vendorURL && !vendorURL.startsWith("http")) {
    vendorURL = `https://${vendorURL}`;
  }

  // Compliance & Legal
  const rawCal = raw.compliance_and_legal as
    | Record<string, unknown>
    | undefined;
  const complianceAndLegal = rawCal
    ? {
        privacyPolicyUrl: rawCal.privacy_policy_url as string | undefined,
        dpaUrl: rawCal.dpa_url as string | undefined,
        laws: Array.isArray(rawCal.laws)
          ? (rawCal.laws as string[]).map((l) => ({ lawName: l }))
          : [],
        certifications: Array.isArray(rawCal.certifications)
          ? (rawCal.certifications as string[]).map((c) => ({ name: c }))
          : [],
      }
    : undefined;

  // Recommendations — join as numbered list
  const rawRecs = raw.recommendations as string[] | undefined;
  const recommendation =
    rawRecs && rawRecs.length > 0
      ? { statement: rawRecs.map((r, i) => `${i + 1}. ${r}`).join("\n") }
      : undefined;

  // KPI Details
  const rawKpis = raw.kpi_details as Record<string, unknown>[] | undefined;
  const kpiDetails: MappedKPI[] = (rawKpis || []).map((kpi) => ({
    kpiName: kpi.kpi_name as string,
    kpiType: kpi.kpi_type as string | undefined,
    securityScore: kpi.security_score as number | undefined,
    summary: kpi.summary as string | undefined,
    riskScore: kpi.risk_score as number | undefined,
    recommendation: kpi.recommendation as string | undefined,
    cveId: kpi.cve_id as string | undefined,
    severity: kpi.severity as string | undefined,
    description: kpi.description as string | undefined,
    affectedComponent: kpi.affected_component as string | undefined,
    keyFindings: Array.isArray(kpi.key_findings)
      ? (kpi.key_findings as string[]).map((f) => ({ statement: f }))
      : [],
    sources: Array.isArray(kpi.sources)
      ? (kpi.sources as string[]).map((s) => ({ name: s }))
      : [],
    vulnerabilities: Array.isArray(kpi.vulnerabilities)
      ? (kpi.vulnerabilities as Record<string, unknown>[]).map((v) => ({
          cveId: v.cve_id as string | undefined,
          severity: v.severity as string | undefined,
          affectedComponent: v.affected_component as string | undefined,
          description: v.description as string | undefined,
        }))
      : [],
  }));

  // HTTP Headers — safely parse whatever shape the API returns
  let httpHeaders: MappedHeader[] = [];
  const platformServers: { server: string }[] = [];

  try {
    const rawHeadersRaw = raw.http_security_headers;
    console.log("🔍 [HEADERS] raw type:", typeof rawHeadersRaw, "| isArray:", Array.isArray(rawHeadersRaw), "| keys:", rawHeadersRaw && typeof rawHeadersRaw === "object" ? Object.keys(rawHeadersRaw as object) : "N/A");

    // Build a flat list of items to iterate
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(rawHeadersRaw)) {
      items = rawHeadersRaw as Record<string, unknown>[];
    } else if (rawHeadersRaw && typeof rawHeadersRaw === "object") {
      const obj = rawHeadersRaw as Record<string, unknown>;
      // Check for nested arrays — API returns { http_security_headers: [...], error: null }
      const nestedArr = obj.headers || obj.http_security_headers;
      if (Array.isArray(nestedArr)) {
        items = nestedArr as Record<string, unknown>[];
        if (obj.platform) items = [...items, { platform: obj.platform }];
      } else {
        // Object with named keys — each value might be a header entry
        for (const [key, val] of Object.entries(obj)) {
          if (val && typeof val === "object" && !Array.isArray(val)) {
            if (key === "platform") {
              items.push({ platform: val });
            } else {
              // Could be { header_name, present, value, ... } or { name, ... }
              const h = val as Record<string, unknown>;
              if (h.header_name || h.name) {
                items.push(h);
              }
            }
          }
        }
      }
    }
    console.log("🔍 [HEADERS] Parsed items count:", items.length);

    for (const item of items) {
      if (item.platform) {
        const platform = item.platform as Record<string, unknown>;
        if (platform.server) {
          platformServers.push({ server: platform.server as string });
        }
      } else if (item.header_name || item.name) {
        httpHeaders.push({
          name: (item.header_name || item.name) as string,
          present: (item.present as boolean) ?? false,
          value: item.value as string | undefined,
          recommendation: item.recommendation as string | undefined,
          description: item.description as string | undefined,
        });
      }
    }
    if (platformServers.length > 0 && httpHeaders.length > 0) {
      httpHeaders[0].platforms = platformServers;
    }
  } catch (headerErr) {
    console.error("⚠️ [HEADERS] Failed to parse http_security_headers, skipping:", headerErr);
    httpHeaders = [];
  }

  return {
    vendorName,
    vendorURL,
    jobID: jobId,
    status: "done",
    overallSummary: raw.overall_summary as string | undefined,
    overallScore: raw.overall_score as number | undefined,
    securityPostureScore: raw.securityPostureScore as number | undefined,
    threatExposureScore: raw.threatExposureScore as number | undefined,
    securityPostureSummary: raw.security_posture_summary as string | undefined,
    threatExposureSummary: raw.threat_exposure_summary as string | undefined,
    complianceAndLegal,
    recommendation,
    kpiDetails,
    httpHeaders,
  };
}

// ==================== PERSISTENCE ====================

async function persistAssessment(
  customerAccountId: string,
  data: MappedAssessment,
  existingVendorId?: string,
): Promise<{ vendorId: string; assessmentId: string }> {
  // Use pre-existing vendor ID if provided (from POST handler), otherwise upsert by URL
  let monVendor = existingVendorId
    ? await prisma.tPRMMonitoringVendor.findFirst({
        where: { id: existingVendorId, customerAccountId },
      })
    : await prisma.tPRMMonitoringVendor.findFirst({
        where: { customerAccountId, vendorURL: data.vendorURL },
      });

  if (monVendor) {
    monVendor = await prisma.tPRMMonitoringVendor.update({
      where: { id: monVendor.id },
      data: { vendorName: data.vendorName },
    });
  } else {
    monVendor = await prisma.tPRMMonitoringVendor.create({
      data: {
        customerAccountId,
        vendorName: data.vendorName,
        vendorURL: data.vendorURL,
      },
    });
  }

  // Mark previous assessments as not latest
  await prisma.tPRMMonitoringAssessment.updateMany({
    where: { monitoringVendorId: monVendor.id, isLatest: true },
    data: { isLatest: false },
  });

  // Create assessment
  const assessment = await prisma.tPRMMonitoringAssessment.create({
    data: {
      customerAccountId,
      monitoringVendorId: monVendor.id,
      vendorName: data.vendorName,
      vendorURL: data.vendorURL,
      jobID: data.jobID,
      status: data.status,
      overallSummary: data.overallSummary,
      overallScore: data.overallScore,
      securityPostureScore: data.securityPostureScore,
      threatExposureScore: data.threatExposureScore,
      securityPostureSummary: data.securityPostureSummary,
      threatExposureSummary: data.threatExposureSummary,
      lastScan: new Date(),
      isLatest: true,
    },
  });

  // Compliance & Legal
  if (data.complianceAndLegal) {
    const cal = await prisma.tPRMComplianceAndLegal.create({
      data: {
        assessmentId: assessment.id,
        privacyPolicyUrl: data.complianceAndLegal.privacyPolicyUrl,
        dpaUrl: data.complianceAndLegal.dpaUrl,
      },
    });
    if (data.complianceAndLegal.laws.length > 0) {
      await prisma.tPRMLaw.createMany({
        data: data.complianceAndLegal.laws.map((l) => ({
          complianceId: cal.id,
          lawName: l.lawName,
        })),
      });
    }
    if (data.complianceAndLegal.certifications.length > 0) {
      await prisma.tPRMCertification.createMany({
        data: data.complianceAndLegal.certifications.map((c) => ({
          complianceId: cal.id,
          name: c.name,
        })),
      });
    }
  }

  // Recommendation
  if (data.recommendation?.statement) {
    await prisma.tPRMMonitoringRecommendation.create({
      data: {
        assessmentId: assessment.id,
        statement: data.recommendation.statement,
      },
    });
  }

  // KPI Details
  for (const kpi of data.kpiDetails) {
    const kpiRecord = await prisma.tPRMKPIDetail.create({
      data: {
        assessmentId: assessment.id,
        kpiName: kpi.kpiName,
        kpiType: kpi.kpiType,
        securityScore: kpi.securityScore,
        summary: kpi.summary,
        riskScore: kpi.riskScore,
        recommendation: kpi.recommendation,
        cveId: kpi.cveId,
        severity: kpi.severity,
        description: kpi.description,
        affectedComponent: kpi.affectedComponent,
      },
    });

    if (kpi.keyFindings.length > 0) {
      await prisma.tPRMKeyFinding.createMany({
        data: kpi.keyFindings.map((f) => ({
          kpiDetailId: kpiRecord.id,
          statement: f.statement,
        })),
      });
    }
    if (kpi.sources.length > 0) {
      await prisma.tPRMSource.createMany({
        data: kpi.sources.map((s) => ({
          kpiDetailId: kpiRecord.id,
          name: s.name,
        })),
      });
    }
    if (kpi.vulnerabilities.length > 0) {
      await prisma.tPRMVulnerabilityFinding.createMany({
        data: kpi.vulnerabilities.map((v) => ({
          kpiDetailId: kpiRecord.id,
          cveId: v.cveId,
          severity: v.severity,
          affectedComponent: v.affectedComponent,
          description: v.description,
        })),
      });
    }
  }

  // HTTP Headers
  for (const hdr of data.httpHeaders) {
    const hdrRecord = await prisma.tPRMHTTPHeader.create({
      data: {
        assessmentId: assessment.id,
        name: hdr.name,
        present: hdr.present ?? false,
        value: hdr.value,
        recommendation: hdr.recommendation,
        description: hdr.description,
      },
    });
    if (hdr.platforms && hdr.platforms.length > 0) {
      await prisma.tPRMPlatform.createMany({
        data: hdr.platforms.map((p) => ({
          httpHeaderId: hdrRecord.id,
          server: p.server,
        })),
      });
    }
  }

  return { vendorId: monVendor.id, assessmentId: assessment.id };
}

// ==================== ROUTE HANDLERS ====================

// POST — submit a vendor scan (OpenAI-powered)
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      // Check subscription plan assessment limit
      const assessmentCheck = await checkAssessmentLimit(customerAccountId);
      if (!assessmentCheck.allowed) {
        return NextResponse.json({ error: assessmentCheck.message }, { status: 403 });
      }

      const { vendorName, vendorURL } = (await req.json()) as {
        vendorName?: string;
        vendorURL?: string;
      };

      if (!vendorName && !vendorURL) {
        return NextResponse.json(
          { error: "vendorName or vendorURL is required" },
          { status: 400 }
        );
      }

      // Normalize URL
      let normalizedURL = (vendorURL || "").trim();
      if (normalizedURL && !normalizedURL.startsWith("http")) {
        normalizedURL = `https://${normalizedURL}`;
      }

      // Generate a unique job ID
      const jobId = `openai_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      console.log("\n🔵🔵🔵 [SCAN SUBMIT] Starting OpenAI scan:", { vendorName, vendorURL: normalizedURL, jobId });

      // Upsert monitoring vendor
      let monVendor = normalizedURL
        ? await prisma.tPRMMonitoringVendor.findFirst({
            where: { customerAccountId, vendorURL: normalizedURL },
          })
        : null;

      if (monVendor) {
        monVendor = await prisma.tPRMMonitoringVendor.update({
          where: { id: monVendor.id },
          data: { vendorName: vendorName || monVendor.vendorName },
        });
      } else {
        monVendor = await prisma.tPRMMonitoringVendor.create({
          data: {
            customerAccountId,
            vendorName: vendorName || "",
            vendorURL: normalizedURL,
          },
        });
      }

      // Mark previous assessments as not latest
      await prisma.tPRMMonitoringAssessment.updateMany({
        where: { monitoringVendorId: monVendor.id, isLatest: true },
        data: { isLatest: false },
      });

      // Create placeholder assessment with "processing" status
      const placeholder = await prisma.tPRMMonitoringAssessment.create({
        data: {
          customerAccountId,
          monitoringVendorId: monVendor.id,
          vendorName: vendorName || "",
          vendorURL: normalizedURL,
          jobID: jobId,
          status: "processing",
          isLatest: true,
        },
      });

      console.log("💾 [SCAN] Created processing placeholder — vendorId:", monVendor.id, "| jobId:", jobId);

      // Fire-and-forget: run OpenAI scan in background
      const vendorId = monVendor.id;
      const sessionId = session.id;
      void (async () => {
        try {
          const raw = await runVendorScan({
            vendorName: vendorName || "",
            vendorURL: normalizedURL,
          });

          // Save raw response JSON
          await saveResponseJson(vendorName || jobId, raw);

          // Map and persist using existing functions
          const mapped = mapExternalToInternal(raw as unknown as Record<string, unknown>, jobId);
          console.log("🟢 [SCAN] Mapped:", { vendorName: mapped.vendorName, overallScore: mapped.overallScore, kpiCount: mapped.kpiDetails.length });

          // Remove the placeholder
          await prisma.tPRMMonitoringAssessment.delete({ where: { id: placeholder.id } }).catch(() => {});

          // Persist full assessment — pass vendorId so it uses the correct vendor record
          const { assessmentId } = await persistAssessment(customerAccountId, mapped, vendorId);
          console.log("✅ [SCAN] Persisted — assessmentId:", assessmentId);

          // Send notifications
          try {
            const boAmUsers = await prisma.user.findMany({
              where: {
                customerAccountId, isActive: true,
                OR: [
                  { role: { in: ['GRCAdministrator', 'CustomerAdministrator'] } },
                  { tprmRole: { in: ['Business Owner', 'Account Manager'] } },
                ],
              },
              select: { id: true },
              take: 20,
            });
            const recipientIds = boAmUsers.map(u => u.id).filter(uid => uid !== sessionId);

            if (recipientIds.length > 0) {
              void notificationService.notifyTPRMMonitoringScanCompleted({
                customerAccountId,
                actorId: sessionId,
                recipientIds,
                vendorName: mapped.vendorName,
                riskScore: mapped.overallScore,
              });
              if (mapped.overallScore != null && mapped.overallScore <= 40) {
                void notificationService.notifyTPRMMonitoringCriticalRisk({
                  customerAccountId,
                  actorId: sessionId,
                  recipientIds,
                  vendorName: mapped.vendorName,
                  riskScore: mapped.overallScore,
                });
              }
            }
          } catch (notifErr) {
            console.error("⚠️ [SCAN] Notification error:", notifErr);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("❌ [SCAN] Background scan failed:", errMsg, err);
          // Mark placeholder as error and store error message
          await prisma.tPRMMonitoringAssessment.update({
            where: { id: placeholder.id },
            data: { status: "error", isLatest: false, overallSummary: `Scan error: ${errMsg}` },
          }).catch(() => {});
        }
      })();

      return NextResponse.json({
        jobId,
        vendorId,
        status: "processing",
      });
    } catch (err) {
      console.error("❌ [SCAN SUBMIT] Exception:", err);
      return NextResponse.json(
        { error: "Failed to submit scan" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "create" }
);

// GET — poll scan status from DB (background OpenAI scan updates the record when done)
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const jobId = searchParams.get("jobId");

      if (!jobId) {
        return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      }

      // Check DB for the assessment status
      const assessment = await prisma.tPRMMonitoringAssessment.findFirst({
        where: { jobID: jobId, customerAccountId },
        select: { id: true, status: true, monitoringVendorId: true, overallSummary: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      const status = assessment.status || "processing";

      // If still processing, tell frontend to keep polling
      if (status === "queued" || status === "processing") {
        return NextResponse.json({ jobId, status });
      }

      // If error, tell frontend to stop polling — include the actual error message
      if (status === "error") {
        const errorDetail = assessment.overallSummary?.startsWith("Scan error:")
          ? assessment.overallSummary.replace("Scan error: ", "")
          : "Scan failed. Please re-trigger.";
        return NextResponse.json({
          status: "done",
          error: errorDetail,
        });
      }

      // Status is "done" — the background task already persisted the full result
      // Find the completed assessment (the background task creates a new record with status "done")
      const completedAssessment = await prisma.tPRMMonitoringAssessment.findFirst({
        where: { jobID: jobId, customerAccountId, status: "done" },
        select: { id: true, monitoringVendorId: true },
      });

      return NextResponse.json({
        status: "done",
        vendorId: completedAssessment?.monitoringVendorId || assessment.monitoringVendorId,
        assessmentId: completedAssessment?.id || assessment.id,
      });
    } catch (err) {
      console.error("❌ [SCAN POLL] Exception:", err);
      return NextResponse.json({ error: "Failed to check scan status" }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "view" }
);

// DELETE /api/tprm/monitoring/scan?jobId=xxx — Cancel a queued/processing assessment
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const jobId = searchParams.get("jobId");

      if (!jobId) {
        return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      }

      // Find the assessment by jobId scoped to customer
      const assessment = await prisma.tPRMMonitoringAssessment.findFirst({
        where: {
          jobID: jobId,
          customerAccountId,
          status: { in: ["queued", "processing"] },
        },
        select: { id: true, monitoringVendorId: true },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Queued assessment not found" }, { status: 404 });
      }

      // Delete the placeholder assessment record
      await prisma.tPRMMonitoringAssessment.delete({ where: { id: assessment.id } });

      // If the vendor has no other assessments, delete the vendor record too
      const remaining = await prisma.tPRMMonitoringAssessment.count({
        where: { monitoringVendorId: assessment.monitoringVendorId },
      });
      if (remaining === 0) {
        await prisma.tPRMMonitoringVendor.delete({ where: { id: assessment.monitoringVendorId } }).catch(() => {});
      }

      console.log(`[SCAN] Cancelled queued assessment: jobId=${jobId}`);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[SCAN] Error cancelling assessment:", error);
      return NextResponse.json({ error: "Failed to cancel assessment" }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring"], action: "edit" }
);
