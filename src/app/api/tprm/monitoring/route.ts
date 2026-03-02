import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all monitoring vendors with their latest assessment
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const vendorId = searchParams.get("vendorId"); // fetch all assessments for a specific vendor

      if (vendorId) {
        // Return full assessment history for one vendor
        const vendor = await prisma.tPRMMonitoringVendor.findFirst({
          where: { id: vendorId, ...tenantFilter },
          include: {
            assessments: {
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
          },
        });

        if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ data: vendor });
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
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ data: vendors });
    } catch (err) {
      console.error("[TPRM Monitoring GET]", err);
      return NextResponse.json({ error: "Failed to fetch monitoring data" }, { status: 500 });
    }
  },
  { resource: "tprm.monitoring", action: "view" }
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

      return NextResponse.json({ data: { vendorId: monVendor.id, assessmentId: newAssessment.id } }, { status: 201 });
    } catch (err) {
      console.error("[TPRM Monitoring POST]", err);
      return NextResponse.json({ error: "Failed to save monitoring data" }, { status: 500 });
    }
  },
  { resource: "tprm.monitoring", action: "create" }
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
  { resource: "tprm.monitoring", action: "edit" }
);
