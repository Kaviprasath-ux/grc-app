"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, Home, Building2, ShieldAlert, AlertTriangle, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface RiskItem {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string;
}

interface DepartmentData {
  id: string;
  name: string;
  risks: RiskItem[];
}

interface RiskUniverseData {
  departments: DepartmentData[];
  totalDepartments: number;
  totalRisks: number;
}

export default function RiskUniversePage() {
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [data, setData] = useState<RiskUniverseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskUniverse();
  }, []);

  const fetchRiskUniverse = async () => {
    try {
      const response = await fetch("/api/internal-audit/risk-universe");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch risk universe:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelStyle = (level: string) => {
    switch (level) {
      case "Extreme":
        return { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600", dot: "bg-red-400" };
      case "High":
        return { bg: "bg-orange-50 border border-orange-200", text: "text-orange-700", sub: "text-orange-600", dot: "bg-orange-400" };
      case "Medium":
        return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", sub: "text-amber-600", dot: "bg-amber-400" };
      case "Low":
        return { bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600", dot: "bg-emerald-400" };
      default:
        return { bg: "bg-slate-50 border border-slate-200", text: "text-slate-700", sub: "text-slate-500", dot: "bg-slate-400" };
    }
  };

  // Compute summary stats
  const allRisks = data?.departments.flatMap(d => d.risks) || [];
  const extremeCount = allRisks.filter(r => r.riskLevel === "Extreme").length;
  const highCount = allRisks.filter(r => r.riskLevel === "High").length;
  const mediumCount = allRisks.filter(r => r.riskLevel === "Medium").length;
  const lowCount = allRisks.filter(r => r.riskLevel === "Low").length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </>
          )}
          <span className="text-primary-700 font-medium">{t("Risk Universe")}</span>
        </nav>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Risk Universe")}</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading risk universe...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Risk Universe")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Universe")}</h1>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Departments")}</p>
              <p className="text-xl font-bold text-slate-800">{data?.totalDepartments || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Total Risks")}</p>
              <p className="text-xl font-bold text-slate-800">{data?.totalRisks || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Extreme / High")}</p>
              <p className="text-xl font-bold text-slate-800">{extremeCount + highCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Medium / Low")}</p>
              <p className="text-xl font-bold text-slate-800">{mediumCount + lowCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Map Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{t("Risk Map")}</h3>
          {/* Inline Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Extreme")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-orange-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("High")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Medium")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Low")}</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="relative">
            {/* Root Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {t("Risk Universe")}
              </div>
            </div>

            {/* Connection line from root */}
            <div className="flex justify-center mb-4">
              <div className="w-0.5 h-8 bg-slate-200"></div>
            </div>

            {/* Scrollable container */}
            <div className="overflow-x-auto pb-4">
              {/* Horizontal line connecting departments */}
              {data?.departments && data.departments.length > 0 && (
                <div className="flex mb-4">
                  <div className="h-0.5 bg-slate-200 flex-1" style={{ minWidth: `${data.departments.length * 160}px` }}></div>
                </div>
              )}

              {/* Department branches */}
              <TooltipProvider>
                <div className="flex gap-6" style={{ minWidth: 'max-content' }}>
                  {data?.departments && data.departments.length > 0 ? (
                    data.departments.map((dept) => (
                      <div key={dept.id} className="flex flex-col items-center flex-shrink-0">
                        {/* Vertical line to department */}
                        <div className="w-0.5 h-4 bg-slate-200"></div>

                        {/* Department box */}
                        <div className={`rounded-xl px-5 py-3 mb-4 min-w-[150px] text-center transition-all ${
                          dept.risks.length > 0
                            ? 'border border-slate-200 bg-white shadow-sm'
                            : 'border border-dashed border-slate-200 bg-slate-50/50'
                        }`}>
                          <div className="flex items-center justify-center gap-1.5 mb-0.5">
                            <Building2 className={`h-3.5 w-3.5 ${dept.risks.length > 0 ? 'text-primary-500' : 'text-slate-300'}`} />
                            <span className={`text-sm font-semibold ${dept.risks.length > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                              {dept.name}
                            </span>
                          </div>
                          <div className={`text-xs ${dept.risks.length > 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                            {dept.risks.length > 0 ? `${dept.risks.length} ${t("risk(s)")}` : t("No risks")}
                          </div>
                        </div>

                        {/* Risk items */}
                        <div className="flex flex-col items-center gap-3">
                          {dept.risks.length > 0 ? (
                            dept.risks.map((risk) => {
                              const style = getRiskLevelStyle(risk.riskLevel);
                              return (
                                <div key={risk.id} className="flex flex-col items-center">
                                  {/* Connection line */}
                                  <div className="w-0.5 h-3 bg-slate-200"></div>

                                  {/* Risk card with tooltip */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href="/internal-audit/risk-register"
                                        className={`${style.bg} rounded-xl px-4 py-3 min-w-[135px] text-center cursor-pointer transition-all  active:scale-100 block`}
                                      >
                                        <div className={`font-semibold text-sm mb-1 ${style.text}`}>
                                          {risk.riskId}
                                        </div>
                                        <div className={`text-xs font-medium ${style.sub}`}>
                                          {risk.riskLevel}
                                        </div>
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs p-3">
                                      <div className="space-y-1.5">
                                        <p className="font-semibold text-slate-800">{risk.riskName}</p>
                                        <div className="text-xs text-slate-500">
                                          <span>{t("Risk Level")}: </span>
                                          <span className="font-medium text-slate-700">{risk.riskLevel}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-100">{t("Click to view in Risk Register")}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-slate-300 italic py-2">
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : null}
                </div>
              </TooltipProvider>
            </div>

            {/* Empty state */}
            {(!data?.departments || data.departments.length === 0) && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-base font-medium text-slate-600">{t("No risks in the risk register yet")}</p>
                <p className="text-sm text-slate-400 mt-1">{t("Add risks to the Risk Register to see them here")}</p>
                <Link href="/internal-audit/risk-register">
                  <Button
                    variant="outline"
                    className="mt-4 border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    {t("Go to Risk Register")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
