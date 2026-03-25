"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  X,
  ChevronRight,
  Home,
  FileBarChart,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Framework {
  id: string;
  name: string;
  code?: string;
  status: string;
}

// Report types grouped by category
const reportTypes = [
  {
    id: "compliance-summary",
    title: "Compliance Summary Report",
    description: "Overall compliance status across all frameworks",
    category: "compliance",
  },
  {
    id: "control-effectiveness",
    title: "Control Effectiveness Report",
    description: "Analysis of control implementation and effectiveness",
    category: "compliance",
  },
  {
    id: "framework-compliance",
    title: "Framework Compliance Report",
    description: "Compliance status by framework and controls",
    category: "compliance",
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment Report",
    description: "Risk register with ratings and mitigation status",
    category: "risk",
  },
  {
    id: "risk-treatment",
    title: "Risk Treatment Report",
    description: "Risk treatment plans and progress tracking",
    category: "risk",
  },
  {
    id: "risk-matrix",
    title: "Risk Matrix Report",
    description: "Visual risk matrix with heat map analysis",
    category: "risk",
  },
  {
    id: "evidence-collection",
    title: "Evidence Collection Report",
    description: "Status of evidence collection and gaps",
    category: "evidence",
  },
  {
    id: "evidence-review",
    title: "Evidence Review Report",
    description: "Evidence review status and pending items",
    category: "evidence",
  },
  {
    id: "exception-report",
    title: "Exception Report",
    description: "All active exceptions and their justifications",
    category: "governance",
  },
  {
    id: "policy-report",
    title: "Policy Compliance Report",
    description: "Policy status and compliance tracking",
    category: "governance",
  },
  {
    id: "kpi-performance",
    title: "KPI Performance Report",
    description: "Key performance indicators and trends",
    category: "kpi",
  },
  {
    id: "kpi-dashboard",
    title: "KPI Dashboard Report",
    description: "Executive KPI dashboard with metrics",
    category: "kpi",
  },
];

