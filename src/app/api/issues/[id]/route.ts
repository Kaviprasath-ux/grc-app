import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update issue
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      domain,
      category,
      issueType,
      status,
      dueDate,
      departmentId,
      ownerId,
      selectedRegulations,
      selectedProcesses,
      stakeholderNeeds,
    } = body;

    // Debug logging
    console.log("API received update data:", {
      departmentId,
      ownerId,
      selectedRegulations,
      selectedProcesses,
      stakeholderNeeds,
    });

    // Use a transaction to update the issue and its associations
    const issue = await prisma.$transaction(async (tx) => {
      // Delete existing associations if new ones are provided
      if (selectedRegulations !== undefined) {
        await tx.issueRegulation.deleteMany({ where: { issueId: id } });
      }
      if (selectedProcesses !== undefined) {
        await tx.issueProcess.deleteMany({ where: { issueId: id } });
      }
      if (stakeholderNeeds !== undefined) {
        await tx.issueStakeholder.deleteMany({ where: { issueId: id } });
      }

      // Update the issue with new associations
      return tx.issue.update({
        where: { id },
        data: {
          title,
          description,
          domain,
          category,
          issueType,
          status,
          dueDate: dueDate ? new Date(dueDate) : null,
          // Use connect/disconnect syntax for relations
          department: departmentId
            ? { connect: { id: departmentId } }
            : { disconnect: true },
          owner: ownerId
            ? { connect: { id: ownerId } }
            : { disconnect: true },
          // Create new regulation associations
          regulations:
            selectedRegulations?.length
              ? {
                  create: selectedRegulations.map((regulationId: string) => ({
                    regulation: { connect: { id: regulationId } },
                  })),
                }
              : undefined,
          // Create new process associations
          processes:
            selectedProcesses?.length
              ? {
                  create: selectedProcesses.map((processId: string) => ({
                    process: { connect: { id: processId } },
                  })),
                }
              : undefined,
          // Create new stakeholder associations
          stakeholders:
            stakeholderNeeds?.length
              ? {
                  create: stakeholderNeeds.map(
                    (item: { stakeholderId: string; needExpectation: string }) => ({
                      stakeholder: { connect: { id: item.stakeholderId } },
                      needExpectation: item.needExpectation,
                    })
                  ),
                }
              : undefined,
        },
        include: {
          department: true,
          owner: {
            select: { id: true, fullName: true },
          },
          regulations: {
            include: { regulation: true },
          },
          processes: {
            include: {
              process: {
                select: { id: true, processCode: true, name: true },
              },
            },
          },
          stakeholders: {
            include: {
              stakeholder: {
                select: { id: true, name: true, type: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(issue);
  } catch (error: unknown) {
    console.error("Error updating issue:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }
}

// DELETE issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.issue.delete({ where: { id } });
    return NextResponse.json({ message: "Issue deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting issue:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 });
  }
}
