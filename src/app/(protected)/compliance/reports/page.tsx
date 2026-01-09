"use client";

import { useState } from "react";
import { FileText, Download, Shield, AlertTriangle, CheckCircle, TrendingUp, FileWarning, BarChart3, ClipboardList, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

export default function ReportsPage() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isManagementReportOpen, setIsManagementReportOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState("pdf");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      setIsGenerateDialogOpen(false);
      toast({ title: "Success", description: `Report "${reportTypes.find(r => r.id === selectedReport)?.title}" generated successfully!` });
    }, 1500);
  };

  const handleManagementReport = () => {
    setIsGenerating(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      setIsManagementReportOpen(false);
      toast({ title: "Success", description: "Compliance Management Report generated successfully!" });
    }, 2000);
  };

  // Group reports by category
  const complianceReports = reportTypes.filter(r => r.category === "compliance");
  const riskReports = reportTypes.filter(r => r.category === "risk");
  const evidenceReports = reportTypes.filter(r => r.category === "evidence");
  const governanceReports = reportTypes.filter(r => r.category === "governance");
  const kpiReports = reportTypes.filter(r => r.category === "kpi");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        actions={[
          {
            label: "Get Management Report",
            icon: FileText,
            onClick: () => setIsManagementReportOpen(true),
          },
        ]}
      />

      {/* Compliance Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Compliance Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {complianceReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Risk Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Risk Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riskReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <Icon className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Evidence Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Evidence Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidenceReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Icon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Governance Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Governance Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {governanceReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Icon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* KPI Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">KPI Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                onClick={() => {
                  setSelectedReport(report.id);
                  setIsGenerateDialogOpen(true);
                }}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 bg-teal-50 rounded-lg">
                    <Icon className="h-6 w-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Generate Report Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Configure and generate the {reportTypes.find(r => r.id === selectedReport)?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Format</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                  <SelectItem value="csv">CSV File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Report Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Report Type: {reportTypes.find(r => r.id === selectedReport)?.title}</li>
                <li>• Format: {reportFormat.toUpperCase()}</li>
                <li>• Data Range: All available data</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Management Report Dialog */}
      <Dialog open={isManagementReportOpen} onOpenChange={setIsManagementReportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Management Report</DialogTitle>
            <DialogDescription>
              Generate a comprehensive compliance management report with key metrics and insights
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Format</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Report Contents</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Executive Summary</li>
                <li>• Framework Compliance Status</li>
                <li>• Control Implementation Progress</li>
                <li>• Risk Assessment Overview</li>
                <li>• Evidence Collection Status</li>
                <li>• KPI Performance Metrics</li>
                <li>• Exception Summary</li>
                <li>• Recommendations</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagementReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManagementReport} disabled={isGenerating}>
              {isGenerating ? (
                <>Generating Report...</>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
