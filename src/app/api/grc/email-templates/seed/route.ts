import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES } from "../../../../../../prisma/seed-email-templates";

/**
 * POST /api/grc/email-templates/seed
 * Seed default email templates into the database (GRCAdministrator only)
 * Upserts templates - creates new ones and updates existing ones
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

    let created = 0;
    let updated = 0;

    for (const template of EMAIL_TEMPLATES) {
      try {
        // Check if template already exists
        const existing = await prisma.emailTemplate.findUnique({
          where: { code: template.code },
        });

        if (existing) {
          // Update existing template
          await prisma.emailTemplate.update({
            where: { code: template.code },
            data: {
              name: template.name,
              description: template.description,
              category: template.category,
              subject: template.subject,
              bodyHtml: template.bodyHtml,
              bodyText: template.bodyText,
              placeholders: template.placeholders,
              isSystem: true,
              module: template.module || "grc",
            },
          });
          updated++;
        } else {
          // Create new template
          await prisma.emailTemplate.create({
            data: {
              ...template,
              isSystem: true,
              isActive: true,
            },
          });
          created++;
        }
      } catch (error) {
        console.error(`Error seeding template ${template.code}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Email templates seeded successfully. Created: ${created}, Updated: ${updated}`,
      created,
      updated,
      total: created + updated,
    });
  } catch (error) {
    console.error("Error seeding email templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
