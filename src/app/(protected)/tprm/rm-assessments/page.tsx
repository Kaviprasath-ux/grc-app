"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Construction, Home, ChevronRight } from "lucide-react";

export default function RMAssessmentsPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessments")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Assessments")}</h1>
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
