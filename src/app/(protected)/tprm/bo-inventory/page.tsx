"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function BOInventoryPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("Browse and manage your vendor inventory")}
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">{t("Coming Soon")}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("This feature is under development")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
