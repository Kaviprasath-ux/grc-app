import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ImportedTemplate {
  code: string;
  name: string;
  description?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  placeholders?: string[];
  category?: string;
  isActive?: boolean;
}

/**
 * POST /api/grc/email-templates/import
 * Import email templates from JSON (GRCAdministrator only)
 *
 * Mendix-style import functionality:
 * - Accepts JSON array of templates
 * - Skips templates with existing codes (or updates if overwrite=true)
 * - Returns import summary
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
    const { templates, overwrite = false } = body;

    if (!Array.isArray(templates) || templates.length === 0) {
      return NextResponse.json(
        { error: "Invalid import data - expected array of templates" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const template of templates as ImportedTemplate[]) {
      try {
        // Validate required fields
        if (!template.code || !template.name || !template.subject || !template.bodyHtml) {
          results.errors.push(`Template missing required fields: ${template.code || 'unknown'}`);
          results.skipped++;
          continue;
        }

        // Check if template exists
        const existing = await prisma.emailTemplate.findUnique({
          where: { code: template.code },
        });

        if (existing) {
          if (overwrite) {
            // Update existing template (but don't change isSystem flag)
            await prisma.emailTemplate.update({
              where: { code: template.code },
              data: {
                name: template.name,
                description: template.description || null,
                subject: template.subject,
                bodyHtml: template.bodyHtml,
                bodyText: template.bodyText || null,
                placeholders: template.placeholders
                  ? JSON.stringify(template.placeholders)
                  : null,
                category: template.category || "custom",
                isActive: template.isActive ?? true,
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new template
          await prisma.emailTemplate.create({
            data: {
              code: template.code,
              name: template.name,
              description: template.description || null,
              subject: template.subject,
              bodyHtml: template.bodyHtml,
              bodyText: template.bodyText || null,
              placeholders: template.placeholders
                ? JSON.stringify(template.placeholders)
                : null,
              category: template.category || "custom",
              isActive: template.isActive ?? true,
              isSystem: false, // Imported templates are never system templates
            },
          });
          results.imported++;
        }
      } catch (error) {
        console.error(`Error importing template ${template.code}:`, error);
        results.errors.push(`Failed to import: ${template.code}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete: ${results.imported} imported, ${results.updated} updated, ${results.skipped} skipped`,
      results,
    });
  } catch (error) {
    console.error("Error importing email templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
