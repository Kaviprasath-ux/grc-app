import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// Recalculate scores for assessments using current scorecard config
interface KpiLike { kpiName: string; securityScore: number | null }
interface AssessmentLike {
  id: string;
  kpiDetails: KpiLike[];
  calculatedSecurityPosture: number | null;
  calculatedThreatExposure: number | null;
  calculatedOverallScore: number | null;
}

async function recalcAssessmentScores(
  customerAccountId: string,
  assessments: AssessmentLike[]
) {
  const factors = await prisma.tPRMScorecardFactor.findMany({
    where: { customerAccountId },
  });
  if (!factors.length) return;

  const config = await prisma.tPRMConfiguration.findUnique({
    where: { customerAccountId },
  });
  const formula = config?.scoringFormula || "AVG";
  const spWeight = config?.securityPostureWeight ?? 50;
  const teWeight = config?.threatExposureWeight ?? 50;

  for (const assessment of assessments) {
    const kpis = assessment.kpiDetails;

    function calcScore(scoreType: string): number | null {
      const typeFactors = factors.filter(
        (f) => f.scoreType === scoreType && f.weightage > 0 && f.isMandatory
      );
      if (!typeFactors.length) return null;
      let totalWeightedScore = 0;
      let hasAnyMatch = false;
      for (const factor of typeFactors) {
        const kpi = kpis.find(
          (k) =>
            k.kpiName.toLowerCase().trim() ===
            factor.name.toLowerCase().trim()
        );
        if (kpi?.securityScore != null) {
          totalWeightedScore += kpi.securityScore * factor.weightage;
          hasAnyMatch = true;
        }
      }
      if (!hasAnyMatch) return null;
      return totalWeightedScore / 100;
    }

    const calcSP = calcScore("SecurityPosture");
    const calcTE = calcScore("ThreatExposure");
    let calcOverall: number | null = null;
    if (calcSP != null && calcTE != null && spWeight + teWeight > 0) {
      calcOverall =
        (calcSP * spWeight + calcTE * teWeight) / (spWeight + teWeight);
    }

    const rounded = {
      calculatedSecurityPosture:
        calcSP != null ? Math.round(calcSP * 100) / 100 : null,
      calculatedThreatExposure:
        calcTE != null ? Math.round(calcTE * 100) / 100 : null,
      calculatedOverallScore:
        calcOverall != null ? Math.round(calcOverall * 100) / 100 : null,
    };

    // Update in-memory for the response
    assessment.calculatedSecurityPosture = rounded.calculatedSecurityPosture;
    assessment.calculatedThreatExposure = rounded.calculatedThreatExposure;
    assessment.calculatedOverallScore = rounded.calculatedOverallScore;

    // Persist to DB (fire-and-forget)
    void prisma.tPRMMonitoringAssessment.update({
      where: { id: assessment.id },
      data: rounded,
    });
  }
}

