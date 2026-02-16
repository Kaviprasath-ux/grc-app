import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/governance-templates/[id]/download
 * Download a governance template file from the database
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const template = await prisma.governanceTemplate.findUnique({
      where: { id },
      select: {
        fileData: true,
        fileName: true,
        fileType: true,
        customerAccountId: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check access - must belong to same customer account or be global
    if (
      template.customerAccountId &&
      template.customerAccountId !== session.user.customerAccountId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!template.fileData) {
      return NextResponse.json(
        { error: "File data not available" },
        { status: 404 }
      );
    }

    // Determine content type
    const contentType =
      template.fileType === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream";

    return new NextResponse(new Uint8Array(template.fileData), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${template.fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading governance template:", error);
    return NextResponse.json(
      { error: "Failed to download template" },
      { status: 500 }
    );
  }
}
