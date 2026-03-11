import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { getExternalApiUrl } from "@/config/external-apis";
import { notificationService } from "@/lib/notification-service";

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

// Use the same Python backend URL as all other AI services
function getScanApiUrl(path: string): string {
  return getExternalApiUrl('PYTHON_BACKEND', path);
}

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
  let vendorURL = (raw.vendor_url as string) || "";
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
  data: MappedAssessment
): Promise<{ vendorId: string; assessmentId: string }> {
  // Upsert vendor
  let monVendor = await prisma.tPRMMonitoringVendor.findFirst({
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

// POST — submit a scan to the external scanning API
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
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

      console.log("\n🔵🔵🔵 [SCAN SUBMIT] Sending request to external API:", { vendorName, vendorURL, url: getScanApiUrl('risk_score_assess/submit') });

      const res = await fetch(getScanApiUrl('risk_score_assess/submit'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_name: vendorName || "",
          vendor_url: vendorURL || "",
          require_realtime: true,
          min_intel: 3,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌❌❌ [SCAN SUBMIT] External API error:", res.status, text);
        return NextResponse.json(
          { error: "External scanning API error" },
          { status: 502 }
        );
      }

      const data = await res.json();
      const jobId = data.job_id;
      console.log("✅✅✅ [SCAN SUBMIT] Got job_id:", jobId, "| status:", data.status);

      // Persist a "queued" record so the scan survives page navigation
      let normalizedURL = (vendorURL || "").trim();
      if (normalizedURL && !normalizedURL.startsWith("http")) {
        normalizedURL = `https://${normalizedURL}`;
      }

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

      // Create a placeholder assessment with "queued" status
      await prisma.tPRMMonitoringAssessment.create({
        data: {
          customerAccountId,
          monitoringVendorId: monVendor.id,
          vendorName: vendorName || "",
          vendorURL: normalizedURL,
          jobID: jobId,
          status: "queued",
          isLatest: true,
        },
      });

      console.log("💾💾💾 [SCAN SUBMIT] Persisted queued record — vendorId:", monVendor.id, "| jobId:", jobId);

      return NextResponse.json({
        jobId,
        vendorId: monVendor.id,
        status: data.status || "queued",
      });
    } catch (err) {
      console.error("❌❌❌ [SCAN SUBMIT] Exception:", err);
      return NextResponse.json(
        { error: "Failed to submit scan" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "create" }
);

// GET — poll status; when done, fetch result, map, and persist
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const jobId = searchParams.get("jobId");

      if (!jobId) {
        return NextResponse.json(
          { error: "jobId is required" },
          { status: 400 }
        );
      }

      // Check status with the external API
      console.log("\n🟡🟡🟡 [SCAN POLL] Checking status for job:", jobId);
      const statusRes = await fetch(
        getScanApiUrl(`risk_score_assess/status/${jobId}`)
      );
      if (!statusRes.ok) {
        console.error("❌❌❌ [SCAN POLL] Status API error:", statusRes.status, await statusRes.text());
        return NextResponse.json(
          { error: "Failed to check scan status" },
          { status: 502 }
        );
      }

      const statusData = await statusRes.json();
      const status = statusData.status;
      console.log("🟡🟡🟡 [SCAN POLL] Job", jobId, "→ status:", status);

      // If not done yet, update DB status and return for the frontend to keep polling
      if (status !== "done") {
        // Update assessment status in DB (e.g., queued → processing)
        await prisma.tPRMMonitoringAssessment.updateMany({
          where: { jobID: jobId, status: { not: status } },
          data: { status },
        });
        return NextResponse.json({ jobId, status });
      }

      // Status is "done" — fetch the full result
      console.log("\n🟢🟢🟢 [SCAN RESULT] Status is DONE! Fetching full result for job:", jobId);
      const resultRes = await fetch(
        getScanApiUrl(`risk_score_assess/result/${jobId}`)
      );
      if (!resultRes.ok) {
        console.error("❌❌❌ [SCAN RESULT] Result API error:", resultRes.status, await resultRes.text());
        return NextResponse.json(
          { error: "Failed to fetch scan result" },
          { status: 502 }
        );
      }

      const raw = (await resultRes.json()) as Record<string, unknown>;
      console.log("🟢🟢🟢 [SCAN RESULT] Raw response keys:", Object.keys(raw));
      console.log("🟢🟢🟢 [SCAN RESULT] overall_score:", raw.overall_score, "| kpi_details count:", Array.isArray(raw.kpi_details) ? (raw.kpi_details as unknown[]).length : 0);
      console.log("🟢🟢🟢 [SCAN RESULT] http_security_headers type:", typeof raw.http_security_headers, "| isArray:", Array.isArray(raw.http_security_headers), "| value:", JSON.stringify(raw.http_security_headers)?.substring(0, 500));

      // Save raw response JSON to scan-results folder
      await saveResponseJson((raw.vendor_name as string) || jobId, raw);

      // Map + persist — wrapped so mapping errors still return "done" to release the queue
      try {
        // Idempotency check — skip if already persisted for this jobId
        const alreadyDone = await prisma.tPRMMonitoringAssessment.findFirst({
          where: { jobID: jobId, status: "done" },
          select: { id: true, monitoringVendorId: true },
        });
        if (alreadyDone) {
          console.log("⏩⏩⏩ [SCAN RESULT] Already persisted for job:", jobId, "— skipping duplicate");
          // Clean up any leftover placeholders
          await prisma.tPRMMonitoringAssessment.updateMany({
            where: { jobID: jobId, status: { in: ["queued", "processing"] } },
            data: { isLatest: false },
          });
          return NextResponse.json({
            status: "done",
            vendorId: alreadyDone.monitoringVendorId,
            assessmentId: alreadyDone.id,
          });
        }

        const mapped = mapExternalToInternal(raw, jobId);
        console.log("🟢🟢🟢 [SCAN RESULT] Mapped:", { vendorName: mapped.vendorName, vendorURL: mapped.vendorURL, overallScore: mapped.overallScore, kpiCount: mapped.kpiDetails.length, headerCount: mapped.httpHeaders.length });

        // Clean up the queued/processing placeholder assessment
        await prisma.tPRMMonitoringAssessment.updateMany({
          where: { jobID: jobId, status: { in: ["queued", "processing"] } },
          data: { isLatest: false },
        });

        // Persist to database
        console.log("💾💾💾 [SCAN PERSIST] Saving to database...");
        const { vendorId, assessmentId } = await persistAssessment(
          customerAccountId,
          mapped
        );

        console.log("✅✅✅ [SCAN PERSIST] Saved successfully — vendorId:", vendorId, "| assessmentId:", assessmentId);

        // Send monitoring notifications
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
          const recipientIds = boAmUsers.map(u => u.id).filter(uid => uid !== session.id);
          const overallScore = mapped.overallScore;

          if (recipientIds.length > 0) {
            // Always notify scan completed
            void notificationService.notifyTPRMMonitoringScanCompleted({
              customerAccountId,
              actorId: session.id,
              recipientIds,
              vendorName: mapped.vendorName,
              riskScore: overallScore,
            });

            // If critical risk detected (score <= 40 = high risk)
            if (overallScore != null && overallScore <= 40) {
              void notificationService.notifyTPRMMonitoringCriticalRisk({
                customerAccountId,
                actorId: session.id,
                recipientIds,
                vendorName: mapped.vendorName,
                riskScore: overallScore,
              });
            }
          }
        } catch (notifErr) {
          console.error("⚠️ [SCAN NOTIFY] Failed to send scan notifications:", notifErr);
        }

        return NextResponse.json({
          status: "done",
          vendorId,
          assessmentId,
        });
      } catch (mappingErr) {
        console.error("❌❌❌ [SCAN MAPPING/PERSIST] Failed to map or persist result:", mappingErr);
        // Still return "done" so the frontend removes it from the queue
        // Clean up the queued placeholder anyway
        await prisma.tPRMMonitoringAssessment.updateMany({
          where: { jobID: jobId, status: { in: ["queued", "processing"] } },
          data: { isLatest: false, status: "error" },
        }).catch(() => {});
        return NextResponse.json({
          status: "done",
          error: "Scan completed but failed to save results. Please re-trigger.",
        });
      }
    } catch (err) {
      console.error("❌❌❌ [SCAN POLL] Exception:", err);
      return NextResponse.json(
        { error: "Failed to process scan result" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "view" }
);
