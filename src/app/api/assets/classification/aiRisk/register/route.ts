import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

async function getStartingRiskNum(customerAccountId: string): Promise<number> {
    const lastRisk = await prisma.risk.findFirst({
        where: { customerAccountId },
        orderBy: { createdAt: "desc" },
        select: { riskId: true },
    });

    if (!lastRisk) return 1;

    const match = lastRisk.riskId.match(/RID(\d+)/);
    if (match) return parseInt(match[1], 10) + 1;

    const count = await prisma.risk.count({ where: { customerAccountId } });
    return count + 1;
}

function mapRiskRating(inherent?: string): string {
    if (!inherent) return "Medium";
    const v = inherent.toLowerCase();
    if (v === "high") return "High";
    if (v === "medium") return "Medium";
    if (v === "low") return "Low Risk";
    return inherent;
}

/**
 * POST: Register risks from semantic match result into the Risk Register.
 * Body: { semanticResult: { risks?: any[]; results?: { risks?: any[] } } }
 */
export const POST = withAuth(
    async (req: NextRequest, _context, session) => {
        try {
            const body = await req.json();
            const semanticResult = body.semanticResult ?? body;

            const risks =
                semanticResult.risks ??
                semanticResult.results?.risks ??
                (Array.isArray(semanticResult) ? semanticResult : []);

            if (!Array.isArray(risks) || risks.length === 0) {
                return NextResponse.json(
                    { error: "No risks in semantic result to register" },
                    { status: 400 }
                );
            }

            const customerAccountId = getCustomerAccountId(session);
            const created: { id: string; riskId: string; name: string }[] = [];

            // Fetch all existing risk names and the starting ID counter in one pass
            const existingNames = new Set(
                (await prisma.risk.findMany({ where: { customerAccountId }, select: { name: true } }))
                    .map((r) => r.name)
            );
            let nextRiskNum = await getStartingRiskNum(customerAccountId);

            for (const r of risks) {
                const name = r.Risk_name ?? r.name ?? "Unnamed Risk";
                const description = r.Risk_description ?? r.description ?? null;
                const riskRating = mapRiskRating(r.Inherent_risk_rating ?? r.risk_rating);

                if (existingNames.has(name)) continue;

                const riskId = `RID${String(nextRiskNum).padStart(3, "0")}`;
                nextRiskNum++;

                const risk = await prisma.risk.create({
                    data: {
                        customerAccountId,
                        riskId,
                        name,
                        description,
                        riskRating,
                        likelihood: 1,
                        impact: 1,
                        riskScore: 1,
                        status: "Open",
                        assessmentStatus: "Open",
                        responseStatus: "Open",
                        activityLogs: {
                            create: {
                                activity: "Created",
                                description: `Risk "${name}" was created from AI Asset Classification`,
                                actor: "System",
                            },
                        },
                    },
                    select: { id: true, riskId: true, name: true },
                });

                created.push(risk);
            }

            return NextResponse.json({
                success: true,
                created: created.length,
                risks: created,
            });
        } catch (error) {
            console.error("[AI Risk Register] Error:", error);
            return NextResponse.json(
                { error: "Failed to register risks" },
                { status: 500 }
            );
        }
    },
    { resource: "risk.register", action: "create" }
);