// GET all monitoring vendors with their latest assessment
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes('GRCAdministrator') });
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const vendorId = searchParams.get("vendorId"); // fetch all assessments for a specific vendor

      // Auto-expire stale queued/processing assessments (older than 10 minutes)
      const STALE_THRESHOLD_MS = 10 * 60 * 1000;
      const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS);
      const staleResult = await prisma.tPRMMonitoringAssessment.updateMany({
        where: {
          customerAccountId,
          status: { in: ["queued", "processing"] },
          createdAt: { lt: staleDate },
        },
        data: { status: "error", isLatest: false },
      });

      // Clean up orphan vendors that have ONLY error/stale assessments (no successful scans)
      if (staleResult.count > 0) {
        const orphanVendors = await prisma.tPRMMonitoringVendor.findMany({
          where: {
            customerAccountId,
            assessments: { every: { status: "error" } },
          },
          select: { id: true },
        });
        if (orphanVendors.length > 0) {
          const orphanIds = orphanVendors.map((v) => v.id);
          // Delete assessments first, then vendors
          await prisma.tPRMMonitoringAssessment.deleteMany({ where: { monitoringVendorId: { in: orphanIds } } });
          await prisma.tPRMMonitoringVendor.deleteMany({ where: { id: { in: orphanIds } } });
        }
      }

      if (vendorId) {
        // Return full assessment history for one vendor (exclude placeholder records)
        const vendor = await prisma.tPRMMonitoringVendor.findFirst({
          where: { id: vendorId, ...tenantFilter },
          include: {
            assessments: {
              where: { status: { notIn: ["queued", "processing", "error"] } },
              include: {
                complianceAndLegal: { include: { laws: true, certifications: true } },
                recommendation: true,
                kpiDetails: {
                  include: { keyFindings: true, sources: true, vulnerabilities: true },
                  orderBy: { kpiName: "asc" },
                },
                httpHeaders: {
                  include: { platforms: true },
                  orderBy: { name: "asc" },
                },
              },
              orderBy: { createdAt: "desc" },
            },
            // Latest onboarding-assessment status — same derivation
            // as the list endpoint feeds the detail page's pill.
            tprmVendor: {
              select: {
                id: true,
                status: true,
                assessments: {
                  where: { assessmentType: "Onboarding Assessment" },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { status: true },
                },
              },
            },
          },
        });

        if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Recalculate scores from current scorecard config on every load
        await recalcAssessmentScores(customerAccountId, vendor.assessments);

        const ONBOARDED_STATUSES = new Set(["Completed", "Approved"]);
        const latest = vendor.tprmVendor?.assessments[0]?.status;
        const onboardingStatus: "Onboarded" | "Onboarding" | null = vendor.tprmVendor
          ? (latest && ONBOARDED_STATUSES.has(latest) ? "Onboarded" : "Onboarding")
          : null;

        return NextResponse.json({ data: { ...vendor, onboardingStatus } });
      }

      const where: Record<string, unknown> = { ...tenantFilter };
      if (search) {
        where.OR = [
          { vendorName: { contains: search, mode: "insensitive" } },
          { vendorURL: { contains: search, mode: "insensitive" } },
        ];
      }

      const vendors = await prisma.tPRMMonitoringVendor.findMany({
        where,
        include: {
          assessments: {
            where: { isLatest: true },
            include: {
              complianceAndLegal: { include: { laws: true, certifications: true } },
              recommendation: true,
              kpiDetails: {
                include: { keyFindings: true, sources: true, vulnerabilities: true },
                orderBy: { kpiName: "asc" },
              },
              httpHeaders: {
                include: { platforms: true },
                orderBy: { name: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          // Latest onboarding assessment status on the linked TPRM
          // vendor — drives the Onboarding/Onboarded pill on the
          // monitoring list. Historically the pill just read
          // vendorOnboarded (a boolean set on link/unlink), so a
          // vendor whose onboarding assessment was still in
          // progress was already shown as fully "Onboarded".
          tprmVendor: {
            select: {
              id: true,
              status: true,
              assessments: {
                where: { assessmentType: "Onboarding Assessment" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Recalculate scores for all latest assessments
      const allAssessments = vendors.flatMap((v) => v.assessments);
      if (allAssessments.length > 0) {
        await recalcAssessmentScores(customerAccountId, allAssessments);
      }

      // Derive onboarding pill state from the linked TPRM vendor's
      // latest Onboarding Assessment. Three states:
      //   'Onboarded'  — vendor linked AND onboarding assessment is
      //                  Completed or Approved (assessor closed it out)
      //   'Onboarding' — vendor linked but onboarding assessment is
      //                  still in progress (any other status), OR
      //                  linked with no assessment on record yet
      //   null         — no linked TPRM vendor (monitoring-only row)
      //
      // We do NOT trust the stored `vendorOnboarded` boolean alone: it
      // flips to true on link and never flips back, so a vendor whose
      // onboarding is still open would previously show as fully
      // Onboarded on the monitoring grid.
      const ONBOARDED_STATUSES = new Set(["Completed", "Approved"]);
      const withPillState = vendors.map((v) => {
        const linked = v.tprmVendor;
        let onboardingStatus: "Onboarded" | "Onboarding" | null = null;
        if (linked) {
          const latest = linked.assessments[0]?.status;
          onboardingStatus = latest && ONBOARDED_STATUSES.has(latest)
            ? "Onboarded"
            : "Onboarding";
        }
        return { ...v, onboardingStatus };
      });

      return NextResponse.json({ data: withPillState });
    } catch (err) {
      console.error("[TPRM Monitoring GET]", err);
      return NextResponse.json({ error: "Failed to fetch monitoring data" }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "view" }
);

// POST — ingest a full monitoring API response and persist it
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();

      // body shape mirrors MonitoringVendor from the diagram
      const {
        vendorName,
        vendorURL,
        vendorOnboarded = false,
        assessment, // single MonitoringAssessment object
      } = body as {
        vendorName: string;
        vendorURL: string;
        vendorOnboarded?: boolean;
        assessment: {
          jobID?: string;
          status?: string;
          overallSummary?: string;
          overallScore?: number;
          securityPostureScore?: number;
          threatExposureScore?: number;
          securityPostureSummary?: string;
          threatExposureSummary?: string;
          lastScan?: string;
          nextScan?: string;
          downloadType?: string;
          calculatedSecurityPosture?: number;
          calculatedThreatExposure?: number;
          calculatedOverallScore?: number;
          complianceAndLegal?: {
            privacyPolicyUrl?: string;
            dpaUrl?: string;
            laws?: { lawName: string }[];
            certifications?: { name: string }[];
          };
          recommendation?: { statement: string };
          kpiDetails?: {
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
            keyFindings?: { statement: string }[];
            sources?: { name: string }[];
            vulnerabilities?: {
              cveId?: string;
              severity?: string;
              affectedComponent?: string;
              description?: string;
            }[];
          }[];
          httpHeaders?: {
            name: string;
            present?: boolean;
            value?: string;
            recommendation?: string;
            description?: string;
            platforms?: { server: string }[];
          }[];
        };
      };

      if (!vendorName || !vendorURL || !assessment) {
        return NextResponse.json({ error: "vendorName, vendorURL, and assessment are required" }, { status: 400 });
      }

      // Upsert the MonitoringVendor
      let monVendor = await prisma.tPRMMonitoringVendor.findFirst({
        where: { customerAccountId, vendorURL },
      });

      if (monVendor) {
        monVendor = await prisma.tPRMMonitoringVendor.update({
          where: { id: monVendor.id },
          data: { vendorName, vendorOnboarded },
        });
      } else {
        monVendor = await prisma.tPRMMonitoringVendor.create({
          data: { customerAccountId, vendorName, vendorURL, vendorOnboarded },
        });
      }

      // Mark all previous assessments for this vendor as not latest
      await prisma.tPRMMonitoringAssessment.updateMany({
        where: { monitoringVendorId: monVendor.id, isLatest: true },
        data: { isLatest: false },
      });

      // Create new assessment
      const newAssessment = await prisma.tPRMMonitoringAssessment.create({
        data: {
          customerAccountId,
          monitoringVendorId: monVendor.id,
          vendorName,
          vendorURL,
          jobID: assessment.jobID,
          status: assessment.status,
          overallSummary: assessment.overallSummary,
          overallScore: assessment.overallScore,
          securityPostureScore: assessment.securityPostureScore,
          threatExposureScore: assessment.threatExposureScore,
          securityPostureSummary: assessment.securityPostureSummary,
          threatExposureSummary: assessment.threatExposureSummary,
          lastScan: assessment.lastScan ? new Date(assessment.lastScan) : null,
          nextScan: assessment.nextScan,
          isLatest: true,
          downloadType: assessment.downloadType,
          calculatedSecurityPosture: assessment.calculatedSecurityPosture,
          calculatedThreatExposure: assessment.calculatedThreatExposure,
          calculatedOverallScore: assessment.calculatedOverallScore,
        },
      });

      // ComplianceAndLegal
      if (assessment.complianceAndLegal) {
        const cal = await prisma.tPRMComplianceAndLegal.create({
          data: {
            assessmentId: newAssessment.id,
            privacyPolicyUrl: assessment.complianceAndLegal.privacyPolicyUrl,
            dpaUrl: assessment.complianceAndLegal.dpaUrl,
          },
        });
        if (assessment.complianceAndLegal.laws?.length) {
          await prisma.tPRMLaw.createMany({
            data: assessment.complianceAndLegal.laws.map((l) => ({ complianceId: cal.id, lawName: l.lawName })),
          });
        }
        if (assessment.complianceAndLegal.certifications?.length) {
          await prisma.tPRMCertification.createMany({
            data: assessment.complianceAndLegal.certifications.map((c) => ({ complianceId: cal.id, name: c.name })),
          });
        }
      }

      // Recommendation
      if (assessment.recommendation?.statement) {
        await prisma.tPRMMonitoringRecommendation.create({
          data: { assessmentId: newAssessment.id, statement: assessment.recommendation.statement },
        });
      }

      // KPI Details
      if (assessment.kpiDetails?.length) {
        for (const kpi of assessment.kpiDetails) {
          const kpiRecord = await prisma.tPRMKPIDetail.create({
            data: {
              assessmentId: newAssessment.id,
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

          if (kpi.keyFindings?.length) {
            await prisma.tPRMKeyFinding.createMany({
              data: kpi.keyFindings.map((f) => ({ kpiDetailId: kpiRecord.id, statement: f.statement })),
            });
          }
          if (kpi.sources?.length) {
            await prisma.tPRMSource.createMany({
              data: kpi.sources.map((s) => ({ kpiDetailId: kpiRecord.id, name: s.name })),
            });
          }
          if (kpi.vulnerabilities?.length) {
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
      }

      // HTTP Headers
      if (assessment.httpHeaders?.length) {
        for (const hdr of assessment.httpHeaders) {
          const hdrRecord = await prisma.tPRMHTTPHeader.create({
            data: {
              assessmentId: newAssessment.id,
              name: hdr.name,
              present: hdr.present ?? false,
              value: hdr.value,
              recommendation: hdr.recommendation,
              description: hdr.description,
            },
          });
          if (hdr.platforms?.length) {
            await prisma.tPRMPlatform.createMany({
              data: hdr.platforms.map((p) => ({ httpHeaderId: hdrRecord.id, server: p.server })),
            });
          }
        }
      }

      // ── Calculate scores from scorecard configuration ──
      const factors = await prisma.tPRMScorecardFactor.findMany({
        where: { customerAccountId },
      });
      const config = await prisma.tPRMConfiguration.findUnique({
        where: { customerAccountId },
      });
      const formula = config?.scoringFormula || "AVG";
      const spWeight = config?.securityPostureWeight ?? 50;
      const teWeight = config?.threatExposureWeight ?? 50;

      const savedKpis = await prisma.tPRMKPIDetail.findMany({
        where: { assessmentId: newAssessment.id },
      });

      function calcScore(scoreType: string): number | null {
        const typeFactors = factors.filter(
          (f) => f.scoreType === scoreType && f.weightage > 0 && f.isMandatory
        );
        if (!typeFactors.length) return null;
        let totalWeightedScore = 0;
        let hasAnyMatch = false;
        for (const factor of typeFactors) {
          const kpi = savedKpis.find(
            (k) =>
              k.kpiName.toLowerCase().trim() ===
              factor.name.toLowerCase().trim()
          );
          if (kpi?.securityScore != null) {
            totalWeightedScore += kpi.securityScore * factor.weightage;
            hasAnyMatch = true;
          }
        }
        if (!hasAnyMatch) return null;
        return totalWeightedScore / 100;
      }

      const calcSP = calcScore("SecurityPosture");
      const calcTE = calcScore("ThreatExposure");
      let calcOverall: number | null = null;
      if (calcSP != null && calcTE != null && spWeight + teWeight > 0) {
        calcOverall =
          (calcSP * spWeight + calcTE * teWeight) / (spWeight + teWeight);
      }

      await prisma.tPRMMonitoringAssessment.update({
        where: { id: newAssessment.id },
        data: {
          calculatedSecurityPosture:
            calcSP != null ? Math.round(calcSP * 100) / 100 : null,
          calculatedThreatExposure:
            calcTE != null ? Math.round(calcTE * 100) / 100 : null,
          calculatedOverallScore:
            calcOverall != null ? Math.round(calcOverall * 100) / 100 : null,
        },
      });

      return NextResponse.json({ data: { vendorId: monVendor.id, assessmentId: newAssessment.id } }, { status: 201 });
    } catch (err) {
      console.error("[TPRM Monitoring POST]", err);
      return NextResponse.json({ error: "Failed to save monitoring data" }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "create" }
);

// PATCH — link a monitoring vendor to a TPRM vendor
export const PATCH = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id, tprmVendorId } = await req.json() as { id: string; tprmVendorId: string | null };

      const monVendor = await prisma.tPRMMonitoringVendor.findFirst({
        where: { id, customerAccountId },
      });
      if (!monVendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (tprmVendorId) {
        const tprmVendor = await prisma.tPRMVendor.findFirst({
          where: { id: tprmVendorId, customerAccountId },
        });
        if (!tprmVendor) return NextResponse.json({ error: "TPRM vendor not found" }, { status: 404 });
      }

      const updated = await prisma.tPRMMonitoringVendor.update({
        where: { id },
        data: { tprmVendorId: tprmVendorId || null, vendorOnboarded: !!tprmVendorId },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      console.error("[TPRM Monitoring PATCH]", err);
      return NextResponse.json({ error: "Failed to update monitoring vendor" }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "edit" }
);
