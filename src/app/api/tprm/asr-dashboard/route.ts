import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET /api/tprm/asr-dashboard — aggregations for the Assessor dashboard that
// can't be expressed by the public assessments/issues endpoints.
//
// Why this exists: the Vendors bar chart used to plot each assessment once
// with the vendor's VRR as the "severity", which is a category (Critical/
// High/Moderate/Low) NOT a count of findings. That let a vendor with one
// Draft assessment show up as "Medium severity: 1" even though the vendor
// hadn't submitted anything. Here we count actual Unsatisfactory responses
// (AI poStatus or assessor override), restricted to assessments the vendor
// has at least submitted.
export const GET = withAuth(
  async (_req, _ctx, session) => {
    try {
      const tenantFilter = getTenantFilter(session, {
        globalAccess: session.roles.includes("GRCAdministrator"),
      });

      // Only include responses on assessments the vendor has already submitted
      // — Draft/Initiated/In-Progress assessments haven't produced verified
      // findings yet and would pollute the chart.
      const responses = await prisma.tPRMAssessmentResponse.findMany({
        where: {
          ...tenantFilter,
          assessment: { vendorSubmissionDate: { not: null } },
        },
        select: {
          poStatus: true,
          poSeverity: true,
          assessorStatus: true,
          assessorSeverity: true,
          assessment: {
            select: {
              vendor: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Map severity → bucket (Critical/High → High, Moderate/Medium →
      // Medium, Low/Nominal → Low). Keeps the chart's three-colour scheme.
      const bucketOf = (sev: string | null | undefined): "high" | "medium" | "low" | null => {
        if (!sev) return null;
        if (sev === "Critical" || sev === "High") return "high";
        if (sev === "Moderate" || sev === "Medium") return "medium";
        if (sev === "Low" || sev === "Nominal") return "low";
        return null;
      };

      const vendorMap = new Map<
        string,
        { vendor: string; vendorId: string; high: number; medium: number; low: number }
      >();

      for (const r of responses) {
        // A finding only counts on the dashboard once the assessor has
        // confirmed it. The AI's poStatus alone (set automatically on AM
        // submission) is a pre-screen, not a verdict — counting it here
        // would make issues "pop up" before the assessor has even opened
        // the assessment, which is exactly what users have reported.
        if (r.assessorStatus !== "Unsatisfactory") continue;

        const v = r.assessment?.vendor;
        if (!v?.id) continue;

        const key = v.id;
        if (!vendorMap.has(key)) {
          vendorMap.set(key, { vendor: v.name, vendorId: v.id, high: 0, medium: 0, low: 0 });
        }
        // Severity follows the assessor's verdict; poSeverity is only a
        // fallback if the assessor confirmed Unsatisfactory but didn't
        // re-set the severity (older flows leave it inherited from AI).
        const bucket = bucketOf(r.assessorSeverity || r.poSeverity);
        if (!bucket) continue;
        vendorMap.get(key)![bucket]++;
      }

      const vendorFindings = Array.from(vendorMap.values()).sort(
        (a, b) => (b.high + b.medium + b.low) - (a.high + a.medium + a.low),
      );

      return NextResponse.json({ vendorFindings });
    } catch (err) {
      console.error("[ASR Dashboard GET]", err);
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-dashboard", action: "view" },
);
