import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single internal audit risk - with tenant validation
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const risk = await prisma.internalAuditRisk.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: true,
          category: true,
          auditType: true,
          subCategory: true,
          processLinks: { include: { process: { select: { id: true, name: true, processCode: true } } } },
        },
      });

      if (!risk) {
        return NextResponse.json(
          { error: "Internal audit risk not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(risk);
    } catch (error) {
      console.error("Error fetching internal audit risk:", error);
      return NextResponse.json(
        { error: "Failed to fetch internal audit risk" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "view" }
);

// PUT update internal audit risk - with tenant validation
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();

      // Check if risk exists
      const existingRisk = await prisma.internalAuditRisk.findUnique({
        where: { id },
      });

      if (!existingRisk) {
        return NextResponse.json(
          { error: "Internal audit risk not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied");
      }

      // Fetch scoring config for this tenant
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
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
      let riskLevel = body.riskLevel || existingRisk.riskLevel || "Low";
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
          if (residualScore >= 250) riskLevel = "Extreme";
          else if (residualScore >= 100) riskLevel = "High";
          else if (residualScore >= 50) riskLevel = "Medium";
          else riskLevel = "Low";
        }
      }

      const risk = await prisma.internalAuditRisk.update({
        where: { id },
        data: {
          riskName: body.riskName ?? existingRisk.riskName,
          departmentId: body.departmentId !== undefined ? body.departmentId : existingRisk.departmentId,
          sectionProcess: body.sectionProcess !== undefined ? body.sectionProcess : existingRisk.sectionProcess,
          subProcess: body.subProcess !== undefined ? body.subProcess : existingRisk.subProcess,
          activity: body.activity !== undefined ? body.activity : existingRisk.activity,
          categoryId: body.categoryId !== undefined ? body.categoryId : existingRisk.categoryId,
          subCategoryId: body.subCategoryId !== undefined ? body.subCategoryId : existingRisk.subCategoryId,
          auditTypeId: body.auditTypeId !== undefined ? body.auditTypeId : existingRisk.auditTypeId,
          riskDrivers: body.riskDrivers !== undefined ? body.riskDrivers : existingRisk.riskDrivers,
          riskConsequences: body.riskConsequences !== undefined ? body.riskConsequences : existingRisk.riskConsequences,
          relatedLawRegulation: body.relatedLawRegulation !== undefined ? body.relatedLawRegulation : existingRisk.relatedLawRegulation,
          controlsData: body.controlsData !== undefined ? body.controlsData : existingRisk.controlsData,
          riskDescription: body.riskDescription !== undefined ? body.riskDescription : existingRisk.riskDescription,
          inherentLikelihood: body.inherentLikelihood !== undefined ? parseInt(body.inherentLikelihood) : existingRisk.inherentLikelihood,
          inherentImpact: body.inherentImpact !== undefined ? parseInt(body.inherentImpact) : existingRisk.inherentImpact,
          inherentScore: inherentScore ?? existingRisk.inherentScore,
          controlDescription: body.controlDescription !== undefined ? body.controlDescription : existingRisk.controlDescription,
          controlEffectiveness: body.controlEffectiveness !== undefined ? body.controlEffectiveness : existingRisk.controlEffectiveness,
          residualLikelihood: body.residualLikelihood !== undefined ? parseInt(body.residualLikelihood) : existingRisk.residualLikelihood,
          residualImpact: body.residualImpact !== undefined ? parseInt(body.residualImpact) : existingRisk.residualImpact,
          residualScore: residualScore ?? existingRisk.residualScore,
          riskLevel,
          creationDate: body.creationDate ? new Date(body.creationDate) : existingRisk.creationDate,
          auditComment: body.auditComment !== undefined ? body.auditComment : existingRisk.auditComment,
          status: body.status ?? existingRisk.status,
          evidenceFilePath: body.evidenceFilePath !== undefined ? body.evidenceFilePath : existingRisk.evidenceFilePath,
          evidenceFileName: body.evidenceFileName !== undefined ? body.evidenceFileName : existingRisk.evidenceFileName,
        },
        include: {
          department: true,
          category: true,
          auditType: true,
          subCategory: true,
          processLinks: { include: { process: { select: { id: true, name: true, processCode: true } } } },
        },
      });

      // Handle process links update
      if (body.processIds !== undefined && Array.isArray(body.processIds)) {
        // Delete existing process links for this risk
        await prisma.internalAuditProcessRisk.deleteMany({
          where: { riskId: id },
        });
        // Create new process links
        if (body.processIds.length > 0) {
          await prisma.internalAuditProcessRisk.createMany({
            data: body.processIds.map((processId: string) => ({
              riskId: id,
              processId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (existingRisk.customerAccountId) void translateRecord(existingRisk.customerAccountId, 'InternalAuditRisk', risk.id, { riskName: risk.riskName, riskDescription: risk.riskDescription });

      return NextResponse.json(risk);
    } catch (error) {
      console.error("Error updating internal audit risk:", error);
      return NextResponse.json(
        { error: "Failed to update internal audit risk" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "edit" }
);

// DELETE internal audit risk - with tenant validation
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      // Check if risk exists
      const existingRisk = await prisma.internalAuditRisk.findUnique({
        where: { id },
      });

      if (!existingRisk) {
        return NextResponse.json(
          { error: "Internal audit risk not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.internalAuditRisk.delete({
        where: { id },
      });

      if (existingRisk.customerAccountId) void deleteRecordTranslations(existingRisk.customerAccountId, 'InternalAuditRisk', id);

      return NextResponse.json({ message: "Internal audit risk deleted successfully" });
    } catch (error) {
      console.error("Error deleting internal audit risk:", error);
      return NextResponse.json(
        { error: "Failed to delete internal audit risk" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "delete" }
);
