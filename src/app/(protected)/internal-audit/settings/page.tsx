"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  FolderKanban,
  Shield,
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
    icon: FolderKanban,
    href: "/internal-audit/settings/categories",
    color: "bg-blue-500",
  },
  {
    name: "Nature of Controls",
    description: "Define control types and characteristics",
    icon: Shield,
    href: "/internal-audit/settings/nature-of-controls",
    color: "bg-green-500",
  },
  {
    name: "Risk Assessment",
    description: "Configure risk assessment methodology",
    icon: Activity,
    href: "/internal-audit/settings/risk-assessment",
    color: "bg-red-500",
  },
  {
    name: "Periodicity",
    description: "Define audit frequency and schedules",
    icon: Clock,
    href: "/internal-audit/settings/periodicity",
    color: "bg-purple-500",
  },
  {
    name: "Escalation",
    description: "Set up escalation rules and thresholds",
    icon: AlertTriangle,
    href: "/internal-audit/settings/escalation",
    color: "bg-orange-500",
  },
  {
    name: "Audit Type",
    description: "Manage different types of audits",
    icon: FileType,
    href: "/internal-audit/settings/audit-types",
    color: "bg-teal-500",
  },
  {
    name: "User Management",
    description: "Manage audit users and permissions",
    icon: Users,
    href: "/internal-audit/settings/user-management",
    color: "bg-pink-500",
  },
  {
    name: "Department",
    description: "Manage organizational departments",
    icon: Building2,
    href: "/internal-audit/settings/departments",
    color: "bg-indigo-500",
  },
  {
    name: "Process",
    description: "Define audit processes and workflows",
    icon: GitBranch,
    href: "/internal-audit/settings/process",
    color: "bg-cyan-500",
  },
];

export default function InternalAuditSettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Audit Settings</h1>
        <p className="text-gray-600">
          Manage master data for internal audit module
        </p>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {settingsCategories.map((category) => (
          <Card
            key={category.name}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(category.href)}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div
                  className={`p-4 rounded-full ${category.color} bg-opacity-10`}
                >
                  <category.icon
                    className={`h-8 w-8 ${category.color.replace("bg-", "text-")}`}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {category.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
