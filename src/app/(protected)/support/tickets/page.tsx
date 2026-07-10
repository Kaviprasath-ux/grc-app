"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { TicketsView } from "@/components/support/tickets-view";
import { ClipboardList } from "lucide-react";

export default function SupportTicketsPage() {
  const { t } = useLanguage();
  const { canView, isLoading } = usePermissions("support.tickets");

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("All Tickets")}</h1>
          <p className="text-sm text-muted-foreground">{t("Every support ticket across the organization")}</p>
        </div>
      </div>
      <TicketsView />
    </div>
  );
}
