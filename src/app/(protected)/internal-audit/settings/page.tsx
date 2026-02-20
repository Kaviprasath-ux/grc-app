"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Network,
  Activity,
  Clock,
  AlertTriangle,
  FileType,
  Users,
  Building2,
  GitBranch,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

export default function InternalAuditSettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');

  const settingsCategories = [
    {
      name: t("Audit Category"),
      description: t("Manage audit categories and classifications"),
      icon: ClipboardList,
      href: "/internal-audit/settings/categories",
    },
    {
      name: t("Nature of Controls"),
      description: t("Define control types and characteristics"),
      icon: Network,
      href: "/internal-audit/settings/nature-of-controls",
    },
    {
      name: t("Risk Assessment Configuration"),
      description: t("Configure risk assessment parameters"),
      icon: Activity,
      href: "/internal-audit/settings/risk-assessment",
    },
    {
      name: t("Periodicity"),
      description: t("Set audit frequency and intervals"),
      icon: Clock,
      href: "/internal-audit/settings/periodicity",
    },
    {
      name: t("Escalation Configuration"),
      description: t("Configure escalation timelines"),
      icon: AlertTriangle,
      href: "/internal-audit/settings/escalation",
    },
    {
      name: t("Audit Type"),
      description: t("Define types of audits"),
      icon: FileType,
      href: "/internal-audit/settings/audit-types",
    },
    {
      name: t("User Management"),
      description: t("Manage audit team members and roles"),
      icon: Users,
      href: "/internal-audit/settings/user-management",
    },
    {
      name: t("Department"),
      description: t("Configure departments for audits"),
      icon: Building2,
      href: "/internal-audit/settings/departments",
    },
    {
      name: t("Process"),
      description: t("Manage business processes"),
      icon: GitBranch,
      href: "/internal-audit/settings/process",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Settings")}</h1>
      </div>

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.name}
              className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 ltr:text-left rtl:text-right cursor-pointer"
              onClick={() => router.push(category.href)}
            >
              <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{category.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {category.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
