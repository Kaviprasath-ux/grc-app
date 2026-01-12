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
} from "lucide-react";

const settingsCategories = [
  {
    name: "Audit Category",
    icon: ClipboardList,
    href: "/internal-audit/settings/categories",
  },
  {
    name: "Nature of Controls",
    icon: Network,
    href: "/internal-audit/settings/nature-of-controls",
  },
  {
    name: "Risk Assessment Configuration",
    icon: Activity,
    href: "/internal-audit/settings/risk-assessment",
  },
  {
    name: "Periodicity",
    icon: Clock,
    href: "/internal-audit/settings/periodicity",
  },
  {
    name: "Escalation Configuration",
    icon: AlertTriangle,
    href: "/internal-audit/settings/escalation",
  },
  {
    name: "Audit Type",
    icon: FileType,
    href: "/internal-audit/settings/audit-types",
  },
  {
    name: "User Management",
    icon: Users,
    href: "/internal-audit/settings/user-management",
  },
  {
    name: "Department",
    icon: Building2,
    href: "/internal-audit/settings/departments",
  },
  {
    name: "Process",
    icon: GitBranch,
    href: "/internal-audit/settings/process",
  },
];

export default function InternalAuditSettingsPage() {
  const router = useRouter();

  return (
    <div className="p-6">
      {/* Settings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {settingsCategories.map((category) => (
          <div
            key={category.name}
            onClick={() => router.push(category.href)}
            className="cursor-pointer group"
          >
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 p-6 h-48 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 hover:shadow-xl">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <defs>
                    <pattern id={`pattern-${category.name}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="1" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill={`url(#pattern-${category.name})`} />
                </svg>
              </div>

              {/* Icon */}
              <div className="relative z-10 mb-4 p-4 rounded-full bg-white/10 border border-white/20">
                <category.icon className="h-10 w-10 text-white" />
              </div>

              {/* Title */}
              <h3 className="relative z-10 text-white font-semibold text-sm leading-tight">
                {category.name}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
