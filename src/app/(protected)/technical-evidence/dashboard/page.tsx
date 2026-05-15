"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { EvidenceCollectionCard } from "@/components/technical-evidence/evidence-collection-card";
import {
  Home,
  ChevronRight,
  Settings,
  Database,
  ShieldCheck,
  Cloud,
  Network,
  Globe,
  Briefcase,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORM_CATEGORIES } from "@/lib/integrations/base-connector";

interface Collection {
  id: string;
  displayName: string;
  description: string | null;
  platform: string;
  dataSource: string;
  lastCollectedAt: string | null;
  lastCollectionStatus: string;
  recordCount: number;
  lastError: string | null;
  collectedBy: { fullName: string } | null;
  credential: { id: string; name: string; platform: string; isActive: boolean };
  _count: { records: number; controlMappings: number };
}

const CATEGORY_ICONS: Record<string, typeof ShieldCheck> = {
  azure_entra: ShieldCheck,
  network: Network,
  tenable: Bug,
  acunetix: Globe,
  servicenow: Briefcase,
  google_cloud: Cloud,
};

export default function TechnicalEvidencePage() {
  const { t } = useLanguage();
  const { canView, canCreate, isLoading: permLoading } = usePermissions("compliance.technical-evidence");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(PLATFORM_CATEGORIES[0]?.key || "azure_entra");

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/technical-evidence");
      const json = await res.json();
      if (res.ok) {
        setCollections(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching collections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  if (permLoading || loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Technical Evidence")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Technical Evidence")}</h1>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Technical Evidence.")} />;
  }

  // Group collections by platform category
  const activeCategory = PLATFORM_CATEGORIES.find((c) => c.key === activeTab);
  const activePlatforms = activeCategory?.platforms || [];
  const filteredCollections = collections.filter((c) =>
    activePlatforms.includes(c.platform as never)
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span className="text-primary-700 font-medium">{t("Technical Evidence")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {t("Technical Evidence")}
          </h1>
        </div>
        {canCreate && (
          <Link href="/technical-evidence/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Configure Credentials")}
            </Button>
          </Link>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-500">
        {t("Connect to live systems to pull real-time evidence. This data can be used to support automated checks and provide up-to-the-minute status for audits. Ensure your integrations are configured on the Settings page.")}
      </p>

      {/* Platform Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {PLATFORM_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.key] || Database;
            const isActive = activeTab === category.key;
            const count = collections.filter((c) =>
              category.platforms.includes(c.platform as never)
            ).length;

            return (
              <button
                key={category.key}
                onClick={() => setActiveTab(category.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(category.label)}
                {count > 0 && (
                  <span className="ml-1 text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collection Cards Grid */}
      {filteredCollections.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Database className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium">{t("No data sources configured")}</p>
          <p className="text-xs mt-1">
            {t("Configure credentials in Settings to enable data collection for this platform.")}
          </p>
          {canCreate && (
            <Link href="/technical-evidence/settings">
              <Button variant="outline" size="sm" className="mt-4">
                <Settings className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                {t("Configure Credentials")}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredCollections.map((collection) => (
            <EvidenceCollectionCard
              key={collection.id}
              collection={collection}
              onCollected={fetchCollections}
            />
          ))}
        </div>
      )}
    </div>
  );
}
