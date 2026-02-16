"use client";

import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users,
  Shield,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Settings,
  Layers,
  BarChart3,
  Target,
  FolderTree,
  LucideIcon,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface SettingCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export default function RiskSettingsPage() {
  const router = useRouter();
  const { canView, isLoading: permissionsLoading } = usePermissions('risk.settings');
  const { t } = useLanguage();

  const settingCards: SettingCard[] = [
    {
      id: "category",
      title: t("Category"),
      description: t("Manage vulnerability and threat categories"),
      icon: Users,
      href: "/risks/settings/category",
    },
    {
      id: "control-strength",
      title: t("Control Strength"),
      description: t("Configure control strength levels and scores"),
      icon: Shield,
      href: "/risks/settings/control-strength",
    },
    {
      id: "likelihood",
      title: t("Likelihood"),
      description: t("Define risk likelihood ratings and scores"),
      icon: TrendingUp,
      href: "/risks/settings/likelihood",
    },
    {
      id: "threat",
      title: t("Threat"),
      description: t("Manage threat definitions and categories"),
      icon: AlertTriangle,
      href: "/risks/settings/threat",
    },
    {
      id: "vulnerability",
      title: t("Vulnerability"),
      description: t("Manage vulnerability definitions"),
      icon: ShieldAlert,
      href: "/risks/settings/vulnerability",
    },
    {
      id: "risk-methodology",
      title: t("Risk Methodology"),
      description: t("Configure risk scoring and ranges"),
      icon: Settings,
      href: "/risks/settings/risk-methodology",
    },
    {
      id: "risk-category",
      title: t("Risk Category"),
      description: t("Define risk categories and types"),
      icon: Layers,
      href: "/risks/settings/risk-category",
    },
    {
      id: "impact",
      title: t("Impact"),
      description: t("Configure impact categories and ratings"),
      icon: BarChart3,
      href: "/risks/settings/impact",
    },
    {
      id: "vulnerability-rating",
      title: t("Vulnerability Rating"),
      description: t("Define vulnerability rating levels"),
      icon: Target,
      href: "/risks/settings/vulnerability-rating",
    },
    {
      id: "risk-sub-category",
      title: t("Risk Sub Category"),
      description: t("Manage risk sub-categories"),
      icon: FolderTree,
      href: "/risks/settings/risk-sub-category",
    },
  ];

  if (permissionsLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Settings")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Settings")}</h1>
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
    return <Unauthorized description={t("You don't have permission to access Risk Settings.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Settings")}</h1>
      </div>

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {settingCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left cursor-pointer"
              onClick={() => router.push(card.href)}
            >
              <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{card.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {card.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
