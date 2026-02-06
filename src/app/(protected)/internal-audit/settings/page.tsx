"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { useLanguage } from "@/contexts/LanguageContext";

export default function InternalAuditSettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Settings")}</h1>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.name}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full min-h-[160px]"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-primary-50 rounded-lg flex-shrink-0">
                  <Icon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-slate-800">{category.name}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-3 mt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(category.href)}
                >
                  {t("Manage")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
