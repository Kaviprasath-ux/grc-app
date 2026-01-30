"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown, Download, Upload, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
            <Button onClick={() => router.push("/internal-audit/settings/process/new")}>
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
                      onClick={() => router.push(`/internal-audit/settings/process/${process.id}`)}
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
