"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Trash2, Upload } from "lucide-react";
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

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<KPIRecord | null>(null);

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

  // Generate chart data based on KPI records
  const generateChartData = () => {
    const chartData = months.map((month, index) => {
      const record = kpiRecords.find((r) => {
        const recordDate = new Date(r.reviewDate);
        return recordDate.getMonth() === index && recordDate.getFullYear().toString() === selectedYear;
      });
      return {
        month,
        achievedValue: record?.achievedValue || null,
        expectedValue: kpiConfig.expectedValue || 0,
      };
    });
    return chartData;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/process-kpi/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: kpiConfig }),
      });

      if (res.ok) {
        toast({
          title: "Saved",
          description: "KPI configuration has been saved",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save KPI configuration",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast({
        title: "Error",
        description: "Failed to save KPI configuration",
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
          title: "Deleted",
          description: "KPI record has been deleted",
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
      header: "Review Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("reviewDate"));
        return date.toLocaleDateString("en-GB");
      },
    },
    {
      accessorKey: "achievedValue",
      header: "Achieved Value",
      cell: ({ row }) => row.getValue("achievedValue"),
    },
    {
      accessorKey: "status",
      header: "Status",
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
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "document",
      header: "Document",
      cell: ({ row }) => {
        const doc = row.original.document;
        return doc ? (
          <a href={doc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View
          </a>
        ) : (
          "-"
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingRecord(row.original);
              setIsEditDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
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
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">KPI</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-blue-600 font-medium">{process?.name}</span>
      </div>

      {/* Main Content Card */}
      <Card className="bg-[#f8fafc]">
        <CardContent className="pt-6">
          {/* KPI Header with Year Selector */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f]">KPI</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Year</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
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
                  name="Achieved Value"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="expectedValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Expected Value"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-end gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-500" />
              <span className="text-sm">Achieved Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-amber-500" />
              <span className="text-sm">Expected Value</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Configuration Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium mb-2">KPI Objective</h5>
                <Input
                  placeholder="Enter Objective"
                  value={kpiConfig.objective}
                  onChange={(e) =>
                    setKpiConfig({ ...kpiConfig, objective: e.target.value })
                  }
                />
              </div>
              <div>
                <h5 className="text-sm font-medium mb-2">KPI Data Source</h5>
                <Input
                  placeholder="Enter Data Source"
                  value={kpiConfig.dataSource}
                  onChange={(e) =>
                    setKpiConfig({ ...kpiConfig, dataSource: e.target.value })
                  }
                />
              </div>
              <div>
                <h5 className="text-sm font-medium mb-2">Expected Value</h5>
                <Input
                  type="number"
                  value={kpiConfig.expectedValue}
                  onChange={(e) =>
                    setKpiConfig({
                      ...kpiConfig,
                      expectedValue: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium mb-2">KPI Description</h5>
                <Input
                  placeholder="Enter Description"
                  value={kpiConfig.description}
                  onChange={(e) =>
                    setKpiConfig({ ...kpiConfig, description: e.target.value })
                  }
                />
              </div>
              <div>
                <h5 className="text-sm font-medium mb-2">KPI Measurement Formula</h5>
                <Input
                  placeholder="Enter the KPI Calculation Formula"
                  value={kpiConfig.formula}
                  onChange={(e) =>
                    setKpiConfig({ ...kpiConfig, formula: e.target.value })
                  }
                />
              </div>
              <div>
                <h5 className="text-sm font-medium mb-2">Targeted Achieved Value</h5>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={kpiConfig.targetedAchievedValue}
                    onChange={(e) =>
                      setKpiConfig({
                        ...kpiConfig,
                        targetedAchievedValue: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <Button variant="outline" size="sm">
                    Edit Assignee
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Records Table */}
      <Card>
        <CardContent className="pt-6">
          {kpiRecords.length > 0 ? (
            <DataGrid
              columns={recordColumns}
              data={kpiRecords}
              searchPlaceholder="Search records..."
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No KPI records yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit KPI Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Achieved Value</label>
              <Input
                type="number"
                value={editingRecord?.achievedValue || 0}
                onChange={(e) =>
                  setEditingRecord(
                    editingRecord
                      ? { ...editingRecord, achievedValue: parseInt(e.target.value) || 0 }
                      : null
                  )
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editingRecord?.status || ""}
                onValueChange={(value) =>
                  setEditingRecord(
                    editingRecord ? { ...editingRecord, status: value } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Achieved">Achieved</SelectItem>
                  <SelectItem value="Missed">Missed</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
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
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