const categoryTabs = [
  { id: "all", label: "All" },
  { id: "compliance", label: "Compliance" },
  { id: "risk", label: "Risk" },
  { id: "evidence", label: "Evidence" },
  { id: "governance", label: "Governance" },
  { id: "kpi", label: "KPI" },
];

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isManagementReportOpen, setIsManagementReportOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState("pdf");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Management Report Parameters - matching UAT checkboxes
  const [overallCompliance, setOverallCompliance] = useState(true);
  const [frameworkCompliance, setFrameworkCompliance] = useState(true);
  const [controlRequirementsByFramework, setControlRequirementsByFramework] =
    useState(true);
  const [
    controlImplementationsByFramework,
    setControlImplementationsByFramework,
  ] = useState(true);
  const [complianceRequirementsExceptions, setComplianceRequirementsExceptions] =
    useState(true);
  const [controlExceptions, setControlExceptions] = useState(true);
  const [frameworkWithGovernanceData, setFrameworkWithGovernanceData] =
    useState(true);
  const [complianceIssues, setComplianceIssues] = useState(true);
  const [domainBasedProgressCompliance, setDomainBasedProgressCompliance] =
    useState(true);

  // Framework selection
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>("");
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'QPostFramework' });

  // Fetch frameworks on mount
  useEffect(() => {
    async function fetchFrameworks() {
      try {
        const response = await fetch("/api/qpost-compliance/frameworks?status=Subscribed");
        if (response.ok) {
          const data = await response.json();
          setFrameworks(data);
        }
      } catch (error) {
        console.error("Failed to fetch frameworks:", error);
      }
    }
    fetchFrameworks();
  }, []);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/qpost-compliance/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedReport,
          format: reportFormat,
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
      // Extract filename from Content-Disposition header or build one
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || `report.${reportFormat === "excel" ? "xlsx" : reportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setIsGenerateDialogOpen(false);
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
      setIsGenerating(false);
    }
  };

  const handleShowManagementReport = () => {
    // Build query params from selected options
    const params = new URLSearchParams();
    if (overallCompliance) params.append("overallCompliance", "true");
    if (frameworkCompliance) params.append("frameworkCompliance", "true");
    if (controlRequirementsByFramework)
      params.append("controlRequirementsByFramework", "true");
    if (controlImplementationsByFramework)
      params.append("controlImplementationsByFramework", "true");
    if (complianceRequirementsExceptions)
      params.append("complianceRequirementsExceptions", "true");
    if (controlExceptions) params.append("controlExceptions", "true");
    if (frameworkWithGovernanceData)
      params.append("frameworkWithGovernanceData", "true");
    if (complianceIssues) params.append("complianceIssues", "true");
    if (domainBasedProgressCompliance)
      params.append("domainBasedProgressCompliance", "true");
    if (selectedFrameworkId) params.append("frameworkId", selectedFrameworkId);

    setIsManagementReportOpen(false);
    router.push(`/qpost-compliance/reports/management?${params.toString()}`);
  };

  // Filter reports by category and search
  const filteredReports = reportTypes.filter((report) => {
    const matchesCategory = activeCategory === "all" || report.category === activeCategory;
    const matchesSearch = searchQuery === "" ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        {isGRCAdmin ? (
          <>
            <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
              <Home className="h-4 w-4" />
              <span>{t("GRC")}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <span className="text-slate-500">{t("Compliance")}</span>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 ">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </div>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Reports")}</h1>

      {/* Management Report - Featured Card */}
      <button
        onClick={() => setIsManagementReportOpen(true)}
        className="group w-full bg-primary-50/60 rounded-xl border border-primary-200/60 p-3 sm:p-5 flex items-center gap-3 sm:gap-4 ltr:text-left rtl:text-right transition-all hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm cursor-pointer"
      >
        <div className="p-2.5 bg-primary-100/80 rounded-lg flex-shrink-0">
          <FileBarChart className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary-900">{t("Management Report")}</h3>
          <p className="text-xs text-primary-600/70 mt-0.5">{t("Generate a comprehensive compliance report with charts across frameworks, controls, and governance")}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary-300 flex-shrink-0 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
      </button>

      {/* Reports Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar: Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-3 sm:px-5 py-3 border-b border-slate-100">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {categoryTabs.map((tab) => {
              const count = tab.id === "all"
                ? reportTypes.length
                : reportTypes.filter((r) => r.category === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    activeCategory === tab.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t(tab.label)} <span className="ltr:ml-1 rtl:mr-1 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search reports...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Report List */}
        <div className="divide-y divide-slate-100">
          {filteredReports.length > 0 ? (
            filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
                className="group w-full flex items-center justify-between px-3 sm:px-5 py-3.5 ltr:text-left rtl:text-right hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800">{t(report.title)}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t(report.description)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                <FileBarChart className="h-6 w-6 text-primary-600" />
              </div>
              <p className="text-sm font-medium text-slate-800">{t("No reports found")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("Try adjusting your search or filter")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Report Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {t("Generate Report")}
            </DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Configure and generate the")}{" "}
              {t(reportTypes.find((r) => r.id === selectedReport)?.title || "")}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Report Format")}
              </Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="pdf">{t("PDF Document")}</SelectItem>
                  <SelectItem value="excel">{t("Excel Spreadsheet")}</SelectItem>
                  <SelectItem value="csv">{t("CSV File")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <h4 className="font-medium text-slate-800 mb-2">
                {t("Report Details")}
              </h4>
              <ul className="text-sm text-slate-500 space-y-1">
                <li>
                  • {t("Report Type")}:{" "}
                  {t(reportTypes.find((r) => r.id === selectedReport)?.title || "")}
                </li>
                <li>• {t("Format")}: {reportFormat.toUpperCase()}</li>
                <li>• {t("Data Range")}: {t("All available data")}</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setIsGenerateDialogOpen(false)}
              className="border-slate-200"
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>{t("Generating...")}</>
              ) : (
                <>
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Generate & Download")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Management Report Dialog - Matching UAT "Compliance Report Parameters" */}
      <Dialog
        open={isManagementReportOpen}
        onOpenChange={setIsManagementReportOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {t("Compliance Report Parameters")}
            </DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-5">
            {/* Checkbox grid - 2 columns, 5 rows matching UAT layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {/* Row 1 */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="overallCompliance"
                  checked={overallCompliance}
                  onCheckedChange={(checked) =>
                    setOverallCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="overallCompliance"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Overall Compliance")}
                </label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="frameworkCompliance"
                  checked={frameworkCompliance}
                  onCheckedChange={(checked) =>
                    setFrameworkCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="frameworkCompliance"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Framework Compliance")}
                </label>
              </div>

              {/* Row 2 */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="controlRequirementsByFramework"
                  checked={controlRequirementsByFramework}
                  onCheckedChange={(checked) =>
                    setControlRequirementsByFramework(checked === true)
                  }
                />
                <label
                  htmlFor="controlRequirementsByFramework"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Controls by Framework")}
                </label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="controlImplementationsByFramework"
                  checked={controlImplementationsByFramework}
                  onCheckedChange={(checked) =>
                    setControlImplementationsByFramework(checked === true)
                  }
                />
                <label
                  htmlFor="controlImplementationsByFramework"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Control Implementations by Framework")}
                </label>
              </div>

              {/* Row 3 */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="complianceRequirementsExceptions"
                  checked={complianceRequirementsExceptions}
                  onCheckedChange={(checked) =>
                    setComplianceRequirementsExceptions(checked === true)
                  }
                />
                <label
                  htmlFor="complianceRequirementsExceptions"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Compliance Controls Exceptions")}
                </label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="controlExceptions"
                  checked={controlExceptions}
                  onCheckedChange={(checked) =>
                    setControlExceptions(checked === true)
                  }
                />
                <label
                  htmlFor="controlExceptions"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Control Exceptions")}
                </label>
              </div>

              {/* Row 4 */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="frameworkWithGovernanceData"
                  checked={frameworkWithGovernanceData}
                  onCheckedChange={(checked) =>
                    setFrameworkWithGovernanceData(checked === true)
                  }
                />
                <label
                  htmlFor="frameworkWithGovernanceData"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Framework along with Governance Data")}
                </label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="complianceIssues"
                  checked={complianceIssues}
                  onCheckedChange={(checked) =>
                    setComplianceIssues(checked === true)
                  }
                />
                <label
                  htmlFor="complianceIssues"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Compliance Issues")}
                </label>
              </div>

              {/* Row 5 */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="domainBasedProgressCompliance"
                  checked={domainBasedProgressCompliance}
                  onCheckedChange={(checked) =>
                    setDomainBasedProgressCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="domainBasedProgressCompliance"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t("Domain based Progress Compliance (Self-Assessment model)")}
                </label>
              </div>
              <div className="flex items-center">
                <div className="relative flex-1">
                  <Select
                    value={selectedFrameworkId}
                    onValueChange={setSelectedFrameworkId}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200 pr-8">
                      <SelectValue placeholder={t("Framework")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {translatedFrameworks.map((framework) => (
                        <SelectItem key={framework.id} value={framework.id}>
                          {framework.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFrameworkId && (
                    <button
                      type="button"
                      onClick={() => setSelectedFrameworkId("")}
                      className="absolute ltr:right-8 rtl:left-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setIsManagementReportOpen(false)}
              className="border-slate-200"
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleShowManagementReport}>{t("Show Report")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
