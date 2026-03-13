"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ChevronRight, ClipboardList, Building2, Loader2, Factory, UserCheck, Clock, Zap, LogIn, CheckCircle2, LogOut, Archive, Ban } from "lucide-react";

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
      Inactive: number;
    };
  };
}

// CSS-only circular progress ring
function CircularProgress({
  percentage,
  size = 140,
  strokeWidth = 10,
  color,
  children,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  children: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
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

  const assessmentItems = data ? [
    { label: "Assessment Factory", count: data.assessments.breakdown["Assessment Factory"], dot: "border-blue-400", bg: "bg-blue-50", iconColor: "text-blue-600", icon: Factory },
    { label: "Onboarding Assessment", count: data.assessments.breakdown["Onboarding Assessment"], dot: "border-green-400", bg: "bg-green-50", iconColor: "text-green-600", icon: UserCheck },
    { label: "Periodic Assessment", count: data.assessments.breakdown["Periodic Assessment"], dot: "border-amber-400", bg: "bg-amber-50", iconColor: "text-amber-600", icon: Clock },
    { label: "On-Demand Assessment", count: data.assessments.breakdown["On-Demand Assessment"], dot: "border-purple-400", bg: "bg-purple-50", iconColor: "text-purple-600", icon: Zap },
  ] : [];

  const vendorItems = data ? [
    { label: "Onboarding", count: data.vendors.breakdown.Onboarding, dot: "border-blue-400", bg: "bg-blue-50", iconColor: "text-blue-600", icon: LogIn },
    { label: "Onboarded", count: data.vendors.breakdown.Onboarded, dot: "border-green-400", bg: "bg-green-50", iconColor: "text-green-600", icon: CheckCircle2 },
    { label: "Offboarding", count: data.vendors.breakdown.Offboarding, dot: "border-amber-400", bg: "bg-amber-50", iconColor: "text-amber-600", icon: LogOut },
    { label: "Offboarded", count: data.vendors.breakdown.Offboarded, dot: "border-slate-400", bg: "bg-slate-50", iconColor: "text-slate-600", icon: Archive },
    { label: "Inactive", count: data.vendors.breakdown.Inactive, dot: "border-red-400", bg: "bg-red-50", iconColor: "text-red-600", icon: Ban },
  ] : [];

  const getUsageColor = (ratio: number) => {
    if (ratio > 0.9) return "#ef4444";
    if (ratio > 0.7) return "#f59e0b";
    return "#6366f1";
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Program Monitor")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Program Monitor")}</h1>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">{t("Failed to load data")}</p>
            <p className="text-xs text-slate-400">{t("Please try refreshing the page")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row — Two summary cards with circular progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assessment Summary */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <CircularProgress
                    percentage={data.assessments.limit > 0 ? (data.assessments.total / data.assessments.limit) * 100 : 0}
                    color={data.assessments.limit > 0 ? getUsageColor(data.assessments.total / data.assessments.limit) : "#6366f1"}
                  >
                    <span className="text-2xl font-bold text-slate-800">{data.assessments.total}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t("of")} {data.assessments.limit || "\u221E"}</span>
                  </CircularProgress>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-primary-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">{t("Total Assessment")}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {data.assessments.limit > 0
                        ? `${Math.round((data.assessments.total / data.assessments.limit) * 100)}% ${t("usage")}`
                        : t("Unlimited")}
                    </p>
                    {/* Mini breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                      {assessmentItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${item.dot} border`} />
                          <span className="text-xs text-slate-500 truncate">{t(item.label).replace(" Assessment", "")}</span>
                          <span className="text-xs font-semibold text-slate-700 ltr:ml-auto rtl:mr-auto">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendor Summary */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <CircularProgress
                    percentage={data.vendors.limit > 0 ? (data.vendors.total / data.vendors.limit) * 100 : 0}
                    color={data.vendors.limit > 0 ? getUsageColor(data.vendors.total / data.vendors.limit) : "#6366f1"}
                  >
                    <span className="text-2xl font-bold text-slate-800">{data.vendors.total}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t("of")} {data.vendors.limit || "\u221E"}</span>
                  </CircularProgress>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">{t("Total Vendor")}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {data.vendors.limit > 0
                        ? `${Math.round((data.vendors.total / data.vendors.limit) * 100)}% ${t("usage")}`
                        : t("Unlimited")}
                    </p>
                    {/* Mini breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                      {vendorItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${item.dot} border`} />
                          <span className="text-xs text-slate-500 truncate">{t(item.label)}</span>
                          <span className="text-xs font-semibold text-slate-700 ltr:ml-auto rtl:mr-auto">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row — Breakdown tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assessment Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{t("Assessment Breakdown")}</h3>
              <div className="grid grid-cols-2 gap-3">
                {assessmentItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`rounded-xl border border-slate-200 bg-white p-5`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${item.iconColor}`} />
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">{item.count}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">{t(item.label)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vendor Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{t("Vendor Breakdown")}</h3>
              <div className="grid grid-cols-2 gap-3">
                {vendorItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`rounded-xl border border-slate-200 bg-white p-5`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${item.iconColor}`} />
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">{item.count}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">{t(item.label)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
