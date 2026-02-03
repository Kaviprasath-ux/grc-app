"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ExcelImportPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">{t("Excel Import/Export")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Excel Import Configuration")}</CardTitle>
          <CardDescription>
            {t("Configure Excel import settings and manage data imports.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>{t("Excel Import/Export configuration coming soon.")}</p>
            <p className="text-sm mt-2">{t("This feature will allow you to import and export data via Excel files.")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
