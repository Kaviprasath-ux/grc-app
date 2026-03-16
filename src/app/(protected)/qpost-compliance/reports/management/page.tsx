"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Download, Home, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Framework {
  id: string;
  name: string;
  code?: string;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
  _count?: {
    requirements: number;
    evidences: number;
  };
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  status: string;
  framework?: {
    name: string;
  };
}

interface Exception {
  id: string;
  title: string;
  status: string;
  type: string;
  requirement?: {
    name: string;
  };
}

interface GovernanceDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  framework?: {
    name: string;
  };
}

function ManagementReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  // Read parameters from URL
  const showOverallCompliance = searchParams.get("overallCompliance") === "true";
  const showFrameworkCompliance = searchParams.get("frameworkCompliance") === "true";
  const showControlRequirementsByFramework = searchParams.get("controlRequirementsByFramework") === "true";
  const showControlImplementationsByFramework = searchParams.get("controlImplementationsByFramework") === "true";
  const showComplianceRequirementsExceptions = searchParams.get("complianceRequirementsExceptions") === "true";
  const showControlExceptions = searchParams.get("controlExceptions") === "true";
  const showFrameworkWithGovernanceData = searchParams.get("frameworkWithGovernanceData") === "true";
  const showComplianceIssues = searchParams.get("complianceIssues") === "true";
  const showDomainBasedProgressCompliance = searchParams.get("domainBasedProgressCompliance") === "true";
  const frameworkId = searchParams.get("frameworkId");

  // Data states
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [governanceDocuments, setGovernanceDocuments] = useState<GovernanceDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'QPostFramework' });
  const { data: translatedRequirements } = useTranslatedData(requirements, { modelName: 'QPostRequirement' });
  const { data: translatedExceptions } = useTranslatedData(exceptions, { modelName: 'QPostException' });
  const { data: translatedGovernance } = useTranslatedData(governanceDocuments, { modelName: 'QPostPolicy' });

  // Calculate overall compliance stats
  const overallStats = {
    compliant: 0,
    nonCompliant: 0,
    partialCompliant: 0,
  };

  frameworks.forEach((fw) => {
    if (fw.compliancePercentage >= 80) overallStats.compliant++;
    else if (fw.compliancePercentage >= 40) overallStats.partialCompliant++;
    else overallStats.nonCompliant++;
  });

  const totalFrameworks = frameworks.length || 1;
  const compliantPercent = Math.round((overallStats.compliant / totalFrameworks) * 100);
  const partialPercent = Math.round((overallStats.partialCompliant / totalFrameworks) * 100);
  const nonCompliantPercent = Math.round((overallStats.nonCompliant / totalFrameworks) * 100);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [frameworksRes, requirementsRes, exceptionsRes, governanceRes] = await Promise.all([
          fetch("/api/qpost-compliance/frameworks?status=Subscribed"),
          fetch("/api/qpost-compliance/requirements"),
          fetch("/api/qpost-compliance/exceptions"),
          fetch("/api/qpost-compliance/governance"),
        ]);

        if (frameworksRes.ok) {
          const data = await frameworksRes.json();
          setFrameworks(data);
        }
        if (requirementsRes.ok) {
          const data = await requirementsRes.json();
          setRequirements(data.data || data);
        }
        if (exceptionsRes.ok) {
          const data = await exceptionsRes.json();
          setExceptions(data.data || data);
        }
        if (governanceRes.ok) {
          const data = await governanceRes.json();
          setGovernanceDocuments(data.data || data);
        }
      } catch (error) {
        console.error("Failed to fetch report data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter data by framework if selected
  const filteredFrameworks = frameworkId
    ? translatedFrameworks.filter((f) => f.id === frameworkId)
    : translatedFrameworks;

  const filteredRequirements = frameworkId
    ? translatedRequirements.filter((r) => r.framework?.name && frameworks.find(f => f.id === frameworkId)?.name === r.framework.name)
    : translatedRequirements;

  const controlExceptionsList = translatedExceptions.filter((e) => e.type === "Requirement" || e.requirement);
  const requirementExceptionsList = translatedExceptions.filter((e) => e.type === "Requirement" || e.requirement);

  // Group requirements by framework (using all requirements, not filtered)
  const requirementsByFramework: Record<string, Requirement[]> = {};
  translatedRequirements.forEach((requirement) => {
    const fwName = requirement.framework?.name || "Unassigned";
    if (!requirementsByFramework[fwName]) {
      requirementsByFramework[fwName] = [];
    }
    requirementsByFramework[fwName].push(requirement);
  });

  // Calculate compliance stats per framework for the stacked bar chart
  // Uses ALL frameworks (not filtered) for Framework Compliance section
  interface FrameworkComplianceStats {
    frameworkId: string;
    frameworkName: string;
    compliantCount: number;
    partialCount: number;
    nonCompliantCount: number;
    totalRequirements: number;
    compliantPct: number;
    partialPct: number;
    nonCompliantPct: number;
  }

  const calculateFrameworkComplianceStats = (): FrameworkComplianceStats[] => {
    return translatedFrameworks.map((fw) => {
      // Get all requirements for this framework (de-duplicated by requirement id)
      const fwRequirements = requirementsByFramework[fw.name] || [];
      const uniqueRequirementsMap = new Map<string, Requirement>();
      fwRequirements.forEach((req) => {
        if (req.id && !uniqueRequirementsMap.has(req.id)) {
          uniqueRequirementsMap.set(req.id, req);
        }
      });
      const uniqueRequirements = Array.from(uniqueRequirementsMap.values());
      const totalRequirements = uniqueRequirements.length;

      // Classify requirements by status
      let compliantCount = 0;
      let partialCount = 0;
      let nonCompliantCount = 0;

      uniqueRequirements.forEach((req) => {
        const status = req.status || "";
        if (status === "Compliant") {
          compliantCount++;
        } else if (status === "Partially Compliant") {
          partialCount++;
        } else {
          // "Non Compliant" or any other status
          nonCompliantCount++;
        }
      });

      // Calculate percentages (handle zero total)
      const compliantPct = totalRequirements > 0 ? Math.round((compliantCount / totalRequirements) * 100) : 0;
      const partialPct = totalRequirements > 0 ? Math.round((partialCount / totalRequirements) * 100) : 0;
      // Ensure percentages sum to 100 by calculating nonCompliantPct as remainder
      const nonCompliantPct = totalRequirements > 0 ? 100 - compliantPct - partialPct : 0;

      return {
        frameworkId: fw.id,
        frameworkName: fw.name,
        compliantCount,
        partialCount,
        nonCompliantCount,
        totalRequirements,
        compliantPct,
        partialPct,
        nonCompliantPct,
      };
    });
  };

  const frameworkComplianceStats = calculateFrameworkComplianceStats();

  // Group governance documents by framework
  const governanceByFramework: Record<string, GovernanceDocument[]> = {};
  translatedGovernance.forEach((doc) => {
    const fwName = doc.framework?.name || "Unassigned";
    if (!governanceByFramework[fwName]) {
      governanceByFramework[fwName] = [];
    }
    governanceByFramework[fwName].push(doc);
  });

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/qpost-compliance/reports/generate/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallCompliance: showOverallCompliance,
          frameworkCompliance: showFrameworkCompliance,
          controlRequirementsByFramework: showControlRequirementsByFramework,
          controlImplementationsByFramework: showControlImplementationsByFramework,
          complianceRequirementsExceptions: showComplianceRequirementsExceptions,
          controlExceptions: showControlExceptions,
          frameworkWithGovernanceData: showFrameworkWithGovernanceData,
          complianceIssues: showComplianceIssues,
          domainBasedProgressCompliance: showDomainBasedProgressCompliance,
          frameworkId: frameworkId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error || "Failed to generate report");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || "Compliance_Management_Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: t("Success"),
        description: t("Report downloaded successfully"),
      });
    } catch (error) {
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to generate report"),
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/qpost-compliance/reports" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Reports")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Management Report")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Compliance Management Report")}</h1>
        <Button onClick={handleDownloadReport} disabled={downloading} className="w-full sm:w-auto">
          {downloading ? (
            <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          )}
          {downloading ? t("Downloading...") : t("Download Report")}
        </Button>
      </div>

      {/* Overall Compliance Section */}
      {showOverallCompliance && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Overall Compliance")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              {/* Simple pie chart representation */}
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Compliant - Green */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#22c55e"
                    strokeWidth="20"
                    strokeDasharray={`${compliantPercent * 2.51} 251`}
                    strokeDashoffset="0"
                  />
                  {/* Partial Compliant - Yellow */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#eab308"
                    strokeWidth="20"
                    strokeDasharray={`${partialPercent * 2.51} 251`}
                    strokeDashoffset={`${-compliantPercent * 2.51}`}
                  />
                  {/* Non-Compliant - Red */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`${nonCompliantPercent * 2.51} 251`}
                    strokeDashoffset={`${-(compliantPercent + partialPercent) * 2.51}`}
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Compliant")}: {compliantPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Partially Compliant")}: {partialPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Non-Compliant")}: {nonCompliantPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Framework Compliance Section - Horizontal Stacked Bar Chart */}
      {showFrameworkCompliance && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Framework Compliance")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center ltr:justify-end rtl:justify-start gap-3 sm:gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">{t("Compliant")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm">{t("Partially Compliant")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm">{t("Non-Compliant")}</span>
              </div>
            </div>

            {/* Stacked Bar Chart */}
            <div className="space-y-3">
              {frameworkComplianceStats.map((stats) => (
                <div key={stats.frameworkId} className="flex items-center gap-2 sm:gap-4">
                  {/* Framework Name (Y-axis label) */}
                  <div className="w-24 sm:w-48 min-w-[6rem] sm:min-w-48 text-xs sm:text-sm ltr:text-right rtl:text-left truncate text-slate-700" title={stats.frameworkName}>
                    {stats.frameworkName}
                  </div>
                  {/* Stacked Bar */}
                  <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden flex">
                    {/* Compliant segment - Green */}
                    {stats.compliantPct > 0 && (
                      <div
                        className="h-full bg-green-500 transition-all flex items-center justify-center"
                        style={{ width: `${stats.compliantPct}%` }}
                        title={`Compliant: ${stats.compliantPct}% (${stats.compliantCount})`}
                      >
                        {stats.compliantPct >= 10 && (
                          <span className="text-xs text-white font-medium">{stats.compliantPct}%</span>
                        )}
                      </div>
                    )}
                    {/* Partially Compliant segment - Yellow */}
                    {stats.partialPct > 0 && (
                      <div
                        className="h-full bg-yellow-500 transition-all flex items-center justify-center"
                        style={{ width: `${stats.partialPct}%` }}
                        title={`Partially Compliant: ${stats.partialPct}% (${stats.partialCount})`}
                      >
                        {stats.partialPct >= 10 && (
                          <span className="text-xs text-white font-medium">{stats.partialPct}%</span>
                        )}
                      </div>
                    )}
                    {/* Non-Compliant segment - Red */}
                    {stats.nonCompliantPct > 0 && (
                      <div
                        className="h-full bg-red-500 transition-all flex items-center justify-center"
                        style={{ width: `${stats.nonCompliantPct}%` }}
                        title={`Non-Compliant: ${stats.nonCompliantPct}% (${stats.nonCompliantCount})`}
                      >
                        {stats.nonCompliantPct >= 10 && (
                          <span className="text-xs text-white font-medium">{stats.nonCompliantPct}%</span>
                        )}
                      </div>
                    )}
                    {/* Empty bar when no requirements */}
                    {stats.totalRequirements === 0 && (
                      <div className="h-full w-full bg-slate-200 flex items-center justify-center">
                        <span className="text-xs text-slate-500">{t("No Controls")}</span>
                      </div>
                    )}
                  </div>
                  {/* Total requirements count */}
                  <div className="w-12 sm:w-16 text-xs sm:text-sm text-slate-500 ltr:text-right rtl:text-left">
                    {stats.totalRequirements} {t("Controls")}
                  </div>
                </div>
              ))}
              {frameworkComplianceStats.length === 0 && (
                <p className="text-slate-400 text-center py-4">{t("No frameworks found")}</p>
              )}
            </div>

            {/* X-axis scale indicator */}
            <div className="flex items-center gap-2 sm:gap-4 mt-4 pt-2 border-t border-slate-100">
              <div className="w-24 sm:w-48 min-w-[6rem] sm:min-w-48"></div>
              <div className="flex-1 flex justify-between text-xs text-slate-400">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <div className="w-12 sm:w-16"></div>
            </div>
          </div>
        </div>
      )}

      {/* Control Requirements by Framework Section */}
      {showControlRequirementsByFramework && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Controls by Framework")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{framework.name}</span>
                    <span>{framework._count?.requirements || 0} {t("Controls")}</span>
                  </div>
                  <div className="h-6 bg-slate-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${Math.min((framework._count?.requirements || 0) * 5, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">{t("No frameworks found")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirement Implementations by Framework Section */}
      {showControlImplementationsByFramework && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Control Implementations by Framework")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{framework.name}</span>
                    <span>{framework._count?.requirements || 0} {t("Controls")}</span>
                  </div>
                  <div className="h-6 bg-slate-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.min((framework._count?.requirements || 0) * 3, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">{t("No frameworks found")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compliance Requirements Exceptions Section */}
      {showComplianceRequirementsExceptions && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Compliance Controls Exceptions")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            {requirementExceptionsList.length > 0 ? (
              <div className="space-y-2">
                {requirementExceptionsList.map((exception) => (
                  <div key={exception.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 p-2 bg-slate-50 rounded">
                    <span className="break-words">{exception.title}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      exception.status === "Approved" ? "bg-green-100 text-green-800" :
                      exception.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      {t(exception.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">{t("No control exceptions found")}</p>
            )}
          </div>
        </div>
      )}

      {/* Requirement Exceptions Section */}
      {showControlExceptions && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Control Exceptions")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              {/* Pie chart for control exceptions */}
              <div className="relative w-48 h-48">
                {controlExceptionsList.length > 0 ? (
                  <>
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#22c55e"
                        strokeWidth="20"
                        strokeDasharray={`${(controlExceptionsList.filter(e => e.status === "Approved").length / controlExceptionsList.length) * 251} 251`}
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#eab308"
                        strokeWidth="20"
                        strokeDasharray={`${(controlExceptionsList.filter(e => e.status === "Pending").length / controlExceptionsList.length) * 251} 251`}
                        strokeDashoffset={`${-(controlExceptionsList.filter(e => e.status === "Approved").length / controlExceptionsList.length) * 251}`}
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#ef4444"
                        strokeWidth="20"
                        strokeDasharray={`${(controlExceptionsList.filter(e => e.status !== "Approved" && e.status !== "Pending").length / controlExceptionsList.length) * 251} 251`}
                        strokeDashoffset={`${-((controlExceptionsList.filter(e => e.status === "Approved").length + controlExceptionsList.filter(e => e.status === "Pending").length) / controlExceptionsList.length) * 251}`}
                      />
                    </svg>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-full">
                    <span className="text-slate-400 text-sm">{t("No data")}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Approved")}: {controlExceptionsList.filter(e => e.status === "Approved").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Pending")}: {controlExceptionsList.filter(e => e.status === "Pending").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm text-slate-700">{t("Other")}: {controlExceptionsList.filter(e => e.status !== "Approved" && e.status !== "Pending").length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Framework along with Governance Data Section */}
      {showFrameworkWithGovernanceData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Framework with Governance Data")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="space-y-6">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-2">
                  <h4 className="font-medium">{framework.name}</h4>
                  <div className="ltr:pl-4 rtl:pr-4 space-y-1">
                    {(governanceByFramework[framework.name] || []).map((doc) => (
                      <div key={doc.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm p-2 bg-slate-50 rounded">
                        <span>{doc.title}</span>
                        <span className="text-slate-400">{doc.type}</span>
                      </div>
                    ))}
                    {(!governanceByFramework[framework.name] || governanceByFramework[framework.name].length === 0) && (
                      <p className="text-sm text-slate-400">{t("No governance documents")}</p>
                    )}
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">{t("No frameworks found")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Domain based Progress Compliance Section */}
      {showDomainBasedProgressCompliance && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Domain Based Progress Compliance")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => {
                const policyProgress = framework.policyPercentage || 0;
                const evidenceProgress = framework.evidencePercentage || 0;
                const complianceProgress = framework.compliancePercentage || 0;

                return (
                  <div key={framework.id} className="space-y-3 p-4 bg-slate-50 rounded">
                    <h4 className="font-medium">{framework.name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm w-24 sm:w-32 shrink-0">{t("Policy Progress")}</span>
                        <div className="flex-1 h-4 bg-slate-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${policyProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 ltr:text-right rtl:text-left">{policyProgress}%</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm w-24 sm:w-32 shrink-0">{t("Evidence Progress")}</span>
                        <div className="flex-1 h-4 bg-slate-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${evidenceProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 ltr:text-right rtl:text-left">{evidenceProgress}%</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm w-24 sm:w-32 shrink-0">{t("Compliance")}</span>
                        <div className="flex-1 h-4 bg-slate-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${complianceProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 ltr:text-right rtl:text-left">{complianceProgress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">{t("No frameworks found")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compliance Issues Section */}
      {showComplianceIssues && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Compliance Issues")}</h3>
          </div>
          <div className="px-3 sm:px-5 py-4">
            {/* Show requirements that are non-compliant or have issues */}
            {filteredRequirements.filter(r => r.status === "Non Compliant" || r.status === "Partially Compliant").length > 0 ? (
              <div className="space-y-2">
                {filteredRequirements
                  .filter(r => r.status === "Non Compliant" || r.status === "Partially Compliant")
                  .map((requirement) => (
                    <div key={requirement.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 p-2 bg-slate-50 rounded">
                      <div className="min-w-0">
                        <span className="font-medium">{requirement.code}</span>
                        <span className="text-slate-400 ltr:ml-2 rtl:mr-2 break-words">{requirement.name}</span>
                      </div>
                      <span className={`text-sm px-2 py-1 rounded ${
                        requirement.status === "Non Compliant" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {t(requirement.status)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">{t("No compliance issues found")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
    </div>
  );
}

export default function ManagementReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ManagementReportContent />
    </Suspense>
  );
}
