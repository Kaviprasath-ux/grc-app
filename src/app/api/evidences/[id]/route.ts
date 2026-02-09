import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { aiDeleteService } from "@/services/ai-delete-service";
import { unlink } from "fs/promises";
import path from "path";
import { withAuth } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

// GET single evidence with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        framework: true,
        control: {
          include: {
            domain: true,
          },
        },
        department: true,
        assignee: true,
        attachments: true,
        kpis: true,
        evidenceControls: {
          include: {
            control: {
              include: {
                domain: true,
                framework: true,
              },
            },
          },
        },
        linkedArtifacts: {
          include: {
            artifact: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(evidence);
  } catch (error) {
    console.error("Error fetching evidence:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 }
    );
  }
}

// PUT update evidence
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await context.params as { id: string };
      const body = await req.json();
      const {
        name,
        description,
        domain,
        frameworkId,
        controlId,
        departmentId,
        assigneeId,
        dueDate,
        status,
        recurrence,
        reviewDate,
        publishedAt,
        kpiRequired,
        kpiObjective,
        kpiDataSource,
        kpiExpectedScore,
        kpiDescription,
        kpiCalculationFormula,
      } = body;

      // Build update data, only including defined fields
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (domain !== undefined) updateData.domain = domain;
      if (frameworkId !== undefined) updateData.frameworkId = frameworkId;
      if (controlId !== undefined) updateData.controlId = controlId;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (status !== undefined) updateData.status = status;
      if (recurrence !== undefined) updateData.recurrence = recurrence;
      if (reviewDate !== undefined) updateData.reviewDate = reviewDate ? new Date(reviewDate) : null;
      if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
      if (kpiRequired !== undefined) updateData.kpiRequired = kpiRequired;
      if (kpiObjective !== undefined) updateData.kpiObjective = kpiObjective;
      if (kpiDataSource !== undefined) updateData.kpiDataSource = kpiDataSource;
      if (kpiExpectedScore !== undefined) updateData.kpiExpectedScore = kpiExpectedScore;
      if (kpiDescription !== undefined) updateData.kpiDescription = kpiDescription;
      if (kpiCalculationFormula !== undefined) updateData.kpiCalculationFormula = kpiCalculationFormula;

      const updatedEvidence = await prisma.evidence.update({
        where: { id },
        data: updateData,
        include: {
          framework: true,
          control: {
            include: {
              domain: true,
            },
          },
          department: true,
          assignee: true,
          attachments: true,
          kpis: true,
          evidenceControls: {
            include: {
              control: {
                include: {
                  domain: true,
                  framework: true,
                },
              },
            },
          },
          linkedArtifacts: {
            include: {
              artifact: true,
            },
          },
        },
      });

      // Notify new assignee if assignee changed and is different from current user
      if (assigneeId && assigneeId !== session?.id && session?.customerAccountId) {
        await notificationService.notifyEvidenceAssigned({
          customerAccountId: session.customerAccountId,
          actorId: session.id,
          assigneeId: assigneeId,
          evidenceId: updatedEvidence.id,
          evidenceName: updatedEvidence.name,
          controlCode: updatedEvidence.control?.controlCode ?? undefined,
        });
      }

      return NextResponse.json(updatedEvidence);
    } catch (error: unknown) {
      console.error("Error updating evidence:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);

// DELETE evidence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch evidence with attachments
    const existing = await prisma.evidence.findUnique({
      where: { id },
      select: { evidenceCode: true, attachments: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    console.log(`[Evidence Delete] Deleting evidence: ${existing.evidenceCode} (${id})`);

    // Step 1: Clean up AI documents from RunPod
    try {
      const aiResults = await aiDeleteService.deleteAllForEvidence(id);
      console.log(
        `[Evidence Delete] AI cleanup: ${aiResults.filter((r) => r.status === "deleted").length}/${aiResults.length} documents deleted`
      );
    } catch (aiError) {
      console.warn("[Evidence Delete] AI cleanup failed (continuing):", aiError);
      // Continue with deletion even if AI cleanup fails
    }

    // Step 2: Delete physical attachment files
    for (const attachment of existing.attachments) {
      if (attachment.filePath) {
        try {
          const relativePath = attachment.filePath.startsWith("/")
            ? attachment.filePath.slice(1)
            : attachment.filePath;
          const absolutePath = path.join(process.cwd(), relativePath);
          await unlink(absolutePath);
          console.log(`[Evidence Delete] Deleted file: ${attachment.fileName}`);
        } catch (fileError) {
          console.warn(
            `[Evidence Delete] Could not delete file: ${attachment.filePath}`
          );
        }
      }
    }

    // Step 3: Delete evidence (cascade handles DB records)
    await prisma.evidence.delete({
      where: { id },
    });

    console.log(`[Evidence Delete] Successfully deleted evidence: ${existing.evidenceCode}`);
    return NextResponse.json({ message: "Evidence deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting evidence:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete evidence" },
      { status: 500 }
    );
  }
}
