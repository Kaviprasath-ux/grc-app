"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  riskRating?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
  status?: string | null;
  department?: { id: string; name: string } | null;
  owner?: { id: string; fullName: string } | null;
  threats?: { threat: { id: string; name: string } }[];
  assets?: { asset: { id: string; name: string } }[];
  createdAt?: string | null;
  assessmentStatus?: string | null;
  responseStatus?: string | null;
}

interface Asset {
  id: string;
  name: string;
}

function ManagementReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedOptions = searchParams.get("options")?.split(",") || [];
  const filterYear = searchParams.get("year") || new Date().getFullYear().toString();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch risks
        const riskRes = await fetch("/api/risks");
        if (riskRes.ok) {
          const data = await riskRes.json();
          setRisks(data.data || data || []);
        }

        // Fetch assets
        const assetRes = await fetch("/api/assets");
        if (assetRes.ok) {
          const data = await assetRes.json();
          setAssets(data.data || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDownloadReport = () => {
    const content = reportRef.current;
    if (!content) return;

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Get computed styles and clone the content
    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("");
        } catch {
          return "";
        }
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t("Risk Management Report")}</title>
          <style>
            ${styles}
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                padding: 20px;
              }
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              background: white;
            }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  // Calculate average residual risk
  const avgResidualRisk = risks.length > 0
    ? Math.round(
        risks.reduce((sum, risk) => {
          const residual = (risk.residualLikelihood || risk.likelihood || 1) *
                          (risk.residualImpact || risk.impact || 1);
          return sum + residual;
        }, 0) / risks.length
      )
    : 0;

  // Calculate average inherent risk
  const avgInherentRisk = risks.length > 0
    ? Math.round(
        risks.reduce((sum, risk) => {
          const inherent = (risk.likelihood || 1) * (risk.impact || 1);
          return sum + inherent;
        }, 0) / risks.length
      )
    : 0;

  // Get top 5 risks by severity (likelihood * impact)
  const top5Risks = [...risks]
    .sort((a, b) => {
      const scoreA = (a.likelihood || 1) * (a.impact || 1);
      const scoreB = (b.likelihood || 1) * (b.impact || 1);
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // Get top 5 assets (from risk associations)
  const assetCounts: Record<string, { name: string; count: number }> = {};
  risks.forEach(risk => {
    risk.assets?.forEach(a => {
      const name = a.asset.name;
      if (!assetCounts[name]) {
        assetCounts[name] = { name, count: 0 };
      }
      assetCounts[name].count++;
    });
  });
  const top5Assets = Object.values(assetCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get top 5 departments
  const deptCounts: Record<string, { name: string; count: number }> = {};
  risks.forEach(risk => {
    const name = risk.department?.name || t("Unassigned");
    if (!deptCounts[name]) {
      deptCounts[name] = { name, count: 0 };
    }
    deptCounts[name].count++;
  });
  const top5Departments = Object.values(deptCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get top 5 threats
  const threatCounts: Record<string, { name: string; count: number }> = {};
  risks.forEach(risk => {
    risk.threats?.forEach(t => {
      const name = t.threat.name;
      if (!threatCounts[name]) {
        threatCounts[name] = { name, count: 0 };
      }
      threatCounts[name].count++;
    });
  });
  const top5Threats = Object.values(threatCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get top 5 risk owners
  const ownerCounts: Record<string, { name: string; count: number }> = {};
  risks.forEach(risk => {
    const name = risk.owner?.fullName || t("Unassigned");
    if (!ownerCounts[name]) {
      ownerCounts[name] = { name, count: 0 };
    }
    ownerCounts[name].count++;
  });
  const top5Owners = Object.values(ownerCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Active risks by rating
  const risksByRating: Record<string, number> = {};
  risks.forEach(risk => {
    const rating = risk.riskRating || t("Not Rated");
    risksByRating[rating] = (risksByRating[rating] || 0) + 1;
  });

  // Risk activity by month (for trend and timeline)
  const risksByMonth: Record<string, { identified: number; assessed: number; mitigated: number }> = {};
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  months.forEach(m => {
    risksByMonth[m] = { identified: 0, assessed: 0, mitigated: 0 };
  });

  risks.forEach(risk => {
    if (risk.createdAt) {
      const date = new Date(risk.createdAt);
      if (date.getFullYear().toString() === filterYear) {
        const month = months[date.getMonth()];
        risksByMonth[month].identified++;
        if (risk.assessmentStatus === "Completed") {
          risksByMonth[month].assessed++;
        }
        if (risk.responseStatus === "Completed") {
          risksByMonth[month].mitigated++;
        }
      }
    }
  });

  // Rating color helpers
  const getRatingBar = (rating: string) => {
    if (rating === "Low Risk") return "bg-emerald-400";
    if (rating === "Medium") return "bg-sky-400";
    if (rating === "High") return "bg-amber-400";
    if (rating === "Very High" || rating === "very high") return "bg-rose-400";
    if (rating === "Catastrophic") return "bg-red-600";
    return "bg-slate-300";
  };

  const getRatingBadge = (rating: string) => {
    if (rating === "Low Risk") return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (rating === "Medium") return "bg-sky-50 text-sky-600 border-sky-200";
    if (rating === "High") return "bg-amber-50 text-amber-600 border-amber-200";
    if (rating === "Very High" || rating === "very high") return "bg-rose-50 text-rose-600 border-rose-200";
    if (rating === "Catastrophic") return "bg-red-50 text-red-700 border-red-200";
    return "bg-slate-50 text-slate-500 border-slate-200";
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/dashboard" className="text-slate-400 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/reports" className="text-slate-400 hover:text-primary-600 transition-colors">
            {t("Reports")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Management Report")}</span>
        </nav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/dashboard" className="text-slate-400 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/reports" className="text-slate-400 hover:text-primary-600 transition-colors">
          {t("Reports")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Management Report")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t("Management Report")}</h1>
          
        </div>
        <Button size="sm" onClick={handleDownloadReport} className="bg-primary-600 hover:bg-primary-700">
          <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
          {t("Download")}
        </Button>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-4">

        {/* Average Risk Scores */}
        {(selectedOptions.includes("average-residual-risk") || selectedOptions.includes("average-inherent-risk")) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedOptions.includes("average-inherent-risk") && (
              <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Average Inherent Risk")}</p>
                <p className="text-3xl font-semibold text-slate-800 mt-1.5">{avgInherentRisk}</p>
              </div>
            )}
            {selectedOptions.includes("average-residual-risk") && (
              <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Average Residual Risk")}</p>
                <p className="text-3xl font-semibold text-slate-800 mt-1.5">{avgResidualRisk}</p>
              </div>
            )}
          </div>
        )}

        {/* Active Risks by Rating */}
        {selectedOptions.includes("active-risks-by-rating") && (() => {
          const totalRisks = Object.values(risksByRating).reduce((sum, c) => sum + c, 0);
          return (
            <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-sm font-medium text-slate-700">{t("Active Risks by Rating")}</p>
                <span className="text-[11px] text-slate-400">{totalRisks} {t("total")}</span>
              </div>
              <div className="space-y-2.5">
                {Object.entries(risksByRating)
                  .sort(([, a], [, b]) => b - a)
                  .map(([rating, count]) => {
                    const pct = totalRisks > 0 ? Math.round((count / totalRisks) * 100) : 0;
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="w-24 text-xs text-slate-500 truncate">{rating}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getRatingBar(rating)}`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span className="w-6 text-[11px] text-slate-500 ltr:text-right rtl:text-left tabular-nums">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* Top 5 Risks by Severity */}
        {selectedOptions.includes("top-5-risk-severity") && (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-3.5">
              <p className="text-sm font-medium text-slate-700">{t("Top 5 Risks by Severity")}</p>
            </div>
            <div className="border-t border-slate-100">
              {top5Risks.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-slate-400">{t("No risk data available")}</p>
                </div>
              ) : (
                top5Risks.map((risk, idx) => (
                  <div key={risk.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0">
                    <span className="w-5 text-[11px] font-medium text-slate-300">{idx + 1}</span>
                    <span className="flex-1 text-sm text-slate-600 truncate">{risk.name}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getRatingBadge(risk.riskRating || "")}`}>
                      {risk.riskRating || "-"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Top 5 Lists Grid */}
        {(selectedOptions.includes("top-5-assets") || selectedOptions.includes("top-5-departments") || selectedOptions.includes("top-5-threats") || selectedOptions.includes("top-5-risk-owners")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top 5 Assets */}
            {selectedOptions.includes("top-5-assets") && (
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-5 py-3.5">
                  <p className="text-sm font-medium text-slate-700">{t("Top 5 Assets")}</p>
                </div>
                <div className="border-t border-slate-100">
                  {top5Assets.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">{t("No asset data available")}</p>
                    </div>
                  ) : (
                    top5Assets.map((asset, idx) => (
                      <div key={asset.name} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0">
                        <span className="w-5 text-[11px] font-medium text-slate-300">{idx + 1}</span>
                        <span className="flex-1 text-sm text-slate-600 truncate">{asset.name}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{asset.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Top 5 Departments */}
            {selectedOptions.includes("top-5-departments") && (
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-5 py-3.5">
                  <p className="text-sm font-medium text-slate-700">{t("Top 5 Departments")}</p>
                </div>
                <div className="border-t border-slate-100">
                  {top5Departments.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">{t("No department data available")}</p>
                    </div>
                  ) : (
                    top5Departments.map((dept, idx) => (
                      <div key={dept.name} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0">
                        <span className="w-5 text-[11px] font-medium text-slate-300">{idx + 1}</span>
                        <span className="flex-1 text-sm text-slate-600 truncate">{dept.name}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{dept.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Top 5 Threats */}
            {selectedOptions.includes("top-5-threats") && (
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-5 py-3.5">
                  <p className="text-sm font-medium text-slate-700">{t("Top 5 Threats")}</p>
                </div>
                <div className="border-t border-slate-100">
                  {top5Threats.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">{t("No threat data available")}</p>
                    </div>
                  ) : (
                    top5Threats.map((threat, idx) => (
                      <div key={threat.name} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0">
                        <span className="w-5 text-[11px] font-medium text-slate-300">{idx + 1}</span>
                        <span className="flex-1 text-sm text-slate-600 truncate">{threat.name}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{threat.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Top 5 Risk Owners */}
            {selectedOptions.includes("top-5-risk-owners") && (
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-5 py-3.5">
                  <p className="text-sm font-medium text-slate-700">{t("Top 5 Risk Owners")}</p>
                </div>
                <div className="border-t border-slate-100">
                  {top5Owners.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">{t("No owner data available")}</p>
                    </div>
                  ) : (
                    top5Owners.map((owner, idx) => (
                      <div key={owner.name} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0">
                        <span className="w-5 text-[11px] font-medium text-slate-300">{idx + 1}</span>
                        <span className="flex-1 text-sm text-slate-600 truncate">{owner.name}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{owner.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risk Activity Charts */}
        {(selectedOptions.includes("risk-activity-trend") || selectedOptions.includes("risk-activity-timeline")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Risk Activity Trend */}
            {selectedOptions.includes("risk-activity-trend") && (
              <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-sm font-medium text-slate-700">{t("Risk Activity Trend")}</p>
                  <span className="text-[11px] text-slate-400">{filterYear}</span>
                </div>
                <div className="space-y-1.5">
                  {months.map(month => {
                    const data = risksByMonth[month];
                    const maxVal = Math.max(
                      ...months.map(m => Math.max(
                        risksByMonth[m].identified,
                        risksByMonth[m].assessed,
                        risksByMonth[m].mitigated
                      ))
                    ) || 1;
                    return (
                      <div key={month} className="flex items-center gap-2">
                        <span className="w-7 text-[10px] text-slate-400">{month}</span>
                        <div className="flex-1 flex gap-0.5">
                          <div
                            className="h-2 bg-sky-400 rounded-sm"
                            style={{ width: `${(data.identified / maxVal) * 100}%`, minWidth: data.identified > 0 ? '3px' : '0' }}
                          />
                          <div
                            className="h-2 bg-emerald-400 rounded-sm"
                            style={{ width: `${(data.assessed / maxVal) * 100}%`, minWidth: data.assessed > 0 ? '3px' : '0' }}
                          />
                          <div
                            className="h-2 bg-violet-400 rounded-sm"
                            style={{ width: `${(data.mitigated / maxVal) * 100}%`, minWidth: data.mitigated > 0 ? '3px' : '0' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-sky-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Identified")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Assessed")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-violet-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Mitigated")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Activity Timeline */}
            {selectedOptions.includes("risk-activity-timeline") && (
              <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-sm font-medium text-slate-700">{t("Risk Activity Timeline")}</p>
                  <span className="text-[11px] text-slate-400">{filterYear}</span>
                </div>
                <div className="space-y-1.5">
                  {months.map(month => {
                    const data = risksByMonth[month];
                    const maxVal = Math.max(
                      ...months.map(m => Math.max(
                        risksByMonth[m].identified,
                        risksByMonth[m].assessed,
                        risksByMonth[m].mitigated
                      ))
                    ) || 1;
                    return (
                      <div key={month} className="flex items-center gap-2">
                        <span className="w-7 text-[10px] text-slate-400">{month}</span>
                        <div className="flex-1 flex gap-0.5">
                          <div
                            className="h-2 bg-sky-400 rounded-sm"
                            style={{ width: `${(data.identified / maxVal) * 100}%`, minWidth: data.identified > 0 ? '3px' : '0' }}
                          />
                          <div
                            className="h-2 bg-emerald-400 rounded-sm"
                            style={{ width: `${(data.assessed / maxVal) * 100}%`, minWidth: data.assessed > 0 ? '3px' : '0' }}
                          />
                          <div
                            className="h-2 bg-violet-400 rounded-sm"
                            style={{ width: `${(data.mitigated / maxVal) * 100}%`, minWidth: data.mitigated > 0 ? '3px' : '0' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-sky-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Identified")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Assessed")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-violet-400 rounded-sm"></div>
                    <span className="text-[10px] text-slate-400">{t("Mitigated")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RiskManagementReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    }>
      <ManagementReportContent />
    </Suspense>
  );
}
