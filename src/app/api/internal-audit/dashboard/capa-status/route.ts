import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET CAPA status overview by department
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Multi-tenant: Build filter based on customerAccountId
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter (GRCAdmin sees all, others see only their tenant)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

    // Get all CAPAs with their findings and departments (with tenant filter)
    const capas = await prisma.internalAuditCAPA.findMany({
      where: tenantFilter,
      include: {
        finding: {
          include: {
            engagement: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    // Group by department
    const departmentMap = new Map<
      string,
      {
        department: string;
        open: { severity: string; count: number }[];
        closed: { severity: string; count: number }[];
      }
    >();

    capas.forEach((capa) => {
      const deptName = capa.finding?.engagement?.department?.name || "Unknown";
      const severity = capa.finding?.severity || "Medium";
      const isOpen = capa.status !== "Closed" && capa.status !== "Completed";

      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, {
          department: deptName,
          open: [],
          closed: [],
        });
      }

      const dept = departmentMap.get(deptName)!;
      const targetArray = isOpen ? dept.open : dept.closed;

      const existingSeverity = targetArray.find((s) => s.severity === severity);
      if (existingSeverity) {
        existingSeverity.count++;
      } else {
        targetArray.push({ severity, count: 1 });
      }
    });

    const result = Array.from(departmentMap.values());

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching CAPA status:", error);
    return NextResponse.json(
      { error: "Failed to fetch CAPA status" },
      { status: 500 }
    );
  }
}
