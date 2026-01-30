"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Framework {
  id: string;
  name: string;
  code?: string;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
  _count?: {
    controls: number;
    requirements: number;
    evidences: number;
  };
}

interface Control {
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
  control?: {
    name: string;
  };
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
  const [controls, setControls] = useState<Control[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [governanceDocuments, setGovernanceDocuments] = useState<GovernanceDocument[]>([]);
  const [loading, setLoading] = useState(true);

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
        const [frameworksRes, controlsRes, exceptionsRes, governanceRes] = await Promise.all([
          fetch("/api/frameworks?status=Subscribed"),
          fetch("/api/controls"),
          fetch("/api/exceptions"),
          fetch("/api/governance"),
        ]);

        if (frameworksRes.ok) {
          const data = await frameworksRes.json();
          setFrameworks(data);
        }
        if (controlsRes.ok) {
          const data = await controlsRes.json();
          setControls(data.data || data);
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
    ? frameworks.filter((f) => f.id === frameworkId)
    : frameworks;

  const filteredControls = frameworkId
    ? controls.filter((c) => c.framework?.name && frameworks.find(f => f.id === frameworkId)?.name === c.framework.name)
    : controls;

  const controlExceptionsList = exceptions.filter((e) => e.type === "Control" || e.control);
  const requirementExceptionsList = exceptions.filter((e) => e.type === "Requirement" || e.requirement);

  // Group controls by framework (using all controls, not filtered)
  const controlsByFramework: Record<string, Control[]> = {};
  controls.forEach((control) => {
    const fwName = control.framework?.name || "Unassigned";
    if (!controlsByFramework[fwName]) {
      controlsByFramework[fwName] = [];
    }
    controlsByFramework[fwName].push(control);
  });

  // Calculate compliance stats per framework for the stacked bar chart
  // Uses ALL frameworks (not filtered) for Framework Compliance section
  interface FrameworkComplianceStats {
    frameworkId: string;
    frameworkName: string;
    compliantCount: number;
    partialCount: number;
    nonCompliantCount: number;
    totalControls: number;
    compliantPct: number;
    partialPct: number;
    nonCompliantPct: number;
  }

  const calculateFrameworkComplianceStats = (): FrameworkComplianceStats[] => {
    return frameworks.map((fw) => {
      // Get all controls for this framework (de-duplicated by control id)
      const fwControls = controlsByFramework[fw.name] || [];
      const uniqueControlsMap = new Map<string, Control>();
      fwControls.forEach((ctrl) => {
        if (ctrl.id && !uniqueControlsMap.has(ctrl.id)) {
          uniqueControlsMap.set(ctrl.id, ctrl);
        }
      });
      const uniqueControls = Array.from(uniqueControlsMap.values());
      const totalControls = uniqueControls.length;

      // Classify controls by status
      // Mapping: "Implemented" → Compliant, "Partially Implemented" → Partial, others → Non-Compliant
      let compliantCount = 0;
      let partialCount = 0;
      let nonCompliantCount = 0;

      uniqueControls.forEach((ctrl) => {
        const status = ctrl.status || "";
        if (status === "Implemented") {
          compliantCount++;
        } else if (status === "Partially Implemented") {
          partialCount++;
        } else {
          // "Not Implemented" or any other status
          nonCompliantCount++;
        }
      });

      // Calculate percentages (handle zero total)
      const compliantPct = totalControls > 0 ? Math.round((compliantCount / totalControls) * 100) : 0;
      const partialPct = totalControls > 0 ? Math.round((partialCount / totalControls) * 100) : 0;
      // Ensure percentages sum to 100 by calculating nonCompliantPct as remainder
      const nonCompliantPct = totalControls > 0 ? 100 - compliantPct - partialPct : 0;

      return {
        frameworkId: fw.id,
        frameworkName: fw.name,
        compliantCount,
        partialCount,
        nonCompliantCount,
        totalControls,
        compliantPct,
        partialPct,
        nonCompliantPct,
      };
    });
  };

  const frameworkComplianceStats = calculateFrameworkComplianceStats();

  // Group governance documents by framework
  const governanceByFramework: Record<string, GovernanceDocument[]> = {};
  governanceDocuments.forEach((doc) => {
    const fwName = doc.framework?.name || "Unassigned";
    if (!governanceByFramework[fwName]) {
      governanceByFramework[fwName] = [];
    }
    governanceByFramework[fwName].push(doc);
  });

  const handleDownloadReport = () => {
    // Future implementation: generate and download PDF
    alert("Download functionality will be implemented");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading report data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Report</span>
          <span className="text-gray-400">|</span>
          <span className="font-medium">Management Report</span>
        </div>
        <Button onClick={handleDownloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Report Title */}
      <h1 className="text-2xl font-bold text-center">Compliance Management Report</h1>

      {/* Overall Compliance Section */}
      {showOverallCompliance && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
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
                  <span>Compliant: {compliantPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Partial-Compliant: {partialPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Non-Compliant: {nonCompliantPercent}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Framework Compliance Section - Horizontal Stacked Bar Chart */}
      {showFrameworkCompliance && (
        <Card>
          <CardHeader>
            <CardTitle>Framework Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="flex items-center justify-end gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm">Partially Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm">Non-Compliant</span>
              </div>
            </div>

            {/* Stacked Bar Chart */}
            <div className="space-y-3">
              {frameworkComplianceStats.map((stats) => (
                <div key={stats.frameworkId} className="flex items-center gap-4">
                  {/* Framework Name (Y-axis label) */}
                  <div className="w-48 min-w-48 text-sm text-right truncate" title={stats.frameworkName}>
                    {stats.frameworkName}
                  </div>
                  {/* Stacked Bar */}
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden flex">
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
                    {/* Empty bar when no controls */}
                    {stats.totalControls === 0 && (
                      <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">No controls</span>
                      </div>
                    )}
                  </div>
                  {/* Total controls count */}
                  <div className="w-16 text-sm text-gray-500 text-right">
                    {stats.totalControls} ctrl
                  </div>
                </div>
              ))}
              {frameworkComplianceStats.length === 0 && (
                <p className="text-slate-400 text-center py-4">No frameworks found</p>
              )}
            </div>

            {/* X-axis scale indicator */}
            <div className="flex items-center gap-4 mt-4 pt-2 border-t">
              <div className="w-48 min-w-48"></div>
              <div className="flex-1 flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <div className="w-16"></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Requirements by Framework Section */}
      {showControlRequirementsByFramework && (
        <Card>
          <CardHeader>
            <CardTitle>Control Requirements by Framework</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{framework.name}</span>
                    <span>{framework._count?.requirements || 0} requirements</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${Math.min((framework._count?.requirements || 0) * 5, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">No frameworks found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Implementations by Framework Section */}
      {showControlImplementationsByFramework && (
        <Card>
          <CardHeader>
            <CardTitle>Control Implementations by Framework</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{framework.name}</span>
                    <span>{framework._count?.controls || 0} controls</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.min((framework._count?.controls || 0) * 3, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">No frameworks found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Requirements Exceptions Section */}
      {showComplianceRequirementsExceptions && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Requirements Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            {requirementExceptionsList.length > 0 ? (
              <div className="space-y-2">
                {requirementExceptionsList.map((exception) => (
                  <div key={exception.id} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span>{exception.title}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      exception.status === "Approved" ? "bg-green-100 text-green-800" :
                      exception.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {exception.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No requirement exceptions found</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Control Exceptions Section */}
      {showControlExceptions && (
        <Card>
          <CardHeader>
            <CardTitle>Control Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
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
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-full">
                    <span className="text-slate-400 text-sm">No Data</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Approved: {controlExceptionsList.filter(e => e.status === "Approved").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Pending: {controlExceptionsList.filter(e => e.status === "Pending").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Other: {controlExceptionsList.filter(e => e.status !== "Approved" && e.status !== "Pending").length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Framework along with Governance Data Section */}
      {showFrameworkWithGovernanceData && (
        <Card>
          <CardHeader>
            <CardTitle>Framework along with Governance Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {filteredFrameworks.map((framework) => (
                <div key={framework.id} className="space-y-2">
                  <h4 className="font-medium">{framework.name}</h4>
                  <div className="pl-4 space-y-1">
                    {(governanceByFramework[framework.name] || []).map((doc) => (
                      <div key={doc.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                        <span>{doc.title}</span>
                        <span className="text-slate-400">{doc.type}</span>
                      </div>
                    ))}
                    {(!governanceByFramework[framework.name] || governanceByFramework[framework.name].length === 0) && (
                      <p className="text-sm text-slate-400">No governance documents</p>
                    )}
                  </div>
                </div>
              ))}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">No frameworks found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain based Progress Compliance Section */}
      {showDomainBasedProgressCompliance && (
        <Card>
          <CardHeader>
            <CardTitle>Domain based Progress Compliance (Self-Assessment Model)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredFrameworks.map((framework) => {
                const policyProgress = framework.policyPercentage || 0;
                const evidenceProgress = framework.evidencePercentage || 0;
                const complianceProgress = framework.compliancePercentage || 0;

                return (
                  <div key={framework.id} className="space-y-3 p-4 bg-gray-50 rounded">
                    <h4 className="font-medium">{framework.name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <span className="text-sm w-32">Policy Progress</span>
                        <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${policyProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 text-right">{policyProgress}%</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm w-32">Evidence Progress</span>
                        <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${evidenceProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 text-right">{evidenceProgress}%</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm w-32">Compliance</span>
                        <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${complianceProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-12 text-right">{complianceProgress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredFrameworks.length === 0 && (
                <p className="text-slate-400 text-center py-4">No frameworks found</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Issues Section */}
      {showComplianceIssues && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Issues</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Show controls that are not implemented or have issues */}
            {filteredControls.filter(c => c.status === "Not Implemented" || c.status === "Partially Implemented").length > 0 ? (
              <div className="space-y-2">
                {filteredControls
                  .filter(c => c.status === "Not Implemented" || c.status === "Partially Implemented")
                  .map((control) => (
                    <div key={control.id} className="flex justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{control.code}</span>
                        <span className="text-slate-400 ml-2">{control.name}</span>
                      </div>
                      <span className={`text-sm px-2 py-1 rounded ${
                        control.status === "Not Implemented" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {control.status}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No compliance issues found</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ManagementReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <ManagementReportContent />
    </Suspense>
  );
}
