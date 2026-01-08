"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown, Download, Upload, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string | null;
  status: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  ownerId: string | null;
  owner: { id: string; fullName: string } | null;
  processFrequency: string | null;
  natureOfImplementation: string | null;
  riskRating: string | null;
  assetDependency: boolean;
  externalDependency: boolean;
  location: string | null;
  kpiMeasurementRequired: boolean;
  piiCapture: boolean;
  operationalComplexity: string | null;
  lastAuditDate: string | null;
  responsibleId: string | null;
  accountableId: string | null;
  consultedId: string | null;
  informedId: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

const PROCESS_FREQUENCIES = [
  "Annually",
  "As needed",
  "Bi-annually",
  "Daily",
  "Monthly",
  "Quarterly",
  "Weekly",
];

const NATURE_OF_IMPLEMENTATIONS = ["Manual", "Automated", "Manual + Automated"];
const OPERATIONAL_COMPLEXITIES = ["Low", "Medium", "High"];
const RISK_RATINGS = ["Low", "Medium", "High"];
const PROCESS_TYPES = ["Primary", "Management", "Supporting"];
const STATUSES = ["Active", "Inactive"];

export default function ProcessPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>("processCode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterFrequency, setFilterFrequency] = useState<string>("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Process | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    processType: "Primary",
    status: "Active",
    departmentId: "",
    ownerId: "",
    location: "",
    responsibleId: "",
    accountableId: "",
    consultedId: "",
    informedId: "",
    processFrequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    externalDependency: false,
    kpiMeasurementRequired: false,
    piiCapture: false,
    operationalComplexity: "",
    lastAuditDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [nextProcessId, setNextProcessId] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const TOTAL_STEPS = 3;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Process | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [processes, searchQuery, filterDepartment, filterOwner, filterFrequency]);

  const fetchData = async () => {
    try {
      const [processesRes, departmentsRes, usersRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);

      if (processesRes.ok) {
        const data = await processesRes.json();
        setProcesses(data);
        // Generate next process ID
        const maxId = data.reduce((max: number, p: Process) => {
          const match = p.processCode?.match(/PRO(\d+)/);
          if (match) {
            return Math.max(max, parseInt(match[1]));
          }
          return max;
        }, 0);
        setNextProcessId(`PRO${maxId + 1}`);
      }

      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json());
      }

      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...processes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.processCode.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
      );
    }

    if (filterDepartment) {
      filtered = filtered.filter((p) => p.departmentId === filterDepartment);
    }

    if (filterOwner) {
      filtered = filtered.filter((p) => p.ownerId === filterOwner);
    }

    if (filterFrequency) {
      filtered = filtered.filter((p) => p.processFrequency === filterFrequency);
    }

    setFilteredProcesses(filtered);
  };

  const handleSort = (column: string) => {
    const newOrder = sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(newOrder);

    const sorted = [...filteredProcesses].sort((a, b) => {
      let aVal: any = a[column as keyof Process];
      let bVal: any = b[column as keyof Process];

      if (column === "department") {
        aVal = a.department?.name || "";
        bVal = b.department?.name || "";
      } else if (column === "owner") {
        aVal = a.owner?.fullName || "";
        bVal = b.owner?.fullName || "";
      }

      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      if (typeof aVal === "string") {
        return newOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return newOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    setFilteredProcesses(sorted);
  };

  // Calculate summary stats
  const getStats = () => {
    const notAssessed = processes.filter((p) => !p.riskRating).length;
    const low = processes.filter((p) => p.riskRating === "Low").length;
    const medium = processes.filter((p) => p.riskRating === "Medium").length;
    const high = processes.filter((p) => p.riskRating === "High").length;
    return { notAssessed, low, medium, high };
  };

  const stats = getStats();

  const openAddDialog = () => {
    setEditItem(null);
    setCurrentStep(1);
    setFormData({
      name: "",
      description: "",
      processType: "Primary",
      status: "Active",
      departmentId: "",
      ownerId: "",
      location: "",
      responsibleId: "",
      accountableId: "",
      consultedId: "",
      informedId: "",
      processFrequency: "",
      natureOfImplementation: "",
      assetDependency: false,
      externalDependency: false,
      kpiMeasurementRequired: false,
      piiCapture: false,
      operationalComplexity: "",
      lastAuditDate: "",
    });
    setUploadedFiles([]);

    // Recalculate next process ID to ensure it's current
    const maxId = processes.reduce((max: number, p: Process) => {
      const match = p.processCode?.match(/PRO(\d+)/);
      if (match) {
        return Math.max(max, parseInt(match[1]));
      }
      return max;
    }, 0);
    setNextProcessId(`PRO${maxId + 1}`);

    setDialogOpen(true);
  };

  const openEditDialog = (process: Process) => {
    setEditItem(process);
    setCurrentStep(1);
    setFormData({
      name: process.name || "",
      description: process.description || "",
      processType: process.processType || "Primary",
      status: process.status || "Active",
      departmentId: process.departmentId || "",
      ownerId: process.ownerId || "",
      location: process.location || "",
      responsibleId: process.responsibleId || "",
      accountableId: process.accountableId || "",
      consultedId: process.consultedId || "",
      informedId: process.informedId || "",
      processFrequency: process.processFrequency || "",
      natureOfImplementation: process.natureOfImplementation || "",
      assetDependency: process.assetDependency || false,
      externalDependency: process.externalDependency || false,
      kpiMeasurementRequired: process.kpiMeasurementRequired || false,
      piiCapture: process.piiCapture || false,
      operationalComplexity: process.operationalComplexity || "",
      lastAuditDate: process.lastAuditDate
        ? new Date(process.lastAuditDate).toISOString().split("T")[0]
        : "",
    });
    setDialogOpen(true);
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentStep(1);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a process name");
      return;
    }

    setSaving(true);
    try {
      const url = editItem ? `/api/processes/${editItem.id}` : "/api/processes";
      const method = editItem ? "PUT" : "POST";

      const body = {
        ...formData,
        // Include processCode only when creating new process
        ...(editItem ? {} : { processCode: nextProcessId }),
        departmentId: formData.departmentId || null,
        ownerId: formData.ownerId || null,
        lastAuditDate: formData.lastAuditDate || null,
        responsibleId: formData.responsibleId || null,
        accountableId: formData.accountableId || null,
        consultedId: formData.consultedId || null,
        informedId: formData.informedId || null,
      };

      console.log("Saving process:", body);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert("Process saved successfully!");
        setDialogOpen(false);
        setCurrentStep(1);
        setUploadedFiles([]);
        fetchData();
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        alert(`Failed to save process: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("An error occurred while saving the process");
    } finally {
      setSaving(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Basic Information";
      case 2: return "Add Documents";
      case 3: return "RACI Assignment";
      default: return "";
    }
  };

  const openDeleteDialog = (process: Process) => {
    setItemToDelete(process);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/processes/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = () => {
    const headers = [
      "Process Code",
      "Name",
      "Description",
      "Process Type",
      "Status",
      "Department",
      "Owner",
      "Process Frequency",
      "Nature of Implementation",
      "Asset Dependency",
      "External Dependency",
      "KPI Measurement Required",
      "PII Capture",
      "Operational Complexity",
      "Last Audit Date",
    ];

    const csvContent = [
      headers.join(","),
      ...processes.map((process) =>
        [
          process.processCode,
          `"${process.name}"`,
          `"${process.description || ""}"`,
          process.processType || "",
          process.status || "",
          `"${process.department?.name || ""}"`,
          `"${process.owner?.fullName || ""}"`,
          process.processFrequency || "",
          process.natureOfImplementation || "",
          process.assetDependency ? "Yes" : "No",
          process.externalDependency ? "Yes" : "No",
          process.kpiMeasurementRequired ? "Yes" : "No",
          process.piiCapture ? "Yes" : "No",
          process.operationalComplexity || "",
          process.lastAuditDate
            ? new Date(process.lastAuditDate).toLocaleDateString()
            : "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processes-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split("\n");
      const headers = lines[0].split(",");

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const processData: any = {};

        headers.forEach((header, index) => {
          const value = values[index]?.replace(/^"|"$/g, "").trim();
          if (header.includes("Name")) processData.name = value;
          if (header.includes("Description")) processData.description = value;
          if (header.includes("Process Type")) processData.processType = value;
          if (header.includes("Status")) processData.status = value;
          if (header.includes("Process Frequency"))
            processData.processFrequency = value;
          if (header.includes("Nature of Implementation"))
            processData.natureOfImplementation = value;
          if (header.includes("Asset Dependency"))
            processData.assetDependency = value === "Yes";
          if (header.includes("External Dependency"))
            processData.externalDependency = value === "Yes";
          if (header.includes("KPI Measurement Required"))
            processData.kpiMeasurementRequired = value === "Yes";
          if (header.includes("PII Capture"))
            processData.piiCapture = value === "Yes";
          if (header.includes("Operational Complexity"))
            processData.operationalComplexity = value;
        });

        if (processData.name) {
          try {
            await fetch("/api/processes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(processData),
            });
          } catch (error) {
            console.error("Failed to import process:", error);
          }
        }
      }

      fetchData();
      e.target.value = "";
    };

    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/internal-audit/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Process</h1>
            <p className="text-gray-600">Define audit processes and workflows</p>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-card rounded-lg border">
        <div className="p-6 space-y-6">
          <h2 className="text-xl font-semibold">Process Hub</h2>

        {/* Summary Cards */}
        <div className="flex gap-4">
          <Card className="flex-1 cursor-pointer hover:border-primary">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.notAssessed}</div>
              <div className="text-sm text-muted-foreground">Not Assessed</div>
            </CardContent>
          </Card>
          <Card className="flex-1 cursor-pointer hover:border-primary border-green-500">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.low}</div>
              <div className="text-sm text-muted-foreground">Low</div>
            </CardContent>
          </Card>
          <Card className="flex-1 cursor-pointer hover:border-primary border-yellow-500">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-sm text-muted-foreground">Medium</div>
            </CardContent>
          </Card>
          <Card className="flex-1 cursor-pointer hover:border-primary border-red-500">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.high}</div>
              <div className="text-sm text-muted-foreground">High</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search By Process ID, Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterDepartment || "all"} onValueChange={(v) => setFilterDepartment(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterOwner || "all"} onValueChange={(v) => setFilterOwner(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Process Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterFrequency || "all"} onValueChange={(v) => setFilterFrequency(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Process Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              {PROCESS_FREQUENCIES.map((freq) => (
                <SelectItem key={freq} value={freq}>
                  {freq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById('import-file')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Process
            </Button>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("processCode")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Reference ID
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Name
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("department")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Department
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("owner")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Process Owner
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("processFrequency")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Process Frequency
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("natureOfImplementation")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Nature Of Implementation
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("riskRating")}
                  className="flex items-center gap-2 -ml-4"
                >
                  Risk Rating
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProcesses.map((process) => (
              <TableRow key={process.id}>
                <TableCell>{process.processCode}</TableCell>
                <TableCell>{process.name}</TableCell>
                <TableCell>{process.department?.name || ""}</TableCell>
                <TableCell>{process.owner?.fullName || ""}</TableCell>
                <TableCell>{process.processFrequency || ""}</TableCell>
                <TableCell>{process.natureOfImplementation || ""}</TableCell>
                <TableCell>
                  {process.riskRating && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        process.riskRating === "High"
                          ? "bg-red-100 text-red-700"
                          : process.riskRating === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {process.riskRating}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(process)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(process)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProcesses.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No processes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

          {/* Pagination info */}
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredProcesses.length} of {processes.length} processes
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Process" : "New Process"}</DialogTitle>
            <div className="flex items-center justify-center mt-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step === currentStep
                      ? "bg-primary text-primary-foreground border-primary"
                      : step < currentStep
                      ? "bg-primary/20 border-primary"
                      : "border-gray-300"
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-0.5 ${step < currentStep ? "bg-primary" : "bg-gray-300"}`} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-center mt-2 font-medium">{getStepTitle()}</p>
          </DialogHeader>
          <div className="space-y-4 py-4">{currentStep === 1 && (
            <>
            <div className="grid grid-cols-2 gap-4">
              {/* Process ID (readonly) */}
              <div>
                <Label>Process ID</Label>
                <Input
                  value={editItem ? editItem.processCode : nextProcessId}
                  disabled
                  className="mt-2 bg-muted"
                />
              </div>

              {/* Process Name */}
              <div>
                <Label htmlFor="name">Process Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter Process Name"
                  className="mt-2"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter Description"
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Department */}
              <div>
                <Label>Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Process Owner */}
              <div>
                <Label>Process Owner</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Process Frequency */}
              <div>
                <Label>Process Frequency</Label>
                <Select
                  value={formData.processFrequency}
                  onValueChange={(value) => setFormData({ ...formData, processFrequency: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Process Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nature of Implementation */}
              <div>
                <Label>Nature of Implementation</Label>
                <Select
                  value={formData.natureOfImplementation}
                  onValueChange={(value) =>
                    setFormData({ ...formData, natureOfImplementation: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Nature Of Implementation" />
                  </SelectTrigger>
                  <SelectContent>
                    {NATURE_OF_IMPLEMENTATIONS.map((nature) => (
                      <SelectItem key={nature} value={nature}>
                        {nature}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Asset Dependency */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assetDependency"
                  checked={formData.assetDependency}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, assetDependency: checked as boolean })
                  }
                />
                <Label htmlFor="assetDependency" className="cursor-pointer">
                  Asset Dependency
                </Label>
              </div>

              {/* External Dependency */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="externalDependency"
                  checked={formData.externalDependency}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, externalDependency: checked as boolean })
                  }
                />
                <Label htmlFor="externalDependency" className="cursor-pointer">
                  External Dependency
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* KPI Measurement Required */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpiMeasurementRequired"
                  checked={formData.kpiMeasurementRequired}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, kpiMeasurementRequired: checked as boolean })
                  }
                />
                <Label htmlFor="kpiMeasurementRequired" className="cursor-pointer">
                  KPI Measurement Required
                </Label>
              </div>

              {/* PII Capture */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="piiCapture"
                  checked={formData.piiCapture}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, piiCapture: checked as boolean })
                  }
                />
                <Label htmlFor="piiCapture" className="cursor-pointer">
                  PII Capture
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Operational Complexity */}
              <div>
                <Label>Operational Complexity</Label>
                <Select
                  value={formData.operationalComplexity}
                  onValueChange={(value) =>
                    setFormData({ ...formData, operationalComplexity: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_COMPLEXITIES.map((complexity) => (
                      <SelectItem key={complexity} value={complexity}>
                        {complexity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Last Audit Date */}
              <div>
                <Label htmlFor="lastAuditDate">Last Audit Date</Label>
                <Input
                  id="lastAuditDate"
                  type="date"
                  value={formData.lastAuditDate}
                  onChange={(e) => setFormData({ ...formData, lastAuditDate: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            </>
            )}

            {/* Step 2: Add Documents */}
            {currentStep === 2 && (
            <>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('fileUpload')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-primary');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
                const files = Array.from(e.dataTransfer.files);
                const validFiles = files.filter(f =>
                  ['.pdf', '.doc', '.docx', '.xls', '.xlsx'].some(ext => f.name.toLowerCase().endsWith(ext)) &&
                  f.size <= 10 * 1024 * 1024
                );
                setUploadedFiles(prev => [...prev, ...validFiles]);
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="text-gray-400">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Support for PDF, DOC, DOCX, XLS, XLSX (Max 10MB)
                  </p>
                </div>
                <Input
                  type="file"
                  multiple
                  className="hidden"
                  id="fileUpload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
                    setUploadedFiles(prev => [...prev, ...validFiles]);
                  }}
                />
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Uploaded Files ({uploadedFiles.length}):</p>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-gray-500 mt-2">
              You can upload multiple documents related to this process
            </div>
            </>
            )}

            {/* Step 3: RACI Assignment */}
            {currentStep === 3 && (
            <>
            <div className="grid grid-cols-2 gap-4">
              {/* Responsible */}
              <div>
                <Label>Responsible</Label>
                <Select
                  value={formData.responsibleId}
                  onValueChange={(value) => setFormData({ ...formData, responsibleId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Responsible" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accountable */}
              <div>
                <Label>Accountable</Label>
                <Select
                  value={formData.accountableId}
                  onValueChange={(value) => setFormData({ ...formData, accountableId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Accountable" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Consulted */}
              <div>
                <Label>Consulted</Label>
                <Select
                  value={formData.consultedId}
                  onValueChange={(value) => setFormData({ ...formData, consultedId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Consulted" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Informed */}
              <div>
                <Label>Informed</Label>
                <Select
                  value={formData.informedId}
                  onValueChange={(value) => setFormData({ ...formData, informedId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select Informed" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              {currentStep < TOTAL_STEPS && (
                <Button onClick={handleNext} disabled={currentStep === 1 && !formData.name.trim()}>
                  Next
                </Button>
              )}
              {currentStep === TOTAL_STEPS && (
                <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this process?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
