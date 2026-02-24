"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedRecord } from "@/hooks/useTranslatedData";
import { isValidName, isValidNumber } from "@/lib/validations";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Process {
  id: string;
  processCode: string;
  name: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
}

interface KPIRecord {
  id: string;
  reviewDate: string;
  achievedValue: number;
  status: string;
  document?: string;
}

interface KPIConfig {
  objective: string;
  dataSource: string;
  expectedValue: number;
  description: string;
  formula: string;
  targetedAchievedValue: number;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const years = ["2029", "2028", "2027", "2026", "2025", "2024", "2023"];

export default function KPIDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const processId = params.processId as string;

  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2026");

  // KPI Configuration
  const [kpiConfig, setKpiConfig] = useState<KPIConfig>({
    objective: "",
    dataSource: "",
    expectedValue: 0,
    description: "",
    formula: "",
    targetedAchievedValue: 0,
  });

  // KPI Records (history)
  const [kpiRecords, setKpiRecords] = useState<KPIRecord[]>([]);

  // KPI form validation errors
  const [kpiErrors, setKpiErrors] = useState<Record<string, string>>({});

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<KPIRecord | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Dynamic translation for the process name in breadcrumb/title
  const { data: translatedProcess } = useTranslatedRecord(process, { modelName: 'Process' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch process details
      const processRes = await fetch(`/api/processes/${processId}`);
      if (processRes.ok) {
        const processData = await processRes.json();
        setProcess(processData);
      }

      // Fetch KPI config and records
      const kpiRes = await fetch(`/api/process-kpi/${processId}`);
      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        if (kpiData.config) {
          setKpiConfig(kpiData.config);
        }
        if (kpiData.records) {
          setKpiRecords(kpiData.records);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  }, [processId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if KPI configuration has been set up
  const hasKpiConfig = kpiConfig.objective.trim() !== "" ||
                       kpiConfig.dataSource.trim() !== "" ||
                       kpiConfig.expectedValue > 0 ||
                       kpiConfig.description.trim() !== "" ||
                       kpiConfig.formula.trim() !== "";

  // Generate chart data based on KPI records
  const generateChartData = () => {
    // Only generate data if there's KPI config or records
    if (!hasKpiConfig && kpiRecords.length === 0) {
      return [];
    }

    const chartData = months.map((month, index) => {
      const record = kpiRecords.find((r) => {
        const recordDate = new Date(r.reviewDate);
        return recordDate.getMonth() === index && recordDate.getFullYear().toString() === selectedYear;
      });
      return {
        month: t(month),
        achievedValue: record?.achievedValue ?? null,
        expectedValue: hasKpiConfig ? kpiConfig.expectedValue : null,
      };
    });
    return chartData;
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!kpiConfig.objective.trim()) errors.objective = t("Please Enter Objective.");
    else if (!isValidName(kpiConfig.objective.trim())) errors.objective = t("Only letters, spaces, and hyphens are allowed");
    if (!kpiConfig.dataSource.trim()) errors.dataSource = t("Please Enter Data Source.");
    else if (!isValidName(kpiConfig.dataSource.trim())) errors.dataSource = t("Only letters, spaces, and hyphens are allowed");
    if (!kpiConfig.expectedValue) errors.expectedValue = t("Please Enter the Expected Score.");
    else if (!isValidNumber(kpiConfig.expectedValue)) errors.expectedValue = t("Please enter a valid number");
    if (!kpiConfig.description.trim()) errors.description = t("Please Enter Description.");
    if (!kpiConfig.formula.trim()) errors.formula = t("Please Enter the Calculated Formula.");
    if (kpiConfig.targetedAchievedValue && !isValidNumber(kpiConfig.targetedAchievedValue)) errors.targetedAchievedValue = t("Please enter a valid number");
    if (Object.keys(errors).length > 0) {
      setKpiErrors(errors);
      return;
    }
    setKpiErrors({});
    setSaving(true);
    try {
      const res = await fetch(`/api/process-kpi/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: kpiConfig }),
      });

      if (res.ok) {
        toast({
          title: t("Saved"),
          description: t("KPI configuration has been saved"),
        });
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to save KPI configuration"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast({
        title: t("Error"),
        description: t("Failed to save KPI configuration"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const res = await fetch(`/api/process-kpi/${processId}/records/${recordId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKpiRecords(kpiRecords.filter((r) => r.id !== recordId));
        toast({
          title: t("Deleted"),
          description: t("KPI record has been deleted"),
        });
      }
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Table columns for KPI records
  const recordColumns: ColumnDef<KPIRecord>[] = [
    {
      accessorKey: "reviewDate",
      header: t("Review Date"),
      cell: ({ row }) => {
        const date = new Date(row.getValue("reviewDate"));
        return date.toLocaleDateString("en-GB");
      },
    },
    {
      accessorKey: "achievedValue",
      header: t("Achieved Value"),
      cell: ({ row }) => row.getValue("achievedValue"),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={
              status === "Achieved"
                ? "default"
                : status === "Missed"
                ? "destructive"
                : "secondary"
            }
          >
            {t(status)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "document",
      header: t("Document"),
      cell: ({ row }) => {
        const doc = row.original.document;
        return doc ? (
          <a href={doc} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
            {t("View")}
          </a>
        ) : (
          "-"
        );
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className={`flex gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setEditingRecord(row.original);
              setEditErrors({});
              setIsEditDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => handleDeleteRecord(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className={`flex items-center gap-1.5 text-sm mb-6 overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
          <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Home className="h-4 w-4" />
            <span>{t("Organization")}</span>
          </div>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
          <Link href="/organization/process" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Process")}
          </Link>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-primary-700 font-medium">{t("KPI")}</span>
        </nav>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-sm mb-6 overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/organization/process" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Process")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("KPI")}</span>
      </nav>

      {/* Page Header with Back Button */}
      <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-600 hover:text-slate-800"
          onClick={() => router.push("/organization/process")}
        >
          <ChevronLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
        </Button>
        <h1 className={`text-xl sm:text-2xl font-bold text-slate-800 ${isRTL ? "text-right" : ""}`}>{t("KPI Details")} - {translatedProcess?.name || process?.name}</h1>
      </div>

      {/* Main Content Card */}
      <Card className="bg-slate-50">
        <CardContent className="p-3 sm:p-6 pt-4 sm:pt-6" style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* KPI Header with Year Selector */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
            <h3 className={`text-lg font-semibold text-slate-800 ${isRTL ? "text-right" : ""}`}>{t("KPI")}</h3>
            <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="text-sm text-muted-foreground">{t("Year")}</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear("2026")}
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Line Chart */}
          <div className="h-[300px] mb-6">
            {generateChartData().length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t("No KPI data available. Configure KPI details below to see the performance chart.")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generateChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="achievedValue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    name={t("Achieved Value")}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expectedValue"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name={t("Expected Value")}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className={`flex gap-6 mb-6 ${isRTL ? "justify-start flex-row-reverse" : "justify-end"}`}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-primary-500" />
              <span className="text-sm">{t("Achieved Value")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-amber-500" />
              <span className="text-sm">{t("Expected Value")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Configuration Form */}
      <Card style={isRTL ? { direction: 'rtl' } : undefined}>
        <CardHeader>
          <CardTitle className={`text-base font-semibold text-slate-800 ${isRTL ? "text-right" : ""}`}>{t("KPI Configuration")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("KPI Objective")}</h5>
                <Input
                  placeholder={t("Enter Objective")}
                  value={kpiConfig.objective}
                  onChange={(e) => {
                    setKpiConfig({ ...kpiConfig, objective: e.target.value });
                    if (kpiErrors.objective) setKpiErrors((prev) => { const { objective, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.objective ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.objective && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.objective}</p>
                  </div>
                )}
              </div>
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("KPI Data Source")}</h5>
                <Input
                  placeholder={t("Enter Data Source")}
                  value={kpiConfig.dataSource}
                  onChange={(e) => {
                    setKpiConfig({ ...kpiConfig, dataSource: e.target.value });
                    if (kpiErrors.dataSource) setKpiErrors((prev) => { const { dataSource, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.dataSource ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.dataSource && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.dataSource}</p>
                  </div>
                )}
              </div>
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("Expected Value")}</h5>
                <Input
                  type="number"
                  value={kpiConfig.expectedValue}
                  onChange={(e) => {
                    setKpiConfig({ ...kpiConfig, expectedValue: parseInt(e.target.value) || 0 });
                    if (kpiErrors.expectedValue) setKpiErrors((prev) => { const { expectedValue, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.expectedValue ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.expectedValue && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.expectedValue}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("KPI Description")}</h5>
                <Input
                  placeholder={t("Enter Description")}
                  value={kpiConfig.description}
                  onChange={(e) => {
                    setKpiConfig({ ...kpiConfig, description: e.target.value });
                    if (kpiErrors.description) setKpiErrors((prev) => { const { description, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.description ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.description && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.description}</p>
                  </div>
                )}
              </div>
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("KPI Measurement Formula")}</h5>
                <Input
                  placeholder={t("Enter the KPI Calculation Formula")}
                  value={kpiConfig.formula}
                  onChange={(e) => {
                    setKpiConfig({ ...kpiConfig, formula: e.target.value });
                    if (kpiErrors.formula) setKpiErrors((prev) => { const { formula, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.formula ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.formula && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.formula}</p>
                  </div>
                )}
              </div>
              <div>
                <h5 className={`text-sm font-medium mb-2 ${isRTL ? "text-right" : ""}`}>{t("Targeted Achieved Value")}</h5>
                <Input
                  type="number"
                  value={kpiConfig.targetedAchievedValue}
                  onChange={(e) => {
                    setKpiConfig({
                      ...kpiConfig,
                      targetedAchievedValue: parseInt(e.target.value) || 0,
                    });
                    if (kpiErrors.targetedAchievedValue) setKpiErrors((prev) => { const { targetedAchievedValue, ...rest } = prev; return rest; });
                  }}
                  className={kpiErrors.targetedAchievedValue ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {kpiErrors.targetedAchievedValue && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{kpiErrors.targetedAchievedValue}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`flex mt-6 ${isRTL ? "justify-start" : "justify-end"}`}>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Records Table */}
      <Card>
        <CardContent className="pt-6" style={isRTL ? { direction: 'rtl' } : undefined}>
          {kpiRecords.length > 0 ? (
            <DataGrid
              columns={recordColumns}
              data={kpiRecords}
              searchPlaceholder={t("Search records...")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">{t("No KPI records yet")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent style={isRTL ? { direction: 'rtl' } : undefined}>
          <DialogHeader>
            <DialogTitle>{t("Edit KPI Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t("Achieved Value")}</label>
              <Input
                type="number"
                value={editingRecord?.achievedValue || 0}
                onChange={(e) => {
                  setEditingRecord(
                    editingRecord
                      ? { ...editingRecord, achievedValue: parseInt(e.target.value) || 0 }
                      : null
                  );
                  if (editErrors.achievedValue) setEditErrors((prev) => { const { achievedValue, ...rest } = prev; return rest; });
                }}
                className={editErrors.achievedValue ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {editErrors.achievedValue && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{editErrors.achievedValue}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{t("Status")}</label>
              <Select
                value={editingRecord?.status || ""}
                onValueChange={(value) =>
                  setEditingRecord(
                    editingRecord ? { ...editingRecord, status: value } : null
                  )
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Achieved">{t("Achieved")}</SelectItem>
                  <SelectItem value="Missed">{t("Missed")}</SelectItem>
                  <SelectItem value="Scheduled">{t("Scheduled")}</SelectItem>
                  <SelectItem value="Overdue">{t("Overdue")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => {
                // Validate edited record
                const newErrors: Record<string, string> = {};
                if (editingRecord) {
                  if (!isValidNumber(editingRecord.achievedValue)) {
                    newErrors.achievedValue = t("Please enter a valid number");
                  }
                }
                if (Object.keys(newErrors).length > 0) {
                  setEditErrors(newErrors);
                  return;
                }
                setEditErrors({});
                // Save edited record
                if (editingRecord) {
                  setKpiRecords(
                    kpiRecords.map((r) =>
                      r.id === editingRecord.id ? editingRecord : r
                    )
                  );
                }
                setIsEditDialogOpen(false);
              }}
            >
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
