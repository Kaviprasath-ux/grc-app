"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Stats {
  riskCount: number;
  findingCount: number;
  auditHeadName: string;
}

function ReportPreviewContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const filterType = searchParams.get("filterType") || "Year";
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const [downloading, setDownloading] = useState(false);
  const [stats, setStats] = useState<Stats>({ riskCount: 0, findingCount: 0, auditHeadName: '' });
  const [loadingStats, setLoadingStats] = useState(true);

  // Format date for display (convert from YYYY-MM-DD to readable format)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Get display text for scope based on filter type
  const getScopeText = () => {
    if (filterType === "DateRange" && startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    return `${t("Financial year")} ${year}`;
  };

  useEffect(() => {
    fetchStats();
  }, [filterType, year, startDate, endDate]);

  const fetchStats = async () => {
    try {
      let url = `/api/internal-audit/audit-plan/stats?`;
      if (filterType === "DateRange" && startDate && endDate) {
        url += `filterType=DateRange&startDate=${startDate}&endDate=${endDate}`;
      } else {
        url += `year=${year}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats({ riskCount: data.riskCount, findingCount: data.findingCount, auditHeadName: data.auditHeadName || '' });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let url = `/api/internal-audit/audit-plan/download?`;
      let filename = "";
      if (filterType === "DateRange" && startDate && endDate) {
        url += `filterType=DateRange&startDate=${startDate}&endDate=${endDate}`;
        filename = `Annual_Audit_Plan_${startDate}_to_${endDate}.pdf`;
      } else {
        url += `year=${year}`;
        filename = `Annual_Audit_Plan_${year}.pdf`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        toast.success(t("Report downloaded successfully"));
      } else {
        toast.error(t("Failed to download report"));
      }
    } catch (error) {
      console.error("Failed to download report:", error);
      toast.error(t("Failed to download report"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Download button */}
      <div className="flex items-center justify-end">
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t("Download Report")}
        </Button>
      </div>

      {/* Report Content */}
      <Card className="p-6 space-y-6">
        {/* Document Metadata */}
        <div className="space-y-3">
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Document Type")} :</span>
            <span className="text-blue-600">{t("Annual plan report")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Document Reference")} :</span>
            <span className="text-blue-600">
              {filterType === "DateRange" && startDate && endDate
                ? `MOF-IAD-${startDate}-${endDate}`
                : `MOF-IAD-${year}`}
            </span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Responsible Department")} :</span>
            <span>{t("Internal Audit Department")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Document Description")} :</span>
            <span>{t("This document includes the objectives and scope of the engagement, the audit team, completion timeline, execution phases, and reporting procedures.")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Purpose")} :</span>
            <span>{t("To use the form for documenting the planning of the internal audit engagement.")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Scope of Application")} :</span>
            <span>{t("Internal Audit Department")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Related Policies")} :</span>
            <div>
              <p>• {t("Internal Audit Charter")}</p>
              <p>• {t("Internal Audit Methodology")}</p>
            </div>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Related Procedures")} :</span>
            <span>{t("None")}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-2">
            <span className="font-semibold text-gray-700">{t("Reference Documents")} :</span>
            <div>
              <p>• {t("International Standards for the Professional Practice of Internal Auditing (IIA)")}</p>
              <p>• {t("Supplementary Guidance issued by the Institute of Internal Auditors (IIA)")}</p>
            </div>
          </div>
        </div>

        {/* Engagement Overview */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">{t("Engagement Overview")}</h3>
          <p className="text-gray-700">
            {t("The independent review of the internal controls established by the department, assessing their adequacy and effectiveness against the objectives they aim to achieve, and ensuring compliance with laws, regulations, policies, and procedures related to the relevant control systems, etc")}
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>{t("Independent review of the internal control system and its adequacy and effectiveness.")}</li>
            <li>{t("Verify compliance with laws, regulations, policies, and procedures.")}</li>
            <li>{t("Review the procedures and policies implemented in the department.")}</li>
            <li>{t("Follow up on the implementation of previous internal audit recommendations.")}</li>
          </ul>
        </div>

        {/* Audit Scope */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">{t("Audit Scope")}</h3>
          <p className="text-gray-700">{t("Financial year")} {filterType === "DateRange" && startDate ? startDate.split("-")[0] : year}</p>
        </div>

        {/* Initial Risks */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">{t("Initial Risks and Observations from Preliminary Document Review")}</h3>
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700 w-40">{t("Count of Risk")}:</span>
              <span className="text-blue-600 font-medium">
                {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : stats.riskCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700 w-40">{t("Count of Findings")}:</span>
              <span className="text-blue-600 font-medium">
                {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : stats.findingCount}
              </span>
            </div>
          </div>
        </div>

        {/* Audit Procedures and Tests */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">{t("Audit Procedures and Tests")}</h3>
          <p className="text-gray-700">{t("The team shall adhere to the following")}:</p>
          <ol className="list-decimal list-inside text-gray-700 space-y-1">
            <li>{t("Prepare and update the audit program and comply with it")}</li>
            <li>{t("Use audit methods such as data analysis, document review, and sampling audit")}</li>
            <li>{t("Follow up on previous audit results")}</li>
          </ol>
        </div>

        {/* Approvals */}
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900">{t("Approvals")}</h3>
          <div className="space-y-1">
            <p className="text-gray-700">{t("Job Title")} : {t("Audit Head")}</p>
            <p className="text-gray-700">
              {t("Name")} : {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (stats.auditHeadName || '-')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ReportPreviewPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    }>
      <ReportPreviewContent />
    </Suspense>
  );
}
