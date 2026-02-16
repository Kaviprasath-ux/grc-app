"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Home, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

export default function ExcelImportPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Configuration")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Excel Import")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Excel Import/Export")}</h1>
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
