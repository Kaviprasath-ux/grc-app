"use client";

import { useRouter } from "next/navigation";
import {
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  FolderTree,
  FileText,
  ChevronRight,
  Home,
} from "lucide-react";
import Link from "next/link";

const masterDataCategories = [
  {
    name: "Framework",
    description: "Manage compliance frameworks and standards",
    icon: Layers,
    href: "/compliance/master-data/framework",
    bgColor: "bg-info-light",
    iconColor: "text-info-dark",
  },
  {
    name: "Controls",
    description: "Manage control definitions and templates",
    icon: Shield,
    href: "/compliance/master-data/controls",
    bgColor: "bg-success-light",
    iconColor: "text-success-dark",
  },
  {
    name: "Governance",
    description: "Manage governance document templates",
    icon: FileCheck,
    href: "/compliance/master-data/governance",
    bgColor: "bg-primary-100",
    iconColor: "text-primary-700",
  },
  {
    name: "Evidences",
    description: "Manage evidence definitions and requirements",
    icon: ClipboardList,
    href: "/compliance/master-data/evidences",
    bgColor: "bg-warning-light",
    iconColor: "text-warning-dark",
  },
  {
    name: "Domain",
    description: "Manage control domains and categories",
    icon: FolderTree,
    href: "/compliance/master-data/domain",
    bgColor: "bg-info-light",
    iconColor: "text-info-dark",
  },
  {
    name: "Governance Templates",
    description: "Manage policy, standard, and procedure templates",
    icon: FileText,
    href: "/compliance/master-data/governance-templates",
    bgColor: "bg-error-light",
    iconColor: "text-error-dark",
  },
];

export default function MasterDataPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Compliance</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Master Data</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Master Data</h1>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {masterDataCategories.map((category) => (
          <div
            key={category.name}
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
