"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
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

const settingCards: SettingCard[] = [
  {
    id: "category",
    title: "Category",
    description: "Manage vulnerability and threat categories",
    icon: Users,
    href: "/risks/settings/category",
  },
  {
    id: "control-strength",
    title: "Control Strength",
    description: "Configure control strength levels and scores",
    icon: Shield,
    href: "/risks/settings/control-strength",
  },
  {
    id: "likelihood",
    title: "Likelihood",
    description: "Define risk likelihood ratings and scores",
    icon: TrendingUp,
    href: "/risks/settings/likelihood",
  },
  {
    id: "threat",
    title: "Threat",
    description: "Manage threat definitions and categories",
    icon: AlertTriangle,
    href: "/risks/settings/threat",
  },
  {
    id: "vulnerability",
    title: "Vulnerability",
    description: "Manage vulnerability definitions",
    icon: ShieldAlert,
    href: "/risks/settings/vulnerability",
  },
  {
    id: "risk-methodology",
    title: "Risk Methodology",
    description: "Configure risk scoring and ranges",
    icon: Settings,
    href: "/risks/settings/risk-methodology",
  },
  {
    id: "risk-category",
    title: "Risk Category",
    description: "Define risk categories and types",
    icon: Layers,
    href: "/risks/settings/risk-category",
  },
  {
    id: "impact",
    title: "Impact",
    description: "Configure impact categories and ratings",
    icon: BarChart3,
    href: "/risks/settings/impact",
  },
  {
    id: "vulnerability-rating",
    title: "Vulnerability Rating",
    description: "Define vulnerability rating levels",
    icon: Target,
    href: "/risks/settings/vulnerability-rating",
  },
  {
    id: "risk-sub-category",
    title: "Risk Sub Category",
    description: "Manage risk sub-categories",
    icon: FolderTree,
    href: "/risks/settings/risk-sub-category",
  },
];

export default function RiskSettingsPage() {
  const router = useRouter();
  const { canView, isLoading: permissionsLoading } = usePermissions('risk.settings');

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description="You don't have permission to access Risk Settings." />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Risk Management</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Settings</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Risk Settings</h1>
      </div>

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full min-h-[160px]"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-slate-800">{card.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-3 mt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(card.href)}
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
