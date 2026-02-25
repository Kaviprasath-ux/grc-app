import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getDataScopeFilter } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

// Helper function to calculate risk rating based on score
// Rating values matching website: Catastrophic, Very high, High, Low Risk
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// Helper function to generate risk ID (format: RID0001, RID0002, etc. matching website)
// Now scoped to customer account
async function generateRiskId(customerAccountId: string): Promise<string> {
  const lastRisk = await prisma.risk.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: "desc" },
    select: { riskId: true },
  });

  if (!lastRisk) {
    return "RID001";
  }

  // Extract the number from the last risk ID (e.g., "RID0040" -> 40)
  const match = lastRisk.riskId.match(/RID(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `RID${String(nextNum).padStart(3, "0")}`;
  }

  // Fallback: count-based within customer account
  const count = await prisma.risk.count({ where: { customerAccountId } });
  return `RID${String(count + 1).padStart(3, "0")}`;
}

// GET all risks with filters and pagination - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const categoryId = searchParams.get("categoryId");
      const typeId = searchParams.get("typeId");
      const status = searchParams.get("status");
      const riskRating = searchParams.get("riskRating");
      const departmentId = searchParams.get("departmentId");
      const ownerId = searchParams.get("ownerId");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Get tenant filter for multi-tenant isolation
      const tenantFilter = getTenantFilter(session);

      // Get department scope filter for DepartmentContributor/DepartmentReviewer roles
      const scopeFilter = getDataScopeFilter(session, "risk.register", "view");

      const where: Record<string, unknown> = {
        ...tenantFilter,
        ...scopeFilter,
      };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { riskId: { contains: search } },
          { description: { contains: search } },
          { riskRating: { contains: search } },
        ];
      }

      if (categoryId) where.categoryId = categoryId;
      if (typeId) where.typeId = typeId;
      if (status) where.status = status;
      if (riskRating) where.riskRating = riskRating;
      if (departmentId) where.departmentId = departmentId;
      if (ownerId) where.ownerId = ownerId;

      const [risks, total] = await Promise.all([
        prisma.risk.findMany({
          where,
          include: {
            category: true,
            type: true,
            department: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            threats: {
              include: { threat: true },
            },
            vulnerabilities: {
              include: { vulnerability: true },
            },
            causes: {
              include: { cause: true },
            },
            impactedAsset: {
              select: {
                id: true,
                assetId: true,
                name: true,
              },
            },
            impactedProcess: {
              select: {
                id: true,
                processCode: true,
                name: true,
              },
            },
            controlRisks: {
              include: {
                control: {
                  select: {
                    id: true,
                    controlCode: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
            _count: {
              select: {
                assessments: true,
                responses: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.risk.count({ where }),
      ]);

      return NextResponse.json({
        data: risks,
        pagination: {
          total,
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + risks.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching risks:", error);
      return NextResponse.json(
        { error: "Failed to fetch risks" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "view" }
);

// POST create a new risk - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        name,
        description,
        riskSources,
        categoryId,
        typeId,
        departmentId,
        ownerId,
        impactedAssetId,
        impactedProcessId,
        likelihood = 1,
        impact = 1,
        inherentLikelihood,
        inherentImpact,
        residualLikelihood,
        residualImpact,
        targetLikelihood,
        targetImpact,
        status = "Open",
        responseStrategy,
        treatmentPlan,
        treatmentDueDate,
        treatmentStatus,
        threats = [],
        vulnerabilities = [],
        causes = [],
        controls = [],
        actor = "System",
      } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Risk name is required" },
          { status: 400 }
        );
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const riskId = await generateRiskId(customerAccountId);
      const riskScore = likelihood * impact;
      const riskRating = calculateRiskRating(riskScore);

      const risk = await prisma.risk.create({
        data: {
          customerAccountId,
          riskId,
          name,
          description,
          riskSources,
          categoryId,
          typeId,
          departmentId,
          ownerId,
          likelihood,
          impact,
          riskScore,
          riskRating,
          inherentLikelihood,
          inherentImpact,
          inherentRiskScore: inherentLikelihood && inherentImpact ? inherentLikelihood * inherentImpact : null,
          residualLikelihood,
          residualImpact,
          residualRiskScore: residualLikelihood && residualImpact ? residualLikelihood * residualImpact : null,
          targetLikelihood,
          targetImpact,
          targetRiskScore: targetLikelihood && targetImpact ? targetLikelihood * targetImpact : null,
          status,
          responseStrategy,
          treatmentPlan,
          treatmentDueDate: treatmentDueDate ? new Date(treatmentDueDate) : null,
          treatmentStatus,
          threats: {
            create: threats.map((threatId: string) => ({
              threatId,
            })),
          },
          vulnerabilities: {
            create: vulnerabilities.map((vulnerabilityId: string) => ({
              vulnerabilityId,
            })),
          },
          causes: {
            create: causes.map((causeId: string) => ({
              causeId,
            })),
          },
          // Create activity log entry for risk creation
          activityLogs: {
            create: {
              activity: "Created",
              description: `Risk "${name}" was created`,
              actor,
            },
          },
        },
        include: {
          category: true,
          type: true,
          department: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          threats: {
            include: { threat: true },
          },
          vulnerabilities: {
            include: { vulnerability: true },
          },
          causes: {
            include: { cause: true },
          },
        },
      });

      // Send RISK_CREATED notification to owner if assigned and different from creator
      if (ownerId && ownerId !== session.id && session.customerAccountId) {
        // Notify owner about assignment
        await notificationService.notifyRiskAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          ownerId: ownerId,
          riskId: risk.id,
          riskCode: risk.riskId,
          riskName: risk.name,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });

        // Also send RISK_CREATED notification with full details
        await notificationService.send({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          recipientId: ownerId,
          event: NOTIFICATION_EVENTS.RISK_CREATED,
          title: 'New Risk Created',
          message: `A new risk "${risk.riskId}: ${risk.name}" has been created and assigned to you. Risk Rating: ${risk.riskRating}`,
          relatedEntityType: 'risk',
          relatedEntityId: risk.id,
          link: `/risks/register/${risk.id}/edit`,
          metadata: {
            entityName: risk.name,
            riskCode: risk.riskId,
            riskName: risk.name,
            riskRating: risk.riskRating,
            actorName: session.name || 'System',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'Risk', risk.id, { name: risk.name, description: risk.description, riskSources: risk.riskSources });

      return NextResponse.json(risk, { status: 201 });
    } catch (error) {
      console.error("Error creating risk:", error);
      return NextResponse.json(
        { error: "Failed to create risk" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "create" }
);
