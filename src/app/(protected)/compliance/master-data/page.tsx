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
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MasterDataPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const masterDataCategories = [
    {
      name: t("Framework"),
      description: t("Manage compliance frameworks and standards"),
      icon: Layers,
      href: "/compliance/master-data/framework",
      bgColor: "bg-info-light",
      iconColor: "text-info-dark",
    },
    {
      name: t("Controls"),
      description: t("Manage control definitions and templates"),
      icon: Shield,
      href: "/compliance/master-data/controls",
      bgColor: "bg-success-light",
      iconColor: "text-success-dark",
    },
    {
      name: t("Governance"),
      description: t("Manage governance document templates"),
      icon: FileCheck,
      href: "/compliance/master-data/governance",
      bgColor: "bg-primary-100",
      iconColor: "text-primary-700",
    },
    {
      name: t("Evidences"),
      description: t("Manage evidence definitions and requirements"),
      icon: ClipboardList,
      href: "/compliance/master-data/evidences",
      bgColor: "bg-warning-light",
      iconColor: "text-warning-dark",
    },
    {
      name: t("Domain"),
      description: t("Manage control domains and categories"),
      icon: FolderTree,
      href: "/compliance/master-data/domain",
      bgColor: "bg-info-light",
      iconColor: "text-info-dark",
    },
    {
      name: t("Governance Templates"),
      description: t("Manage policy, standard, and procedure templates"),
      icon: FileText,
      href: "/compliance/master-data/governance-templates",
      bgColor: "bg-error-light",
      iconColor: "text-error-dark",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Master Data")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Master Data")}</h1>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {masterDataCategories.map((category) => (
          <div
            key={category.href}
            className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => router.push(category.href)}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${category.bgColor}`}>
                <category.icon className={`h-8 w-8 ${category.iconColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {category.name}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {category.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
