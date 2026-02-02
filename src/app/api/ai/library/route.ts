import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";

async function handler(req: NextRequest) {
    try {
        const [controls, threats, vulnerabilities, risks] = await Promise.all([
            prisma.control.findMany({ select: { name: true, controlCode: true } }),
            prisma.riskThreat.findMany({ select: { name: true, threatId: true } }),
            prisma.riskVulnerability.findMany({ select: { name: true, vulnId: true } }),
            prisma.risk.findMany({ select: { name: true, riskId: true } }),
        ]);

        const library = {
            Control_Library: controls.map(c => ({
                Control_Name: c.name,
                Control_Code: c.controlCode,
            })),
            Threats_library: threats.map(t => ({
                Threats_name: t.name,
                Threats_code: t.threatId || "",
            })),
            Vulnerabilities_library: vulnerabilities.map(v => ({
                Vulnerabilities_name: v.name,
                Vulnerabilities_code: v.vulnId || "",
            })),
            Risk_Library: risks.map(r => ({
                Risk_name: r.name,
                Risk_code: r.riskId || "",
            })),
        };

        return NextResponse.json(library);
    } catch (error: any) {
        console.error("Error fetching library data:", error);
        return NextResponse.json(
            { error: "Failed to fetch library data" },
            { status: 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
