import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/email-templates
 * List all global email templates (GRCAdministrator only)
 */
export async function GET() {
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

    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ isSystem: "desc" }, { category: "asc" }, { name: "asc" }],
    });

    // Parse placeholders JSON
    const formattedTemplates = templates.map((template) => ({
      ...template,
      placeholders: template.placeholders
        ? JSON.parse(template.placeholders)
        : [],
    }));

    return NextResponse.json(formattedTemplates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grc/email-templates
 * Create a new global email template (GRCAdministrator only)
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      code,
      name,
      description,
      subject,
      bodyHtml,
      bodyText,
      placeholders,
      category,
      isActive,
    } = body;

    // Validate required fields
    if (!code || !name || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "Code, name, subject, and body HTML are required" },
        { status: 400 }
      );
    }

    // Check if template with same code already exists
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { code },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: "A template with this code already exists" },
        { status: 409 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        code,
        name,
        description: description || null,
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        placeholders: placeholders
          ? JSON.stringify(placeholders)
          : null,
        category: category || "custom",
        isActive: isActive ?? true,
        isSystem: false, // User-created templates are never system templates
      },
    });

    return NextResponse.json({
      ...template,
      placeholders: template.placeholders
        ? JSON.parse(template.placeholders)
        : [],
    });
  } catch (error) {
    console.error("Error creating email template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
