"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  FileWarning,
  BarChart3,
  ClipboardList,
  Scale,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
    icon: BarChart3,
    category: "compliance",
  },
  {
    id: "control-effectiveness",
    title: "Control Effectiveness Report",
    description: "Analysis of control implementation and effectiveness",
    icon: Shield,
    category: "compliance",
  },
  {
    id: "framework-compliance",
    title: "Framework Compliance Report",
    description: "Compliance status by framework and requirements",
    icon: ClipboardList,
    category: "compliance",
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment Report",
    description: "Risk register with ratings and mitigation status",
    icon: AlertTriangle,
    category: "risk",
  },
  {
    id: "risk-treatment",
    title: "Risk Treatment Report",
    description: "Risk treatment plans and progress tracking",
    icon: Scale,
    category: "risk",
  },
  {
    id: "risk-matrix",
    title: "Risk Matrix Report",
    description: "Visual risk matrix with heat map analysis",
    icon: BarChart3,
    category: "risk",
  },
  {
    id: "evidence-collection",
    title: "Evidence Collection Report",
    description: "Status of evidence collection and gaps",
    icon: FileText,
    category: "evidence",
  },
  {
    id: "evidence-review",
    title: "Evidence Review Report",
    description: "Evidence review status and pending items",
    icon: CheckCircle,
    category: "evidence",
  },
  {
    id: "exception-report",
    title: "Exception Report",
    description: "All active exceptions and their justifications",
    icon: FileWarning,
    category: "governance",
  },
  {
    id: "policy-report",
    title: "Policy Compliance Report",
    description: "Policy status and compliance tracking",
    icon: FileText,
    category: "governance",
  },
  {
    id: "kpi-performance",
    title: "KPI Performance Report",
    description: "Key performance indicators and trends",
    icon: TrendingUp,
    category: "kpi",
  },
  {
    id: "kpi-dashboard",
    title: "KPI Dashboard Report",
    description: "Executive KPI dashboard with metrics",
    icon: BarChart3,
    category: "kpi",
  },
];

