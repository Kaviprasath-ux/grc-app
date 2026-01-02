"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  FolderTree,
  FileText,
} from "lucide-react";

const masterDataCategories = [
  {
    name: "Framework",
    description: "Manage compliance frameworks and standards",
    icon: Layers,
    href: "/compliance/master-data/framework",
    color: "bg-blue-500",
  },
  {
    name: "Controls",
    description: "Manage control definitions and templates",
    icon: Shield,
    href: "/compliance/master-data/controls",
    color: "bg-green-500",
  },
  {
    name: "Governance",
    description: "Manage governance document templates",
    icon: FileCheck,
    href: "/compliance/master-data/governance",
    color: "bg-purple-500",
  },
  {
    name: "Evidences",
    description: "Manage evidence definitions and requirements",
    icon: ClipboardList,
    href: "/compliance/master-data/evidences",
    color: "bg-orange-500",
  },
  {
    name: "Domain",
    description: "Manage control domains and categories",
    icon: FolderTree,
    href: "/compliance/master-data/domain",
    color: "bg-teal-500",
  },
  {
    name: "Governance Templates",
    description: "Manage policy, standard, and procedure templates",
    icon: FileText,
    href: "/compliance/master-data/governance-templates",
    color: "bg-pink-500",
  },
];

export default function MasterDataPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Master Data</h1>
        <p className="text-gray-600">
          Manage master data for compliance module
        </p>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {masterDataCategories.map((category) => (
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
