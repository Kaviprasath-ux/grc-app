import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId, resolveAuditHeadIdForCreate } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all internal audit risks with filters - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const year = searchParams.get("year");
      const departmentId = searchParams.get("departmentId");
      const search = searchParams.get("search");
      const status = searchParams.get("status");

      const tenantFilter = getTenantFilter(session);
      const where: any = { ...tenantFilter };

      // Filter by year
      if (year) {
        const yearNum = parseInt(year);
        where.creationDate = {
          gte: new Date(yearNum, 0, 1),
          lt: new Date(yearNum + 1, 0, 1),
        };
      }

      // Filter by department
      if (departmentId) {
        where.departmentId = departmentId;
      }

      // Filter by status
      if (status) {
        where.status = status;
      }

      // Search filter
      if (search) {
        where.OR = [
          { riskId: { contains: search } },
          { riskName: { contains: search } },
          { riskDescription: { contains: search } },
        ];
      }

      const risks = await prisma.internalAuditRisk.findMany({
        where,
        include: {
          department: true,
          category: true,
          auditType: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(risks);
    } catch (error) {
      console.error("Error fetching internal audit risks:", error);
      return NextResponse.json(
        { error: "Failed to fetch internal audit risks" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "view" }
);

// POST create a new internal audit risk - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();

      // Get customer account ID and audit head ID for the new record
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);
      const tenantFilter = getTenantFilter(session);

      // Generate risk ID - scoped to tenant, handles all legacy formats
      const existingRisks = await prisma.internalAuditRisk.findMany({
        where: tenantFilter,
        select: { riskId: true },
      });

      let maxRiskNumber = 0;
      for (const r of existingRisks) {
        const match = r.riskId.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxRiskNumber) maxRiskNumber = num;
        }
      }
      const riskId = `RID${String(maxRiskNumber + 1).padStart(3, "0")}`;

      // Fetch scoring config for this tenant
      const scoringConfig = await prisma.auditScoringConfig.findFirst({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });
      const piCalcType = scoringConfig?.probabilityImpactCalcType || "Product of all";
      const rrCalcType = scoringConfig?.riskRatingCalcType || "Product of all";

      // Calculate inherent score based on configured method
      let inherentScore = body.inherentScore;
      if (body.inherentLikelihood && body.inherentImpact && !inherentScore) {
        const likelihood = parseInt(body.inherentLikelihood);
        const impact = parseInt(body.inherentImpact);
        if (piCalcType === "Addition of all") {
          inherentScore = likelihood + impact;
        } else if (piCalcType === "High of all") {
          inherentScore = Math.max(likelihood, impact);
        } else {
          inherentScore = likelihood * impact;
        }
      }

      // Calculate residual score based on configured method
      let residualScore = body.residualScore;
      if (body.residualLikelihood && body.residualImpact && !residualScore) {
        const likelihood = parseInt(body.residualLikelihood);
        const impact = parseInt(body.residualImpact);
        if (piCalcType === "Addition of all") {
          residualScore = likelihood + impact;
        } else if (piCalcType === "High of all") {
          residualScore = Math.max(likelihood, impact);
        } else {
          residualScore = likelihood * impact;
        }
      }

      // Determine risk level using configured scoring ranges
      let riskLevel = "Low";
      if (residualScore) {
        const scoringRanges = await prisma.auditScoringRange.findMany({
          where: {
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            calculationType: rrCalcType,
          },
          orderBy: { lowValue: "desc" },
        });

        if (scoringRanges.length > 0) {
          for (const range of scoringRanges) {
            if (residualScore >= range.lowValue && (range.highValue === null || residualScore <= range.highValue)) {
              riskLevel = range.label;
              break;
            }
          }
        } else {
          // Fallback to default thresholds if no ranges configured
          if (residualScore >= 250) riskLevel = "Extreme";
          else if (residualScore >= 100) riskLevel = "High";
          else if (residualScore >= 50) riskLevel = "Medium";
          else riskLevel = "Low";
        }
      }

      const risk = await prisma.internalAuditRisk.create({
        data: {
          customerAccountId,
          auditHeadId: auditHeadId || null,
          riskId,
          riskName: body.riskName,
          departmentId: body.departmentId || null,
          sectionProcess: body.sectionProcess || null,
          subProcess: body.subProcess || null,
          activity: body.activity || null,
          categoryId: body.categoryId || null,
          auditTypeId: body.auditTypeId || null,
          riskDescription: body.riskDescription || null,
          inherentLikelihood: body.inherentLikelihood ? parseInt(body.inherentLikelihood) : null,
          inherentImpact: body.inherentImpact ? parseInt(body.inherentImpact) : null,
          inherentScore: inherentScore || null,
          controlDescription: body.controlDescription || null,
          controlEffectiveness: body.controlEffectiveness || null,
          residualLikelihood: body.residualLikelihood ? parseInt(body.residualLikelihood) : null,
          residualImpact: body.residualImpact ? parseInt(body.residualImpact) : null,
          residualScore: residualScore || null,
          riskLevel,
          creationDate: body.creationDate ? new Date(body.creationDate) : new Date(),
          auditComment: body.auditComment || null,
          status: body.status || "Open",
          evidenceFilePath: body.evidenceFilePath || null,
          evidenceFileName: body.evidenceFileName || null,
        },
        include: {
          department: true,
          category: true,
          auditType: true,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'InternalAuditRisk', risk.id, { riskName: risk.riskName, riskDescription: risk.riskDescription });

      return NextResponse.json(risk, { status: 201 });
    } catch (error) {
      console.error("Error creating internal audit risk:", error);
      return NextResponse.json(
        { error: "Failed to create internal audit risk" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "create" }
);
