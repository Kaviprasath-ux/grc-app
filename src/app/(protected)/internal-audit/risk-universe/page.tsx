"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

// Unified colors matching org-chart component
const THEME_COLOR = "#64748b"; // slate-500 - subtle and professional
const LINE_COLOR = "#cbd5e1"; // slate-300 - light for lines

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
  const router = useRouter();
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

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "Extreme":
        return "#ef4444"; // red-500
      case "High":
        return "#f97316"; // orange-500
      case "Medium":
        return "#fbbf24"; // amber-400
      case "Low":
        return "#22c55e"; // green-500
      default:
        return "#94a3b8"; // slate-400
    }
  };

  const getRiskLevelTextColor = (level: string) => {
    return level === "Medium" ? "#1e293b" : "#ffffff"; // slate-900 for medium, white for others
  };

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

        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Universe")}</h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">{t("Loading risk universe...")}</p>
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
      <h1 className="text-2xl font-bold text-slate-800">{t("Risk Universe")}</h1>

      {/* Tree Structure Container */}
      <div className="overflow-x-auto">
        <div className="min-w-max p-8">
          {/* Root Node - Risk Universe (matching org-chart node style) */}
          <div className="flex justify-center mb-6">
            <div
              className="rounded-lg shadow-sm overflow-hidden min-w-[200px]"
              style={{ border: `1px solid ${LINE_COLOR}` }}
            >
              <div
                className="px-4 py-2 text-white text-center"
                style={{ backgroundColor: THEME_COLOR }}
              >
                <p className="text-xs font-medium">{t("Risk Overview")}</p>
              </div>
              <div className="bg-white px-4 py-2 text-center">
                <p className="text-sm font-semibold text-gray-700">{t("Risk Universe")}</p>
              </div>
            </div>
          </div>

          {/* Vertical line from root */}
          <div className="flex justify-center">
            <div
              style={{
                width: "2px",
                height: "20px",
                backgroundColor: LINE_COLOR,
              }}
            />
          </div>

          {/* Horizontal line connecting departments */}
          {data?.departments && data.departments.length > 0 && (
            <>
              <div className="flex justify-center">
                <div
                  style={{
                    height: "2px",
                    backgroundColor: LINE_COLOR,
                    width: `${(data.departments.length - 1) * 180 + 160}px`,
                  }}
                />
              </div>
            </>
          )}

          {/* Departments and Risks Grid */}
          {data?.departments && data.departments.length > 0 ? (
            <div className="flex justify-center">
              <div className="flex" style={{ gap: "24px" }}>
                {data.departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex flex-col items-center"
                    style={{ width: "160px" }}
                  >
                    {/* Vertical line to department */}
                    <div
                      style={{
                        width: "2px",
                        height: "30px",
                        backgroundColor: LINE_COLOR,
                      }}
                    />

                    {/* Department Box (matching org-chart node style) */}
                    <div
                      className="rounded-lg shadow-sm overflow-hidden w-full mb-4"
                      style={{ border: `1px solid ${LINE_COLOR}` }}
                    >
                      <div
                        className="px-3 py-2 text-white text-center"
                        style={{ backgroundColor: THEME_COLOR }}
                      >
                        <p className="text-xs font-medium">{t("Department")}</p>
                      </div>
                      <div className="bg-white px-3 py-2 text-center">
                        <p className="text-sm font-semibold text-gray-700 truncate">
                          {dept.name}
                        </p>
                      </div>
                    </div>

                    {/* Risk Items Column */}
                    <div className="flex flex-col gap-2 w-full">
                      {dept.risks.map((risk) => (
                        <div
                          key={risk.id}
                          className="rounded-lg shadow-sm overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ border: `1px solid ${LINE_COLOR}` }}
                          title={risk.riskName}
                          onClick={() =>
                            router.push(`/internal-audit/risk-register`)
                          }
                        >
                          <div
                            className="px-3 py-2 text-center"
                            style={{
                              backgroundColor: getRiskLevelColor(risk.riskLevel),
                              color: getRiskLevelTextColor(risk.riskLevel),
                            }}
                          >
                            <p className="text-xs font-medium">{risk.riskLevel}</p>
                          </div>
                          <div className="bg-white px-3 py-2 text-center">
                            <p className="text-sm font-semibold text-gray-700">
                              {risk.riskId}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 border border-dashed border-slate-200 rounded-lg mt-8">
              <div className="text-center">
                <p className="text-slate-500">{t("No risks in the risk register yet")}</p>
                <p className="text-sm text-slate-400 mt-2">
                  {t("Add risks to the Risk Register to see them here")}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => router.push("/internal-audit/risk-register")}
                >
                  {t("Go to Risk Register")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
