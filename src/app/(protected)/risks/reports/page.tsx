"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FileText,
  FileSpreadsheet,
  Download,
  BarChart3,
  Grid3X3,
  TrendingUp,
  ClipboardList,
  PieChart,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const reportTypes: ReportType[] = [
  {
    id: "risk-register",
    name: "Risk Register Report",
    description: "Complete list of all risks with details including category, rating, status, and ownership",
    icon: <ClipboardList className="h-6 w-6" />,
  },
  {
    id: "assessment-summary",
    name: "Risk Assessment Summary",
    description: "Summary of all risk assessments with likelihood, impact, and rating analysis",
    icon: <BarChart3 className="h-6 w-6" />,
  },
  {
    id: "heat-map",
    name: "Risk Heat Map Report",
    description: "Visual representation of risks on a 5x5 likelihood-impact matrix",
    icon: <Grid3X3 className="h-6 w-6" />,
  },
  {
    id: "treatment-progress",
    name: "Treatment Progress Report",
    description: "Status of risk treatment plans and response actions",
    icon: <TrendingUp className="h-6 w-6" />,
  },
  {
    id: "category-analysis",
    name: "Category Analysis Report",
    description: "Risk distribution and analysis by category",
    icon: <PieChart className="h-6 w-6" />,
  },
  {
    id: "trend-analysis",
    name: "Trend Analysis Report",
    description: "Historical trend of risk counts and ratings over time",
    icon: <Calendar className="h-6 w-6" />,
  },
];

export default function RiskReportsPage() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!selectedReport) return;

    setGenerating(true);
    try {
      // In a real implementation, this would call an API to generate the report
      // For now, we'll simulate the generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create a simple CSV export for demonstration
      const response = await fetch("/api/risks");
      if (response.ok) {
        const data = await response.json();
        const risks = data.data || [];

        if (exportFormat === "csv") {
          const headers = ["Risk ID", "Name", "Category", "Rating", "Status", "Owner"];
          const rows = risks.map((risk: {
            riskId: string;
            name: string;
            category?: { name: string } | null;
            riskRating: string;
            status: string;
            owner?: { fullName: string } | null;
          }) => [
            risk.riskId,
            risk.name,
            risk.category?.name || "",
            risk.riskRating,
            risk.status,
            risk.owner?.fullName || "",
          ]);

          const csvContent = [headers, ...rows]
            .map((row) => row.map((cell: string) => `"${cell}"`).join(","))
            .join("\n");

          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${selectedReport}-${new Date().toISOString().split("T")[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // For PDF/Excel, show a message that it would normally generate the file
          toast({
            title: "Info",
            description: `Report "${reportTypes.find((r) => r.id === selectedReport)?.name}" would be generated as ${exportFormat.toUpperCase()}. In production, this would use jsPDF or ExcelJS.`,
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Reports"
        description="Generate and export risk management reports"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Report Type</CardTitle>
              <CardDescription>Choose the type of report you want to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportTypes.map((report) => (
                  <div
                    key={report.id}
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedReport === report.id
                        ? "border-grc-primary bg-grc-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setSelectedReport(report.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          selectedReport === report.id
                            ? "bg-grc-primary text-white"
                            : "bg-grc-bg text-grc-text"
                        )}
                      >
                        {report.icon}
                      </div>
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Options */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Report Options</CardTitle>
              <CardDescription>Configure report parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Export Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Range (Optional)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, from: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, to: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleGenerateReport}
                disabled={!selectedReport || generating}
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-grc-bg rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Risk Register - Dec 2024</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 bg-grc-bg rounded">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Assessment Summary - Q4</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 bg-grc-bg rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Heat Map - Nov 2024</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Report history is stored for 90 days
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
