import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadRiskFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all internal audit risks with filters - filtered by customer account and audit head
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const year = searchParams.get("year");
      const departmentId = searchParams.get("departmentId");
      const search = searchParams.get("search");

      const tenantFilter = getTenantFilter(session);
      const auditHeadRiskFilter = getAuditHeadRiskFilter(session);
      const where: any = { ...tenantFilter, ...auditHeadRiskFilter };

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
      const auditHeadId = getAuditHeadId(session);
      const tenantFilter = getTenantFilter(session);

      // Generate risk ID - scoped to tenant
      const lastRisk = await prisma.internalAuditRisk.findFirst({
        where: tenantFilter,
        orderBy: { riskId: "desc" },
      });

      let nextNumber = 1;
      if (lastRisk && lastRisk.riskId) {
        const match = lastRisk.riskId.match(/RID(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      const riskId = `RID${String(nextNumber).padStart(3, "0")}`;

      // Calculate scores if not provided
      let inherentScore = body.inherentScore;
      if (body.inherentLikelihood && body.inherentImpact && !inherentScore) {
        inherentScore = body.inherentLikelihood * body.inherentImpact;
      }

      let residualScore = body.residualScore;
      if (body.residualLikelihood && body.residualImpact && !residualScore) {
        residualScore = body.residualLikelihood * body.residualImpact;
      }

      // Determine risk level based on residual score
      let riskLevel = "Low";
      if (residualScore) {
        if (residualScore >= 250) riskLevel = "Extreme";
        else if (residualScore >= 100) riskLevel = "High";
        else if (residualScore >= 50) riskLevel = "Medium";
        else riskLevel = "Low";
      }

      const risk = await prisma.internalAuditRisk.create({
        data: {
          customerAccountId,
          auditHeadId,
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
