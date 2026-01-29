"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import {
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  FolderTree,
  FileText,
} from "lucide-react";

interface SettingCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
}

const masterDataCategories: SettingCard[] = [
  {
    id: "framework",
    title: "Framework",
    icon: <Layers className="h-12 w-12" />,
    href: "/compliance/master-data/framework",
  },
  {
    id: "controls",
    title: "Controls",
    icon: <Shield className="h-12 w-12" />,
    href: "/compliance/master-data/controls",
  },
  {
    id: "governance",
    title: "Governance",
    icon: <FileCheck className="h-12 w-12" />,
    href: "/compliance/master-data/governance",
  },
  {
    id: "evidences",
    title: "Evidences",
    icon: <ClipboardList className="h-12 w-12" />,
    href: "/compliance/master-data/evidences",
  },
  {
    id: "domain",
    title: "Domain",
    icon: <FolderTree className="h-12 w-12" />,
    href: "/compliance/master-data/domain",
  },
  {
    id: "governance-templates",
    title: "Governance Templates",
    icon: <FileText className="h-12 w-12" />,
    href: "/compliance/master-data/governance-templates",
  },
];

export default function MasterDataPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Master Data" />

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {masterDataCategories.map((card) => (
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
  );
}
