/**
 * Canonical vocabulary for a vendor's security score.
 *
 * The band NAMES here mirror the ones exposed to admins in Control
 * Center (`SC_CATEGORIES = ["Excellent","Good","Moderate","Low","Nominal"]`).
 * Before this helper existed each caller had its own copy —
 * bo-inventory / rm-inventory / vendor-management used "Good /
 * Moderate / Poor", monitoring detail used "Excellent / Good /
 * Average / ..." — so words like "Poor" and "Average" showed up in
 * the UI that a user could never see or configure in Control Center,
 * and words like "Low" / "Nominal" that the admin CAN configure never
 * appeared anywhere.
 *
 * FUTURE: thresholds should come from the TPRMScorecardFactor rows
 * an admin sets in Control Center. For now they're static defaults —
 * fixing the vocabulary mismatch is the near-term ask; wiring
 * thresholds to the DB is the follow-up.
 */

export type SecurityBandLabel = "Excellent" | "Good" | "Moderate" | "Low" | "Nominal";

export interface SecurityBand {
  label: SecurityBandLabel;
  /** Tailwind text-color class for standalone labels (e.g. next to VRR). */
  textClass: string;
  /** Tailwind bg+text combo for chip-style displays. */
  chipClass: string;
  /** Hex fill for SVG/inline-style renderers. */
  hex: string;
}

const BANDS: Array<{ min: number; band: SecurityBand }> = [
  { min: 80, band: { label: "Excellent", textClass: "text-emerald-600", chipClass: "bg-emerald-100 text-emerald-700", hex: "#059669" } },
  { min: 60, band: { label: "Good",      textClass: "text-green-600",   chipClass: "bg-green-100 text-green-700",     hex: "#16a34a" } },
  { min: 40, band: { label: "Moderate",  textClass: "text-yellow-600",  chipClass: "bg-yellow-100 text-yellow-700",   hex: "#ca8a04" } },
  { min: 20, band: { label: "Low",       textClass: "text-orange-600",  chipClass: "bg-orange-100 text-orange-700",   hex: "#ea580c" } },
  { min: 0,  band: { label: "Nominal",   textClass: "text-red-600",     chipClass: "bg-red-100 text-red-700",         hex: "#dc2626" } },
];

/**
 * Resolve a security score (0–100) to a canonical band.
 * Returns `null` when the score itself is null/undefined.
 */
export function securityScoreBand(score: number | null | undefined): SecurityBand | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const s = Math.max(0, Math.min(100, score));
  for (const { min, band } of BANDS) {
    if (s >= min) return band;
  }
  return BANDS[BANDS.length - 1].band;
}
