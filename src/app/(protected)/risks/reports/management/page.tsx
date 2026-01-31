"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";

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
          <title>Risk Management Report</title>
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
    const name = risk.department?.name || "Unassigned";
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
    const name = risk.owner?.fullName || "Unassigned";
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
    const rating = risk.riskRating || "Not Rated";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/risks/reports")}
            className="h-8 w-8 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">Management Report</h1>
        </div>
        <Button onClick={handleDownloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Risk Management Report</h2>

        {/* Average Risks Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {selectedOptions.includes("average-residual-risk") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Residual Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-center py-4">{avgResidualRisk}</div>
              </CardContent>
            </Card>
          )}

          {selectedOptions.includes("average-inherent-risk") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Inherent Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-center py-4">{avgInherentRisk}</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Active Risks by Rating */}
        {selectedOptions.includes("active-risks-by-rating") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Risks by Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(risksByRating).map(([rating, count]) => {
                  const maxCount = Math.max(...Object.values(risksByRating));
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="w-24 text-sm">{rating}</div>
                      <div className="flex-1 bg-slate-100 rounded h-6">
                        <div
                          className={`h-6 rounded ${
                            rating === "Low Risk" ? "bg-green-500" :
                            rating === "High" ? "bg-orange-500" :
                            rating === "very high" || rating === "Very High" ? "bg-red-500" :
                            rating === "Catastrophic" ? "bg-red-800" :
                            "bg-blue-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top 5 Risks */}
        {selectedOptions.includes("top-5-risk-severity") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-2 text-sm font-medium">#</th>
                    <th className="text-left p-2 text-sm font-medium">Name</th>
                    <th className="text-left p-2 text-sm font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Risks.map((risk, idx) => (
                    <tr key={risk.id} className="border-b border-slate-200">
                      <td className="p-2 text-sm">#{idx + 1}</td>
                      <td className="p-2 text-sm">{risk.name}</td>
                      <td className="p-2 text-sm">{risk.riskRating || "-"}</td>
                    </tr>
                  ))}
                  {top5Risks.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        No risk data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Top 5 Lists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 Assets */}
          {selectedOptions.includes("top-5-assets") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-2 text-sm font-medium">#</th>
                      <th className="text-left p-2 text-sm font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Assets.map((asset, idx) => (
                      <tr key={asset.name} className="border-b border-slate-200">
                        <td className="p-2 text-sm">#{idx + 1}</td>
                        <td className="p-2 text-sm">{asset.name}</td>
                      </tr>
                    ))}
                    {top5Assets.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-slate-500">
                          No asset data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Top 5 Departments */}
          {selectedOptions.includes("top-5-departments") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Departments</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-2 text-sm font-medium">#</th>
                      <th className="text-left p-2 text-sm font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Departments.map((dept, idx) => (
                      <tr key={dept.name} className="border-b border-slate-200">
                        <td className="p-2 text-sm">#{idx + 1}</td>
                        <td className="p-2 text-sm">{dept.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Top 5 Threats */}
          {selectedOptions.includes("top-5-threats") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Threats</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-2 text-sm font-medium">#</th>
                      <th className="text-left p-2 text-sm font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Threats.map((threat, idx) => (
                      <tr key={threat.name} className="border-b border-slate-200">
                        <td className="p-2 text-sm">#{idx + 1}</td>
                        <td className="p-2 text-sm">{threat.name}</td>
                      </tr>
                    ))}
                    {top5Threats.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-slate-500">
                          No threat data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Top 5 Risk Owners */}
          {selectedOptions.includes("top-5-risk-owners") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Risk Owners</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-2 text-sm font-medium">#</th>
                      <th className="text-left p-2 text-sm font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Owners.map((owner, idx) => (
                      <tr key={owner.name} className="border-b border-slate-200">
                        <td className="p-2 text-sm">#{idx + 1}</td>
                        <td className="p-2 text-sm">{owner.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Risk Activity Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risk Activity Trend */}
          {selectedOptions.includes("risk-activity-trend") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Activity Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                      <div key={month} className="flex items-center gap-2 text-xs">
                        <div className="w-8">{month}</div>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="h-3 bg-blue-500 rounded"
                            style={{ width: `${(data.identified / maxVal) * 100}%`, minWidth: data.identified > 0 ? '4px' : '0' }}
                          />
                          <div
                            className="h-3 bg-green-500 rounded"
                            style={{ width: `${(data.assessed / maxVal) * 100}%`, minWidth: data.assessed > 0 ? '4px' : '0' }}
                          />
                          <div
                            className="h-3 bg-purple-500 rounded"
                            style={{ width: `${(data.mitigated / maxVal) * 100}%`, minWidth: data.mitigated > 0 ? '4px' : '0' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Identified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Assessed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span>Mitigated</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Activity Timeline */}
          {selectedOptions.includes("risk-activity-timeline") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Risk Activity based on Timeline</span>
                  <span className="text-sm font-normal text-slate-500">{filterYear}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                      <div key={month} className="flex items-center gap-2 text-xs">
                        <div className="w-8">{month}</div>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="h-3 bg-blue-500 rounded"
                            style={{ width: `${(data.identified / maxVal) * 100}%`, minWidth: data.identified > 0 ? '4px' : '0' }}
                          />
                          <div
                            className="h-3 bg-green-500 rounded"
                            style={{ width: `${(data.assessed / maxVal) * 100}%`, minWidth: data.assessed > 0 ? '4px' : '0' }}
                          />
                          <div
                            className="h-3 bg-purple-500 rounded"
                            style={{ width: `${(data.mitigated / maxVal) * 100}%`, minWidth: data.mitigated > 0 ? '4px' : '0' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Identified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Assessed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span>Mitigated</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RiskManagementReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ManagementReportContent />
    </Suspense>
  );
}
