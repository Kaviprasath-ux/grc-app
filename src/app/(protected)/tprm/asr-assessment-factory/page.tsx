"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Home, ChevronRight, Download, Upload, Paperclip, FileBarChart } from "lucide-react";

export default function AsrAssessmentFactoryPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Factory")}</span>
      </nav>

      <h1 className="text-2xl font-bold text-center">{t("Assessment Factory")}</h1>

      {/* 4-step workflow */}
      <div className="flex flex-wrap items-start justify-center gap-4 mt-8">
        {/* Step 1: Download Template */}
        <button className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Download Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Download the template and fill it up with your own questionnaire.")}
          </p>
        </button>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 2: Upload Template */}
        <button className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Upload the Completed Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Once the template is populated, upload the spreadsheet by clicking here.")}
          </p>
        </button>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 3: Attach Artifacts */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <Paperclip className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Attach Supporting Artifacts")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Attach the necessary artifacts, which may include word documents, PDF's or image files.")}
          </p>
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 4: Generate Report */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <FileBarChart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Generate Report")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("The results will be displayed on the overview page and downloaded as a spreadsheet.")}
          </p>
        </div>
      </div>
    </div>
  );
}
