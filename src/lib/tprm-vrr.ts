// VRR = Vendor Risk Rating. Stored on `TPRMVendor.vrr` as a categorical label
// ("Nominal" | "Low" | "Moderate" | "High" | "Critical"). Older records and a
// now-fixed onboarding path (monitoring detail page) persisted the raw numeric
// score instead — this helper normalises any stored value back to the label so
// the inventory badges render consistently.

export const VRR_LEVELS = [
  { name: "Nominal", min: 0, color: "#22c55e" },
  { name: "Low", min: 20, color: "#84cc16" },
  { name: "Moderate", min: 30, color: "#eab308" },
  { name: "High", min: 40, color: "#f97316" },
  { name: "Critical", min: 50, color: "#ef4444" },
] as const;

export type VrrLabel = (typeof VRR_LEVELS)[number]["name"];

const LABEL_SET = new Set(VRR_LEVELS.map((l) => l.name.toLowerCase()));

export function normalizeVrrLabel(vrr: string | null | undefined): string | null {
  if (!vrr) return null;
  const trimmed = String(vrr).trim();
  if (!trimmed) return null;
  // Already a known label — preserve the canonical casing.
  if (LABEL_SET.has(trimmed.toLowerCase())) {
    return VRR_LEVELS.find((l) => l.name.toLowerCase() === trimmed.toLowerCase())!.name;
  }
  // Numeric score → map to the label whose `min` the score reaches.
  const num = Number(trimmed);
  if (Number.isFinite(num)) {
    const level = [...VRR_LEVELS].reverse().find((l) => num >= l.min);
    return (level ?? VRR_LEVELS[0]).name;
  }
  return trimmed;
}
