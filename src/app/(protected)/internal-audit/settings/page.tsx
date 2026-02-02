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
} from "lucide-react";

const settingsCategories = [
  {
    name: "Audit Category",
    description: "Manage audit categories and classifications",
    icon: ClipboardList,
    href: "/internal-audit/settings/categories",
  },
  {
    name: "Nature of Controls",
    description: "Define control types and characteristics",
    icon: Network,
    href: "/internal-audit/settings/nature-of-controls",
  },
  {
    name: "Risk Assessment Configuration",
    description: "Configure risk assessment parameters",
    icon: Activity,
    href: "/internal-audit/settings/risk-assessment",
  },
  {
    name: "Periodicity",
    description: "Set audit frequency and intervals",
    icon: Clock,
    href: "/internal-audit/settings/periodicity",
  },
  {
    name: "Escalation Configuration",
    description: "Configure escalation timelines",
    icon: AlertTriangle,
    href: "/internal-audit/settings/escalation",
  },
  {
    name: "Audit Type",
    description: "Define types of audits",
    icon: FileType,
    href: "/internal-audit/settings/audit-types",
  },
  {
    name: "User Management",
    description: "Manage audit team members and roles",
    icon: Users,
    href: "/internal-audit/settings/user-management",
  },
  {
    name: "Department",
    description: "Configure departments for audits",
    icon: Building2,
    href: "/internal-audit/settings/departments",
  },
  {
    name: "Process",
    description: "Manage business processes",
    icon: GitBranch,
    href: "/internal-audit/settings/process",
  },
];

export default function InternalAuditSettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
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
                  Manage
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
