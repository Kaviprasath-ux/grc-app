"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { TicketsView } from "@/components/support/tickets-view";
import { Inbox } from "lucide-react";

export default function SupportConsolePage() {
  const { t } = useLanguage();
  const { canView, isLoading } = usePermissions("support.console");

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("Agent Console")}</h1>
          <p className="text-sm text-muted-foreground">{t("Your support queue, sorted by priority and SLA")}</p>
        </div>
      </div>
      <TicketsView consoleMode />
    </div>
  );
}
