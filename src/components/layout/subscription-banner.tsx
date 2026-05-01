"use client";

/**
 * In-app subscription banner. Shown on every protected page.
 *
 * Variants:
 *   ACTIVE / COMPLIMENTARY        → no banner
 *   TRIAL with ≤7 days remaining  → blue dismissible banner
 *   EXPIRING_SOON                 → yellow dismissible banner
 *   EXPIRED / GRACE_PERIOD        → red persistent banner
 *   SUSPENDED                     → full-page interstitial blocking module access
 *                                   (only /settings/subscription/* remains accessible)
 *
 * Auto-scoped to the user's customerAccountId. Polls /api/settings/subscription/status
 * every 5 minutes so banner state self-heals after manual super-admin actions.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, AlertTriangle, Clock, X, CreditCard, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
type SubscriptionType = "PAID" | "TRIAL" | "COMPLIMENTARY";

interface StatusPayload {
  status: SubscriptionStatus;
  subscriptionType: SubscriptionType;
  daysToExpiry: number | null;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  nextCycleEnd: string | null;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DISMISSED_KEY_PREFIX = "subscription-banner-dismissed:"; // includes status to expire dismissal on state change

export function SubscriptionBanner() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/subscription/status");
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data);
    } catch {
      // Silent — banner is non-critical
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchStatus]);

  // Reset dismissed state when status changes (so a new severity surfaces again)
  useEffect(() => {
    if (!data) return;
    const key = `${DISMISSED_KEY_PREFIX}${data.status}`;
    const isDismissed = typeof window !== "undefined" && sessionStorage.getItem(key) === "1";
    setDismissed(isDismissed);
  }, [data?.status]);

  function dismiss() {
    if (!data) return;
    sessionStorage.setItem(`${DISMISSED_KEY_PREFIX}${data.status}`, "1");
    setDismissed(true);
  }

  if (!data) return null;
  if (data.status === "ACTIVE" || data.subscriptionType === "COMPLIMENTARY") return null;

  // Settings/subscription routes always allow through (so SUSPENDED users can renew)
  const isOnSubscriptionRoute = pathname?.startsWith("/settings/subscription");

  // ── SUSPENDED → full-page interstitial ──
  if (data.status === "SUSPENDED" && !isOnSubscriptionRoute) {
    return <SuspendedInterstitial t={t} />;
  }

  // ── TRIAL ≤7d ──
  if (data.status === "TRIAL" && data.trialDaysLeft !== null && data.trialDaysLeft <= 7) {
    if (dismissed) return null;
    const days = data.trialDaysLeft;
    return (
      <Banner color="blue" dismissible onDismiss={dismiss} icon={<Sparkles className="h-4 w-4" />}>
        <strong>{days <= 0 ? t("Trial ended") : `${t("Trial ends in")} ${days} ${days === 1 ? t("day") : t("days")}`}</strong>{" "}
        — {t("subscribe before then to keep your modules.")}{" "}
        <Link href="/settings/subscription/renew" className="underline font-medium">
          {t("Subscribe now")}
        </Link>
      </Banner>
    );
  }

  // ── EXPIRING_SOON ──
  if (data.status === "EXPIRING_SOON") {
    if (dismissed) return null;
    const days = data.daysToExpiry ?? 0;
    return (
      <Banner color="yellow" dismissible onDismiss={dismiss} icon={<Clock className="h-4 w-4" />}>
        {t("Your subscription expires in")} <strong>{days} {days === 1 ? t("day") : t("days")}</strong>.{" "}
        <Link href="/settings/subscription/renew" className="underline font-medium">
          {t("Renew now")}
        </Link>
      </Banner>
    );
  }

  // ── EXPIRED / GRACE_PERIOD → persistent red ──
  if (data.status === "EXPIRED" || data.status === "GRACE_PERIOD") {
    const isGrace = data.status === "GRACE_PERIOD";
    const daysSince = data.daysToExpiry !== null ? -data.daysToExpiry : 0;
    return (
      <Banner color="red" icon={<AlertTriangle className="h-4 w-4" />}>
        <strong>
          {isGrace
            ? `${t("Subscription expired")} ${daysSince} ${daysSince === 1 ? t("day ago") : t("days ago")} — ${t("read-only mode.")}`
            : t("Your subscription expired today.")}
        </strong>{" "}
        {isGrace
          ? t("Renew to restore full access. Read-only access ends in")
          : t("Renew to keep full access. Read-only access in")}{" "}
        <strong>{Math.max(0, 7 - daysSince)} {t("days")}</strong>.{" "}
        <Link href="/settings/subscription/renew" className="underline font-medium">
          {t("Renew now")}
        </Link>
      </Banner>
    );
  }

  // ── CANCELLED → soft yellow ──
  if (data.status === "CANCELLED") {
    if (dismissed) return null;
    return (
      <Banner color="yellow" dismissible onDismiss={dismiss} icon={<AlertTriangle className="h-4 w-4" />}>
        {t("Your subscription is cancelled. Access ends on")}{" "}
        <strong>{data.nextCycleEnd ? new Date(data.nextCycleEnd).toLocaleDateString() : "—"}</strong>.{" "}
        <Link href="/settings/subscription" className="underline font-medium">
          {t("Manage subscription")}
        </Link>
      </Banner>
    );
  }

  return null;
}

// ── Banner shell ────────────────────────────────────────────────────────

function Banner({
  color, icon, dismissible = false, onDismiss, children,
}: {
  color: "blue" | "yellow" | "red";
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  const colorClasses = {
    blue:   "bg-blue-50 border-blue-200 text-blue-900",
    yellow: "bg-amber-50 border-amber-200 text-amber-900",
    red:    "bg-red-50 border-red-200 text-red-900",
  }[color];

  return (
    <div className={`border-b ${colorClasses}`}>
      <div className="px-4 lg:px-6 py-2 flex items-center gap-3 text-sm">
        <span className="flex-shrink-0">{icon}</span>
        <div className="flex-1">{children}</div>
        {dismissible && (
          <button onClick={onDismiss} className="flex-shrink-0 p-1 hover:bg-black/5 rounded" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Suspended full-page interstitial ────────────────────────────────────

function SuspendedInterstitial({ t }: { t: (s: string) => string }) {
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl border border-red-200 max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-red-100 rounded-full p-2">
            <Lock className="h-5 w-5 text-red-700" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900">{t("Subscription Suspended")}</h2>
        </div>
        <p className="text-stone-700 mb-4">
          {t("Your subscription has been suspended due to non-payment. Module access is temporarily disabled. Renew to restore full access.")}
        </p>
        <p className="text-sm text-stone-600 mb-4">
          {t("Your data is safe and will be available again once you renew.")}
        </p>
        <div className="flex gap-2">
          <Link
            href="/settings/subscription/renew"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-medium py-2.5 px-4 rounded-md"
          >
            <CreditCard className="h-4 w-4" />
            {t("Renew Now")}
          </Link>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium py-2.5 px-4 rounded-md"
          >
            {t("View Details")}
          </Link>
        </div>
      </div>
    </div>
  );
}
