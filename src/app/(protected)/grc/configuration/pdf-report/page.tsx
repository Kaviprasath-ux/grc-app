"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PdfReportConfigPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">{t("PDF Report Configuration")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("PDF Report Settings")}</CardTitle>
          <CardDescription>
            {t("Configure PDF report templates, styling, and generation settings.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>{t("PDF Report configuration coming soon.")}</p>
            <p className="text-sm mt-2">{t("This feature will allow you to configure report templates and export settings.")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
