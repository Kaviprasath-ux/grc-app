"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function getDashboardStats() {
    const session = await auth();
    if (!session || !session.user) {
        throw new Error("Unauthorized");
    }

    try {
        const [departments, stakeholders, regulations, issues, risks, exceptions] = await Promise.all([
            prisma.department.count(),
            prisma.stakeholder.count(),
            prisma.regulation.count(),
            prisma.issue.count(),
            prisma.risk.count(),
            prisma.exception.count(),
        ]);

        return {
            departments,
            stakeholders,
            regulations,
            issues,
            risks,
            exceptions,
        };
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return {
            departments: 0,
            stakeholders: 0,
            regulations: 0,
            issues: 0,
            risks: 0,
            exceptions: 0,
        };
    }
}
