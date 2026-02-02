import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, withAuthOnly } from "@/lib/api-auth";

// Default settings
const defaultSettings = {
  likelihood_scale: [
    { key: "1", label: "Rare", description: "May occur only in exceptional circumstances", value: "1" },
    { key: "2", label: "Unlikely", description: "Could occur at some time", value: "2" },
    { key: "3", label: "Possible", description: "Might occur at some time", value: "3" },
    { key: "4", label: "Likely", description: "Will probably occur in most circumstances", value: "4" },
    { key: "5", label: "Almost Certain", description: "Is expected to occur in most circumstances", value: "5" },
  ],
  impact_scale: [
    { key: "1", label: "Insignificant", description: "No injuries, low financial loss", value: "1" },
    { key: "2", label: "Minor", description: "First aid treatment, medium financial loss", value: "2" },
    { key: "3", label: "Moderate", description: "Medical treatment required, high financial loss", value: "3" },
    { key: "4", label: "Major", description: "Extensive injuries, major financial loss", value: "4" },
    { key: "5", label: "Catastrophic", description: "Death, huge financial loss", value: "5" },
  ],
  rating_matrix: {
    // Rating values matching website: Catastrophic, Very high, High, Low Risk
    thresholds: [
      { min: 1, max: 9, rating: "Low Risk", color: "#22c55e" },
      { min: 10, max: 14, rating: "High", color: "#f59e0b" },
      { min: 15, max: 19, rating: "Very high", color: "#ea580c" },
      { min: 20, max: 25, rating: "Catastrophic", color: "#dc2626" },
    ],
  },
  appetite: {
    acceptable: 4,
    tolerable: 9,
    unacceptable: 15,
  },
  frequency: {
    assessment: "Quarterly",
    review: "Monthly",
    reporting: "Monthly",
  },
};

// GET all risk settings
// Note: RiskSetting model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuthOnly(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const category = searchParams.get("category");

      const where: Record<string, unknown> = {};
      if (category) where.category = category;

      const settings = await prisma.riskSetting.findMany({
        where,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      });

      // If no settings exist, return defaults
      if (settings.length === 0) {
        return NextResponse.json({
          settings: [],
          defaults: defaultSettings,
        });
      }

      // Group settings by category
      const grouped: Record<string, unknown[]> = {};
      settings.forEach((setting) => {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }
        grouped[setting.category].push({
          id: setting.id,
          key: setting.key,
          value: JSON.parse(setting.value),
          label: setting.label,
          description: setting.description,
          sortOrder: setting.sortOrder,
        });
      });

      return NextResponse.json({
        settings: grouped,
        defaults: defaultSettings,
      });
    } catch (error) {
      console.error("Error fetching risk settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk settings" },
        { status: 500 }
      );
    }
  }
);

// POST create or update risk settings - admin only (CustomerAdministrator or GRCAdministrator)
// Note: RiskSetting model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req) => {
    try {
      const body = await req.json();
      const { category, settings } = body;

      if (!category || !settings) {
        return NextResponse.json(
          { error: "Category and settings are required" },
          { status: 400 }
        );
      }

      // Upsert each setting
      const results = await Promise.all(
        settings.map(
          async (
            setting: {
              key: string;
              value: unknown;
              label?: string;
              description?: string;
              sortOrder?: number;
            },
            index: number
          ) => {
            // First check if a setting exists
            const existingSetting = await prisma.riskSetting.findFirst({
              where: {
                category,
                key: setting.key,
              },
            });

            if (existingSetting) {
              return prisma.riskSetting.update({
                where: { id: existingSetting.id },
                data: {
                  value: JSON.stringify(setting.value),
                  label: setting.label,
                  description: setting.description,
                  sortOrder: setting.sortOrder ?? index,
                },
              });
            } else {
              return prisma.riskSetting.create({
                data: {
                  category,
                  key: setting.key,
                  value: JSON.stringify(setting.value),
                  label: setting.label,
                  description: setting.description,
                  sortOrder: setting.sortOrder ?? index,
                },
              });
            }
          }
        )
      );

      return NextResponse.json({
        message: "Settings saved successfully",
        count: results.length,
      });
    } catch (error) {
      console.error("Error saving risk settings:", error);
      return NextResponse.json(
        { error: "Failed to save risk settings" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// PUT update specific setting - admin only
// Note: RiskSetting model doesn't have customerAccountId field yet - tenant validation disabled
export const PUT = withAuth(
  async (req) => {
    try {
      const body = await req.json();
      const { id, value, label, description } = body;

      if (!id) {
        return NextResponse.json(
          { error: "Setting ID is required" },
          { status: 400 }
        );
      }

      // Verify setting exists
      const existingSetting = await prisma.riskSetting.findUnique({
        where: { id },
      });

      if (!existingSetting) {
        return NextResponse.json(
          { error: "Setting not found" },
          { status: 404 }
        );
      }

      const setting = await prisma.riskSetting.update({
        where: { id },
        data: {
          value: JSON.stringify(value),
          label,
          description,
        },
      });

      return NextResponse.json(setting);
    } catch (error) {
      console.error("Error updating risk setting:", error);
      return NextResponse.json(
        { error: "Failed to update risk setting" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE a setting - admin only
// Note: RiskSetting model doesn't have customerAccountId field yet - tenant validation disabled
export const DELETE = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "Setting ID is required" },
          { status: 400 }
        );
      }

      // Verify setting exists
      const existingSetting = await prisma.riskSetting.findUnique({
        where: { id },
      });

      if (!existingSetting) {
        return NextResponse.json(
          { error: "Setting not found" },
          { status: 404 }
        );
      }

      await prisma.riskSetting.delete({ where: { id } });

      return NextResponse.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting risk setting:", error);
      return NextResponse.json(
        { error: "Failed to delete risk setting" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