// Category colors using design system
const categoryColors: Record<string, { bg: string; icon: string }> = {
  compliance: { bg: "bg-info-light", icon: "text-info-dark" },
  risk: { bg: "bg-warning-light", icon: "text-warning-dark" },
  evidence: { bg: "bg-success-light", icon: "text-success-dark" },
  governance: { bg: "bg-primary-100", icon: "text-primary-700" },
  kpi: { bg: "bg-info-light", icon: "text-info-dark" },
};

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isManagementReportOpen, setIsManagementReportOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState("pdf");
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Fetch frameworks on mount
  useEffect(() => {
    async function fetchFrameworks() {
      try {
        const response = await fetch("/api/frameworks?status=Subscribed");
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

  const handleGenerateReport = () => {
    setIsGenerating(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      setIsGenerateDialogOpen(false);
      toast({
        title: "Success",
        description: `Report "${reportTypes.find((r) => r.id === selectedReport)?.title}" generated successfully!`,
      });
    }, 1500);
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
    router.push(`/compliance/reports/management?${params.toString()}`);
  };

  // Group reports by category
  const complianceReports = reportTypes.filter(
    (r) => r.category === "compliance"
  );
  const riskReports = reportTypes.filter((r) => r.category === "risk");
  const evidenceReports = reportTypes.filter((r) => r.category === "evidence");
  const governanceReports = reportTypes.filter(
    (r) => r.category === "governance"
  );
  const kpiReports = reportTypes.filter((r) => r.category === "kpi");

  // Render report card
  const renderReportCard = (
    report: (typeof reportTypes)[0],
    category: string
  ) => {
    const Icon = report.icon;
    const colors = categoryColors[category];
    return (
      <div
        key={report.id}
        className="bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
        onClick={() => {
          setSelectedReport(report.id);
          setIsGenerateDialogOpen(true);
        }}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${colors.bg}`}>
            <Icon className={`h-6 w-6 ${colors.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-800">
              {report.title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{report.description}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button variant="outline" size="sm" className="w-full">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <Button size="sm" onClick={() => setIsManagementReportOpen(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Get Management Report
        </Button>
      </div>

      {/* Compliance Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Compliance Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {complianceReports.map((report) =>
            renderReportCard(report, "compliance")
          )}
        </div>
      </div>

      {/* Risk Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Risk Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riskReports.map((report) => renderReportCard(report, "risk"))}
        </div>
      </div>

      {/* Evidence Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Evidence Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidenceReports.map((report) =>
            renderReportCard(report, "evidence")
          )}
        </div>
      </div>

      {/* Governance Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Governance Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {governanceReports.map((report) =>
            renderReportCard(report, "governance")
          )}
        </div>
      </div>

      {/* KPI Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">KPI Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiReports.map((report) => renderReportCard(report, "kpi"))}
        </div>
      </div>

      {/* Generate Report Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Generate Report
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Configure and generate the{" "}
                {reportTypes.find((r) => r.id === selectedReport)?.title}
              </p>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Report Format
                </Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-800 mb-2">
                  Report Details
                </h4>
                <ul className="text-sm text-slate-500 space-y-1">
                  <li>
                    • Report Type:{" "}
                    {reportTypes.find((r) => r.id === selectedReport)?.title}
                  </li>
                  <li>• Format: {reportFormat.toUpperCase()}</li>
                  <li>• Data Range: All available data</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsGenerateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>Generating...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Compliance Report Parameters
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {/* Checkbox grid - 2 columns, 5 rows matching UAT layout */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Row 1 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overallCompliance"
                  checked={overallCompliance}
                  onCheckedChange={(checked) =>
                    setOverallCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="overallCompliance"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Overall Compliance
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="frameworkCompliance"
                  checked={frameworkCompliance}
                  onCheckedChange={(checked) =>
                    setFrameworkCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="frameworkCompliance"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Framework Compliance
                </label>
              </div>

              {/* Row 2 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="controlRequirementsByFramework"
                  checked={controlRequirementsByFramework}
                  onCheckedChange={(checked) =>
                    setControlRequirementsByFramework(checked === true)
                  }
                />
                <label
                  htmlFor="controlRequirementsByFramework"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Control Requirements by Framework
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="controlImplementationsByFramework"
                  checked={controlImplementationsByFramework}
                  onCheckedChange={(checked) =>
                    setControlImplementationsByFramework(checked === true)
                  }
                />
                <label
                  htmlFor="controlImplementationsByFramework"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Control Implementations by Framework
                </label>
              </div>

              {/* Row 3 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="complianceRequirementsExceptions"
                  checked={complianceRequirementsExceptions}
                  onCheckedChange={(checked) =>
                    setComplianceRequirementsExceptions(checked === true)
                  }
                />
                <label
                  htmlFor="complianceRequirementsExceptions"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Compliance Requirements Exceptions
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="controlExceptions"
                  checked={controlExceptions}
                  onCheckedChange={(checked) =>
                    setControlExceptions(checked === true)
                  }
                />
                <label
                  htmlFor="controlExceptions"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Control Exceptions
                </label>
              </div>

              {/* Row 4 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="frameworkWithGovernanceData"
                  checked={frameworkWithGovernanceData}
                  onCheckedChange={(checked) =>
                    setFrameworkWithGovernanceData(checked === true)
                  }
                />
                <label
                  htmlFor="frameworkWithGovernanceData"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Framework along with Governance Data
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="complianceIssues"
                  checked={complianceIssues}
                  onCheckedChange={(checked) =>
                    setComplianceIssues(checked === true)
                  }
                />
                <label
                  htmlFor="complianceIssues"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Compliance Issues
                </label>
              </div>

              {/* Row 5 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domainBasedProgressCompliance"
                  checked={domainBasedProgressCompliance}
                  onCheckedChange={(checked) =>
                    setDomainBasedProgressCompliance(checked === true)
                  }
                />
                <label
                  htmlFor="domainBasedProgressCompliance"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Domain based Progress Compliance (Self-Assessment model)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Select
                    value={selectedFrameworkId}
                    onValueChange={setSelectedFrameworkId}
                  >
                    <SelectTrigger className="w-full bg-white pr-8">
                      <SelectValue placeholder="Framework" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {frameworks.map((framework) => (
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
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsManagementReportOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleShowManagementReport}>Show Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
