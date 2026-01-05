"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const settingsCards = [
  // Row 1
  { title: "Audit Category", href: "/internal-audit/settings/categories" },
  { title: "Nature of Controls", href: "/internal-audit/settings/nature-of-controls" },
  { title: "Risk Assessment Configuration", href: "/internal-audit/settings/risk-assessment" },
  { title: "Periodicity", href: "/internal-audit/settings/periodicity" },
  // Row 2
  { title: "Escalation Configuration", href: "/internal-audit/settings/escalation", isPopup: true },
  { title: "Audit Type", href: "/internal-audit/settings/audit-types" },
  { title: "User Management", href: "/internal-audit/settings/user-management" },
  { title: "Department", href: "/internal-audit/settings/departments" },
  // Row 3
  { title: "Process", href: "/internal-audit/settings/process" },
];

export default function InternalAuditSettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Audit Settings</h1>
        </div>
      </div>

      {/* Settings Cards Grid - matching source system layout */}
      <div className="space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {settingsCards.slice(0, 4).map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="hover:bg-accent hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex items-center justify-center py-8">
                  <CardTitle className="text-center text-lg">{card.title}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {settingsCards.slice(4, 8).map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="hover:bg-accent hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex items-center justify-center py-8">
                  <CardTitle className="text-center text-lg">{card.title}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {settingsCards.slice(8).map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="hover:bg-accent hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex items-center justify-center py-8">
                  <CardTitle className="text-center text-lg">{card.title}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
