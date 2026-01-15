"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
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
} from "lucide-react";

interface SettingCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
}

const settingCards: SettingCard[] = [
  // Row 1
  {
    id: "category",
    title: "Category",
    icon: <Users className="h-12 w-12" />,
    href: "/risks/settings/category",
  },
  {
    id: "control-strength",
    title: "Control Strength",
    icon: <Shield className="h-12 w-12" />,
    href: "/risks/settings/control-strength",
  },
  {
    id: "likelihood",
    title: "Likelihood",
    icon: <TrendingUp className="h-12 w-12" />,
    href: "/risks/settings/likelihood",
  },
  {
    id: "threat",
    title: "Threat",
    icon: <AlertTriangle className="h-12 w-12" />,
    href: "/risks/settings/threat",
  },
  // Row 2
  {
    id: "vulnerability",
    title: "Vulnerability",
    icon: <ShieldAlert className="h-12 w-12" />,
    href: "/risks/settings/vulnerability",
  },
  {
    id: "risk-methodology",
    title: "Risk Methodology",
    icon: <Settings className="h-12 w-12" />,
    href: "/risks/settings/risk-methodology",
  },
  {
    id: "risk-category",
    title: "Risk Category",
    icon: <Layers className="h-12 w-12" />,
    href: "/risks/settings/risk-category",
  },
  {
    id: "impact",
    title: "Impact",
    icon: <BarChart3 className="h-12 w-12" />,
    href: "/risks/settings/impact",
  },
  // Row 3
  {
    id: "vulnerability-rating",
    title: "Vulnerability Rating",
    icon: <Target className="h-12 w-12" />,
    href: "/risks/settings/vulnerability-rating",
  },
  {
    id: "risk-sub-category",
    title: "Risk Sub Category",
    icon: <FolderTree className="h-12 w-12" />,
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
    <div className="space-y-6 p-6">
      <PageHeader title="Risk Settings" />

      {/* Settings Card Grid */}
      <div className="space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {settingCards.slice(0, 4).map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.href)}
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
                  {card.icon}
                </div>
                <h4 className="text-lg font-semibold text-center">{card.title}</h4>
              </div>
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {settingCards.slice(4, 8).map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.href)}
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
                  {card.icon}
                </div>
                <h4 className="text-lg font-semibold text-center">{card.title}</h4>
              </div>
            </button>
          ))}
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {settingCards.slice(8, 10).map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.href)}
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
                  {card.icon}
                </div>
                <h4 className="text-lg font-semibold text-center">{card.title}</h4>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
