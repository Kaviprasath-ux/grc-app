import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

const VRR_LEVELS = ["Nominal", "Low", "Moderate", "High", "Critical"] as const;
type VrrLevel = typeof VRR_LEVELS[number];

// Default numeric ranges (mirrors rm/bo-inventory vrrLevels defaults)
const VRR_RANGES: Record<VrrLevel, { min: number; max: number }> = {
  Nominal:  { min: 0,  max: 19  },
  Low:      { min: 20, max: 29  },
  Moderate: { min: 30, max: 39  },
  High:     { min: 40, max: 49  },
  Critical: { min: 50, max: 100 },
};

/** Resolve a stored vrr value (label string or numeric string) to a VrrLevel */
function resolveVrrLevel(vrr: string | null): VrrLevel | null {
  if (!vrr) return null;
  // Label match (new format)
  if (VRR_LEVELS.includes(vrr as VrrLevel)) return vrr as VrrLevel;
  // Numeric match (legacy format)
  const score = parseFloat(vrr);
  if (!isNaN(score)) {
    const clamped = Math.min(100, Math.max(0, score));
    // Find level from highest to lowest
    for (const level of [...VRR_LEVELS].reverse()) {
      if (clamped >= VRR_RANGES[level].min) return level;
    }
    return "Nominal";
  }
  return null;
}

/**
 * Mirrors the Mendix microflow pattern:
 *
 * DS_RET_Vendor_RM (dataview):
 *   → Retrieve all VendorDetails → check if list non-empty → set IsEnable
 *
 * DS_VendorNominal_RM / DS_VendorLow_RM / ... (per-series):
 *   → Retrieve TPRMAccount (tenant scope)
 *   → Retrieve VendorDetails filtered by Account + VRR = level
 *   → Count → return { Label, LabelCount }
 *
 * Handles both label VRR ("Nominal") and legacy numeric VRR ("25").
 */
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Fetch all vendors' vrr values for this tenant
      const vendors = await prisma.tPRMVendor.findMany({
        where: tenantFilter,
        select: { vrr: true },
      });

      const isEnabled = vendors.length > 0;

      // Count per VRR level (handles both label and numeric vrr)
      const levelCounts: Record<VrrLevel, number> = {
        Nominal: 0, Low: 0, Moderate: 0, High: 0, Critical: 0,
      };
      for (const vendor of vendors) {
        const level = resolveVrrLevel(vendor.vrr);
        if (level) levelCounts[level]++;
      }

      const counts = VRR_LEVELS.map((level) => ({
        label: level,
        labelCount: levelCounts[level],
      }));

      return NextResponse.json({ isEnabled, data: counts });
    } catch (error) {
      console.error("Error fetching vendor criticality counts:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor criticality counts" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.vendor-management", "tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory", "tprm.asr-inventory", "tprm.reports"], action: "view" }
);
