import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/grc/email-templates/[id]
 * Get a specific email template (GRCAdministrator only)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...template,
      placeholders: template.placeholders
        ? JSON.parse(template.placeholders)
        : [],
    });
  } catch (error) {
    console.error("Error fetching email template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/grc/email-templates/[id]
 * Update an email template (GRCAdministrator only)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Check if template exists
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      subject,
      bodyHtml,
      bodyText,
      placeholders,
      category,
      isActive,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;
    if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;
    if (bodyText !== undefined) updateData.bodyText = bodyText;
    if (placeholders !== undefined) {
      updateData.placeholders = JSON.stringify(placeholders);
    }
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...template,
      placeholders: template.placeholders
        ? JSON.parse(template.placeholders)
        : [],
    });
  } catch (error) {
    console.error("Error updating email template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grc/email-templates/[id]
 * Delete an email template (GRCAdministrator only)
 * System templates cannot be deleted
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Check if template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
