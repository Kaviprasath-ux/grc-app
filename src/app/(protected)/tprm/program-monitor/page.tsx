"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, ChevronRight, ClipboardList, Building2 } from "lucide-react";

interface ProgramData {
  assessments: {
    total: number;
    limit: number;
    breakdown: {
      "Assessment Factory": number;
      "Onboarding Assessment": number;
      "Periodic Assessment": number;
      "On-Demand Assessment": number;
    };
  };
  vendors: {
    total: number;
    limit: number;
    breakdown: {
      Onboarding: number;
      Onboarded: number;
      Offboarding: number;
      Offboarded: number;
    };
  };
}

export default function ProgramMonitorPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/tprm/program-monitor");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch program monitor data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Program Monitor")}</span>
        </nav>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Program Monitor")}</span>
        </nav>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">{t("Failed to load data")}</p>
            <p className="text-xs text-slate-400">{t("Please try refreshing the page")}</p>
          </div>
        </div>
      </div>
    );
  }

  const assessmentItems = [
    { label: "Assessment Factory", count: data.assessments.breakdown["Assessment Factory"], color: "bg-blue-500" },
    { label: "Onboarding Assessment", count: data.assessments.breakdown["Onboarding Assessment"], color: "bg-green-500" },
    { label: "Periodic Assessment", count: data.assessments.breakdown["Periodic Assessment"], color: "bg-amber-500" },
    { label: "On-Demand Assessment", count: data.assessments.breakdown["On-Demand Assessment"], color: "bg-purple-500" },
  ];

  const vendorItems = [
    { label: "Onboarding", count: data.vendors.breakdown.Onboarding, color: "bg-blue-500" },
    { label: "Onboarded", count: data.vendors.breakdown.Onboarded, color: "bg-green-500" },
    { label: "Offboarding", count: data.vendors.breakdown.Offboarding, color: "bg-amber-500" },
    { label: "Offboarded", count: data.vendors.breakdown.Offboarded, color: "bg-slate-500" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Program Monitor")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Program Monitor")}</h1>
        <p className="text-sm text-slate-500">
          {t("Overview of your TPRM program usage and limits")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Assessment Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                {t("Total Assessment")}
              </CardTitle>
              <Badge variant="outline" className="text-lg font-semibold px-3 py-1">
                {data.assessments.total} / {data.assessments.limit || "\u221E"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assessmentItems.map((item) => {
                const percentage = data.assessments.limit > 0
                  ? Math.round((item.count / data.assessments.limit) * 100)
                  : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t(item.label)}</span>
                      <span className="font-medium text-slate-700">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Usage Summary */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("Total Usage")}</span>
                <span className="font-semibold text-slate-700">
                  {data.assessments.limit > 0
                    ? `${Math.round((data.assessments.total / data.assessments.limit) * 100)}%`
                    : `${data.assessments.total} ${t("assessments")}`}
                </span>
              </div>
              {data.assessments.limit > 0 && (
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.assessments.total / data.assessments.limit > 0.9
                        ? "bg-red-500"
                        : data.assessments.total / data.assessments.limit > 0.7
                        ? "bg-amber-500"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(
                        (data.assessments.total / data.assessments.limit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Vendor Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                {t("Total Vendor")}
              </CardTitle>
              <Badge variant="outline" className="text-lg font-semibold px-3 py-1">
                {data.vendors.total} / {data.vendors.limit || "\u221E"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendorItems.map((item) => {
                const percentage = data.vendors.limit > 0
                  ? Math.round((item.count / data.vendors.limit) * 100)
                  : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t(item.label)}</span>
                      <span className="font-medium text-slate-700">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Usage Summary */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("Total Usage")}</span>
                <span className="font-semibold text-slate-700">
                  {data.vendors.limit > 0
                    ? `${Math.round((data.vendors.total / data.vendors.limit) * 100)}%`
                    : `${data.vendors.total} ${t("vendors")}`}
                </span>
              </div>
              {data.vendors.limit > 0 && (
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.vendors.total / data.vendors.limit > 0.9
                        ? "bg-red-500"
                        : data.vendors.total / data.vendors.limit > 0.7
                        ? "bg-amber-500"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(
                        (data.vendors.total / data.vendors.limit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
