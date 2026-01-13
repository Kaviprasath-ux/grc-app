import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST - AI risk suggestion (placeholder implementation)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const departmentId = formData.get("departmentId") as string;
    const auditFocus = formData.get("auditFocus") as string;

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 }
      );
    }

    // Get department info
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Placeholder: In production, this would call an AI service
    // For now, return sample suggested risks based on department
    const sampleRisks: Record<string, string[]> = {
      "Human Resources": [
        "Risk of non-compliance with employment regulations",
        "Risk of inadequate employee training programs",
        "Risk of data privacy breaches in HR systems",
        "Risk of ineffective onboarding processes",
      ],
      "IT Operations": [
        "Risk of system downtime affecting business operations",
        "Risk of cybersecurity vulnerabilities",
        "Risk of inadequate disaster recovery planning",
        "Risk of unauthorized access to systems",
      ],
      Compliance: [
        "Risk of regulatory non-compliance",
        "Risk of inadequate policy documentation",
        "Risk of failed compliance audits",
        "Risk of outdated compliance procedures",
      ],
      Procurement: [
        "Risk of vendor fraud",
        "Risk of supply chain disruptions",
        "Risk of contract non-compliance",
        "Risk of inadequate vendor due diligence",
      ],
      default: [
        "Risk of process inefficiency",
        "Risk of inadequate documentation",
        "Risk of resource constraints",
        "Risk of communication gaps",
      ],
    };

    const risks = sampleRisks[department.name] || sampleRisks["default"];

    // If audit focus is provided, add a focused risk
    if (auditFocus) {
      risks.unshift(`Risk related to ${auditFocus} in ${department.name}`);
    }

    return NextResponse.json({ risks });
  } catch (error) {
    console.error("Error suggesting risks:", error);
    return NextResponse.json(
      { error: "Failed to suggest risks" },
      { status: 500 }
    );
  }
}
