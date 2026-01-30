"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
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
} from "lucide-react";

const settingsCategories = [
  {
    id: "categories",
    title: "Audit Category",
    icon: ClipboardList,
    iconElement: <ClipboardList className="h-12 w-12" />,
    href: "/internal-audit/settings/categories",
  },
  {
    id: "nature-of-controls",
    title: "Nature of Controls",
    icon: Network,
    iconElement: <Network className="h-12 w-12" />,
    href: "/internal-audit/settings/nature-of-controls",
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment Configuration",
    icon: Activity,
    iconElement: <Activity className="h-12 w-12" />,
    href: "/internal-audit/settings/risk-assessment",
  },
  {
    id: "periodicity",
    title: "Periodicity",
    icon: Clock,
    iconElement: <Clock className="h-12 w-12" />,
    href: "/internal-audit/settings/periodicity",
  },
  {
    id: "escalation",
    title: "Escalation Configuration",
    icon: AlertTriangle,
    iconElement: <AlertTriangle className="h-12 w-12" />,
    href: "/internal-audit/settings/escalation",
  },
  {
    id: "audit-types",
    title: "Audit Type",
    icon: FileType,
    iconElement: <FileType className="h-12 w-12" />,
    href: "/internal-audit/settings/audit-types",
  },
  {
    id: "user-management",
    title: "User Management",
    icon: Users,
    iconElement: <Users className="h-12 w-12" />,
    href: "/internal-audit/settings/user-management",
  },
  {
    id: "departments",
    title: "Department",
    icon: Building2,
    iconElement: <Building2 className="h-12 w-12" />,
    href: "/internal-audit/settings/departments",
  },
  {
    id: "process",
    title: "Process",
    icon: GitBranch,
    iconElement: <GitBranch className="h-12 w-12" />,
    href: "/internal-audit/settings/process",
  },
];

export default function InternalAuditSettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Internal Audit Settings" />

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {settingsCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => router.push(category.href)}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20" />
              <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10" />
            </div>

            {/* Content */}
            <div className="relative flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-white/10 p-4 group-hover:bg-white/20 transition-colors">
                {category.iconElement}
              </div>
              <h4 className="text-lg font-semibold text-center">{category.title}</h4>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
