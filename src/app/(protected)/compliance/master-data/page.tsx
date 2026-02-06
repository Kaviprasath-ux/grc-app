"use client";

import { useRouter } from "next/navigation";
import {
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  FolderTree,
  FileText,
  Home,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface MasterDataCategory {
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export default function MasterDataPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const masterDataCategories: MasterDataCategory[] = [
    {
      name: t("Framework"),
      description: t("Manage compliance frameworks and standards"),
      icon: Layers,
      href: "/compliance/master-data/framework",
    },
    {
      name: t("Controls"),
      description: t("Manage control definitions and templates"),
      icon: Shield,
      href: "/compliance/master-data/controls",
    },
    {
      name: t("Governance"),
      description: t("Manage governance document templates"),
      icon: FileCheck,
      href: "/compliance/master-data/governance",
    },
    {
      name: t("Evidences"),
      description: t("Manage evidence definitions and requirements"),
      icon: ClipboardList,
      href: "/compliance/master-data/evidences",
    },
    {
      name: t("Domain"),
      description: t("Manage control domains and categories"),
      icon: FolderTree,
      href: "/compliance/master-data/domain",
    },
    {
      name: t("Governance Templates"),
      description: t("Manage policy, standard, and procedure templates"),
      icon: FileText,
      href: "/compliance/master-data/governance-templates",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Integrated Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Master Data")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Master Data")}</h1>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masterDataCategories.map((category) => {
          const Icon = category.icon;

          return (
            <div
              key={category.href}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full min-h-[160px]"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Icon className="h-6 w-6 text-blue-600" />
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
