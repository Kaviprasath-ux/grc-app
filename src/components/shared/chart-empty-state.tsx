"use client";

/**
 * Visual empty-state for dashboard chart cards. Replaces the flat
 * "No Data to Display" line with a faint silhouette of the chart shape
 * (pie wedges / horizontal bars) so the card still reads as "this is a
 * chart that's currently empty" instead of looking broken.
 *
 * Kept intentionally lightweight — pure SVG/divs, no recharts, no
 * animations beyond a subtle pulse.
 */
import { useLanguage } from "@/contexts/LanguageContext";

type Variant = "pie" | "bar" | "barVertical";

interface Props {
  variant: Variant;
  height?: number;
  /** Override the default "No data yet" label. */
  label?: string;
}

export function ChartEmptyState({ variant, height = 300, label }: Props) {
  const { t } = useLanguage();
  const text = label ?? t("No data yet");

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-muted-foreground"
      style={{ height }}
    >
      <div className="opacity-60 animate-pulse">
        {variant === "pie" && <PieSkeleton />}
        {variant === "bar" && <BarSkeleton />}
        {variant === "barVertical" && <BarVerticalSkeleton />}
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function PieSkeleton() {
  // Three faint wedges + a small inner ring so the silhouette reads as
  // a pie/donut chart at a glance.
  return (
    <svg width="220" height="220" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M60 60 L60 12 A48 48 0 0 1 102 84 Z" fill="currentColor" opacity="0.12" />
      <path d="M60 60 L102 84 A48 48 0 0 1 24 78 Z" fill="currentColor" opacity="0.18" />
      <path d="M60 60 L24 78 A48 48 0 0 1 60 12 Z" fill="currentColor" opacity="0.08" />
      <circle cx="60" cy="60" r="14" fill="white" />
    </svg>
  );
}

function BarSkeleton() {
  // Four horizontal bars of decreasing width — matches the Vendors /
  // Domains charts on the assessor dashboard.
  return (
    <svg width="320" height="200" viewBox="0 0 160 100" aria-hidden="true">
      {[
        { y: 8, w: 140 },
        { y: 32, w: 100 },
        { y: 56, w: 70 },
        { y: 80, w: 40 },
      ].map((b, i) => (
        <rect key={i} x="8" y={b.y} width={b.w} height="14" rx="3" fill="currentColor" opacity={0.18 - i * 0.03} />
      ))}
    </svg>
  );
}

function BarVerticalSkeleton() {
  return (
    <svg width="280" height="180" viewBox="0 0 160 100" aria-hidden="true">
      {[
        { x: 8, h: 70 },
        { x: 44, h: 50 },
        { x: 80, h: 80 },
        { x: 116, h: 40 },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={100 - b.h} width="24" height={b.h} rx="3" fill="currentColor" opacity={0.18 - i * 0.02} />
      ))}
    </svg>
  );
}
