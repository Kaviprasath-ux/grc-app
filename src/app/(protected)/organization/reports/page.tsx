"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Building2, Users, GitBranch, AlertCircle, BarChart3, PieChart } from "lucide-react";
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

// Report types as seen in testing
const reportTypes = [
  {
    id: "issue-by-department",
    title: "Issue by Department",
    description: "View issues categorized by department",
    icon: Building2,
    category: "issues",
  },
  {
    id: "issue-by-category",
    title: "Issue Count by Category",
    description: "Breakdown of issues by category",
    icon: AlertCircle,
    category: "issues",
  },
  {
    id: "issue-by-stakeholder",
    title: "Issue Count By StakeHolders",
    description: "Issues associated with stakeholders",
    icon: Users,
    category: "issues",
  },
  {
    id: "users-by-department",
    title: "Users By Department",
    description: "User distribution across departments",
    icon: Building2,
    category: "users",
  },
  {
    id: "users-by-roles",
    title: "Users By Roles",
    description: "User distribution by role type",
    icon: Users,
    category: "users",
  },
  {
    id: "process-by-department",
    title: "Process By Department",
    description: "Processes categorized by department",
    icon: GitBranch,
    category: "processes",
  },
  {
    id: "process-by-owners",
    title: "Process By Owners",
    description: "Processes grouped by process owners",
    icon: Users,
    category: "processes",
  },
];

export default function ReportsPage() {
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
      alert(`Report "${reportTypes.find(r => r.id === selectedReport)?.title}" generated successfully!`);
    }, 1500);
  };

  const handleManagementReport = () => {
    setIsGenerating(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      setIsManagementReportOpen(false);
      alert("Management Report generated successfully!");
    }, 2000);
  };

  // Group reports by category
  const issueReports = reportTypes.filter(r => r.category === "issues");
  const userReports = reportTypes.filter(r => r.category === "users");
  const processReports = reportTypes.filter(r => r.category === "processes");

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

      {/* Issue Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Issue Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {issueReports.map((report) => {
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
                  <div className="p-3 bg-red-50 rounded-lg">
                    <Icon className="h-6 w-6 text-red-600" />
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

      {/* User Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">User Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userReports.map((report) => {
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

      {/* Process Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Process Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processReports.map((report) => {
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

      {/* Generate Report Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Configure and generate the {reportTypes.find(r => r.id === selectedReport)?.title} report
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
              Generate a comprehensive management report with key metrics and insights
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
                <li>• Issue Statistics & Trends</li>
                <li>• User Activity Overview</li>
                <li>• Process Performance Metrics</li>
                <li>• Department-wise Analysis</li>
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
