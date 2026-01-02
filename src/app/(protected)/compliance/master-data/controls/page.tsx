"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search } from "lucide-react";

interface ControlDomain {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  controlQuestion: string | null;
  functionalGrouping: string | null;
  entities: string;
  status: string;
  isControlList: boolean;
  relativeControlWeighting: number | null;
  scope: string | null;
  // CMM Maturity Levels
  notPerformed: string | null;
  performedInformally: string | null;
  plannedAndTracked: string | null;
  wellDefined: string | null;
  quantitativelyControlled: string | null;
  continuouslyImproving: string | null;
  domain: ControlDomain | null;
  department: Department | null;
  assignee: User | null;
}

const statusColors: Record<string, string> = {
  "Compliant": "bg-green-100 text-green-800",
  "Non Compliant": "bg-red-100 text-red-800",
  "Partial Compliant": "bg-yellow-100 text-yellow-800",
  "Not Applicable": "bg-gray-100 text-gray-800",
};

const functionalGroupings = [
  "Govern",
  "Identify",
  "Protect",
  "Detect",
  "Respond",
  "Recover",
];

export default function ControlsMasterDataPage() {
  const router = useRouter();
  const [controls, setControls] = useState<Control[]>([]);
  const [domains, setDomains] = useState<ControlDomain[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Wizard state for New Control
  const [wizardStep, setWizardStep] = useState(1);

  const [formData, setFormData] = useState({
    controlCode: "",
    name: "",
    description: "",
    controlQuestion: "",
    domainId: "",
    functionalGrouping: "",
    departmentId: "",
    assigneeId: "",
    entities: "Organization Wide",
    status: "Non Compliant",
    isControlList: false,
    relativeControlWeighting: "",
    scope: "In-Scope",
    // CMM Maturity Levels
    notPerformed: "",
    performedInformally: "",
    plannedAndTracked: "",
    wellDefined: "",
    quantitativelyControlled: "",
    continuouslyImproving: "",
  });

  // Get users filtered by selected department
  const filteredUsers = formData.departmentId
    ? users.filter((u) => u.departmentId === formData.departmentId)
    : users;

  const fetchControls = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/controls?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setControls(data);
          setTotal(data.length);
          setTotalPages(1);
        } else {
          setControls(data.data || []);
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  const fetchDomains = useCallback(async () => {
    try {
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        setDomains(data);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  useEffect(() => {
    fetchControls();
    fetchDomains();
    fetchDepartments();
    fetchUsers();
  }, [fetchControls, fetchDomains, fetchDepartments, fetchUsers]);

  const handleCreate = async () => {
    try {
      // Auto-generate control code
      const autoCode = `CTRL-${Date.now()}`;

      const response = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlCode: autoCode,
          name: formData.name,
          description: formData.description || null,
          controlQuestion: formData.controlQuestion || null,
          domainId: formData.domainId || null,
          functionalGrouping: formData.functionalGrouping || null,
          departmentId: formData.departmentId || null,
          assigneeId: formData.assigneeId || null,
          entities: formData.entities,
          status: "Non Compliant",
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setWizardStep(1);
        resetForm();
        fetchControls();
      }
    } catch (error) {
      console.error("Error creating control:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedControl) return;
    try {
      const response = await fetch(`/api/controls/${selectedControl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlCode: formData.controlCode,
          name: formData.name,
          description: formData.description || null,
          controlQuestion: formData.controlQuestion || null,
          domainId: formData.domainId || null,
          functionalGrouping: formData.functionalGrouping || null,
          departmentId: formData.departmentId || null,
          assigneeId: formData.assigneeId || null,
          entities: formData.entities,
          status: formData.status,
          isControlList: formData.isControlList,
          relativeControlWeighting: formData.relativeControlWeighting ? parseInt(formData.relativeControlWeighting) : null,
          scope: formData.scope || null,
          notPerformed: formData.notPerformed || null,
          performedInformally: formData.performedInformally || null,
          plannedAndTracked: formData.plannedAndTracked || null,
          wellDefined: formData.wellDefined || null,
          quantitativelyControlled: formData.quantitativelyControlled || null,
          continuouslyImproving: formData.continuouslyImproving || null,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedControl(null);
        resetForm();
        fetchControls();
      }
    } catch (error) {
      console.error("Error updating control:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedControl) return;
    try {
      const response = await fetch(`/api/controls/${selectedControl.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedControl(null);
        fetchControls();
      }
    } catch (error) {
      console.error("Error deleting control:", error);
    }
  };

  const openEditDialog = (control: Control) => {
    setSelectedControl(control);
    setFormData({
      controlCode: control.controlCode,
      name: control.name,
      description: control.description || "",
      controlQuestion: control.controlQuestion || "",
      domainId: control.domain?.id || "",
      functionalGrouping: control.functionalGrouping || "",
      departmentId: control.department?.id || "",
      assigneeId: control.assignee?.id || "",
      entities: control.entities,
      status: control.status,
      isControlList: control.isControlList || false,
      relativeControlWeighting: control.relativeControlWeighting?.toString() || "",
      scope: control.scope || "In-Scope",
      notPerformed: control.notPerformed || "",
      performedInformally: control.performedInformally || "",
      plannedAndTracked: control.plannedAndTracked || "",
      wellDefined: control.wellDefined || "",
      quantitativelyControlled: control.quantitativelyControlled || "",
      continuouslyImproving: control.continuouslyImproving || "",
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (control: Control) => {
    setSelectedControl(control);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      controlCode: "",
      name: "",
      description: "",
      controlQuestion: "",
      domainId: "",
      functionalGrouping: "",
      departmentId: "",
      assigneeId: "",
      entities: "Organization Wide",
      status: "Non Compliant",
      isControlList: false,
      relativeControlWeighting: "",
      scope: "In-Scope",
      notPerformed: "",
      performedInformally: "",
      plannedAndTracked: "",
      wellDefined: "",
      quantitativelyControlled: "",
      continuouslyImproving: "",
    });
    setWizardStep(1);
  };

  const handleExport = () => {
    const csv = [
      ["Control Name", "Control Domain", "Control Code", "Description", "Function Grouping", "Entities", "Status"],
      ...controls.map((c) => [
        c.name,
        c.domain?.name || "",
        c.controlCode,
        c.description || "",
        c.functionalGrouping || "",
        c.entities,
        c.status,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controls.csv";
    a.click();
  };

  const handleDownloadTemplate = () => {
    const templateCsv = [
      ["Control Name", "Control Domain", "Control Code", "Description", "Control Question", "Function Grouping", "Entities", "Status"],
      ["Example Control", "Compliance", "CTRL-001", "Description here", "Is this control effective?", "Govern", "Organization Wide", "Non Compliant"],
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controls_template.csv";
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        // Parse CSV line (handle quoted values)
        const matches = line.match(/("([^"]*)"|[^,]+)/g) || [];
        const values = matches.map((v) => v.replace(/^"|"$/g, "").trim());

        if (values.length >= 2) {
          const [name, domainName, controlCode, description, controlQuestion, functionalGrouping, entities, status] = values;

          // Find domain by name
          const domain = domains.find((d) => d.name.toLowerCase() === domainName?.toLowerCase());

          try {
            const response = await fetch("/api/controls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                controlCode: controlCode || `CTRL-${Date.now()}-${successCount}`,
                name,
                description: description || null,
                controlQuestion: controlQuestion || null,
                domainId: domain?.id || null,
                functionalGrouping: functionalGrouping || null,
                entities: entities || "Organization Wide",
                status: status || "Non Compliant",
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }
      }

      alert(`Import completed: ${successCount} controls imported, ${errorCount} errors`);
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchControls();
    } catch (error) {
      console.error("Error importing controls:", error);
      alert("Failed to import controls. Please check the file format.");
    } finally {
      setImporting(false);
    }
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
            onClick={() => router.push("/compliance/master-data")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Control</h1>
            <p className="text-gray-600">Manage control definitions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Control
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Control Details</DialogTitle>
              </DialogHeader>

              {/* Step Indicators */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Button
                    variant={wizardStep >= 1 ? "default" : "outline"}
                    size="sm"
                    className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 1 ? "bg-blue-600" : ""}`}
                    onClick={() => setWizardStep(1)}
                  >
                    {wizardStep > 1 ? "✓" : "1"}
                  </Button>
                  <span className={`text-sm ${wizardStep === 1 ? "font-medium" : "text-gray-500"}`}>
                    Control Information
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={wizardStep >= 2 ? "default" : "outline"}
                    size="sm"
                    className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 2 ? "bg-blue-600" : ""}`}
                    onClick={() => wizardStep > 1 && setWizardStep(2)}
                  >
                    {wizardStep > 2 ? "✓" : "2"}
                  </Button>
                  <span className={`text-sm ${wizardStep === 2 ? "font-medium" : "text-gray-500"}`}>
                    Assignments & Details
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={wizardStep >= 3 ? "default" : "outline"}
                    size="sm"
                    className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 3 ? "bg-blue-600" : ""}`}
                    onClick={() => wizardStep > 2 && setWizardStep(3)}
                  >
                    3
                  </Button>
                  <span className={`text-sm ${wizardStep === 3 ? "font-medium" : "text-gray-500"}`}>
                    Review informations
                  </span>
                </div>
              </div>

              {/* Step 1: Control Information */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label>Control Domain</Label>
                    <Select
                      value={formData.domainId || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, domainId: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select domain</SelectItem>
                        {domains.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Control Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter control name"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Enter description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Control Question *</Label>
                    <Textarea
                      value={formData.controlQuestion}
                      onChange={(e) =>
                        setFormData({ ...formData, controlQuestion: e.target.value })
                      }
                      placeholder="Enter control question"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Function Grouping *</Label>
                    <Select
                      value={formData.functionalGrouping || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, functionalGrouping: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grouping" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select grouping</SelectItem>
                        {functionalGroupings.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      onClick={() => setWizardStep(2)}
                      disabled={!formData.name || !formData.controlQuestion || !formData.functionalGrouping}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Assignments & Details */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label>Department *</Label>
                    <Select
                      value={formData.departmentId || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          departmentId: value === "none" ? "" : value,
                          assigneeId: "" // Reset assignee when department changes
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select department</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assignee *</Label>
                    <Select
                      value={formData.assigneeId || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select assignee</SelectItem>
                        {filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.assigneeId && formData.departmentId && (
                      <p className="text-red-500 text-sm mt-1">Please select the assignee</p>
                    )}
                  </div>
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={() => setWizardStep(1)}>
                      Previous
                    </Button>
                    <Button
                      onClick={() => setWizardStep(3)}
                      disabled={!formData.departmentId || !formData.assigneeId}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Review Information */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Control Name</h5>
                      <p className="text-sm">{formData.name}</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Control Code</h5>
                      <p className="text-sm text-gray-400">(Auto-generated)</p>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-500">Description</h5>
                    <p className="text-sm">{formData.description || "-"}</p>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-500">Control Question</h5>
                    <p className="text-sm">{formData.controlQuestion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Control Domain</h5>
                      <p className="text-sm">
                        {domains.find((d) => d.id === formData.domainId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Functional Grouping</h5>
                      <p className="text-sm">{formData.functionalGrouping}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Department</h5>
                      <p className="text-sm">
                        {departments.find((d) => d.id === formData.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm text-gray-500">Assignee</h5>
                      <p className="text-sm">
                        {users.find((u) => u.id === formData.assigneeId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-500">Entities</h5>
                    <p className="text-sm">{formData.entities}</p>
                  </div>
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={() => setWizardStep(2)}>
                      Previous
                    </Button>
                    <Button onClick={handleCreate}>
                      Create Control
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search controls..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Control Name</TableHead>
                <TableHead>Control Domain</TableHead>
                <TableHead>Control Code</TableHead>
                <TableHead className="max-w-[200px]">Description</TableHead>
                <TableHead>Function Grouping</TableHead>
                <TableHead>Entities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-gray-500">No controls found</p>
                  </TableCell>
                </TableRow>
              ) : (
                controls.map((control) => (
                  <TableRow key={control.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {control.name}
                    </TableCell>
                    <TableCell>{control.domain?.name || "-"}</TableCell>
                    <TableCell>{control.controlCode}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {control.description || "-"}
                    </TableCell>
                    <TableCell>{control.functionalGrouping || "-"}</TableCell>
                    <TableCell>{control.entities}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[control.status] || "bg-gray-100"}>
                        {control.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(control)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(control)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Control</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Control Code *</Label>
                <Input
                  value={formData.controlCode}
                  onChange={(e) =>
                    setFormData({ ...formData, controlCode: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Control Domain</Label>
                <Select
                  value={formData.domainId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, domainId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Control Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div>
              <Label>Control Question</Label>
              <Textarea
                value={formData.controlQuestion}
                onChange={(e) =>
                  setFormData({ ...formData, controlQuestion: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Function Grouping</Label>
                <Select
                  value={formData.functionalGrouping || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, functionalGrouping: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {functionalGroupings.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entities</Label>
                <Input
                  value={formData.entities}
                  onChange={(e) =>
                    setFormData({ ...formData, entities: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      departmentId: value === "none" ? "" : value,
                      assigneeId: ""
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assignee</Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non Compliant">Non Compliant</SelectItem>
                  <SelectItem value="Compliant">Compliant</SelectItem>
                  <SelectItem value="Partial Compliant">Partial Compliant</SelectItem>
                  <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isControlList"
                  checked={formData.isControlList}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isControlList: checked as boolean })
                  }
                />
                <Label htmlFor="isControlList">Is Control List</Label>
              </div>
              <div>
                <Label>Relative Control Weighting</Label>
                <Input
                  type="number"
                  value={formData.relativeControlWeighting}
                  onChange={(e) =>
                    setFormData({ ...formData, relativeControlWeighting: e.target.value })
                  }
                  placeholder="0-100"
                />
              </div>
              <div>
                <Label>Scope</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In-Scope">In-Scope</SelectItem>
                    <SelectItem value="Not In-Scope">Not In-Scope</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CMM Maturity Levels */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-4">CMM Maturity Levels</h4>
              <div className="space-y-3">
                <div>
                  <Label>Not Performed (Level 0)</Label>
                  <Textarea
                    value={formData.notPerformed}
                    onChange={(e) =>
                      setFormData({ ...formData, notPerformed: e.target.value })
                    }
                    placeholder="Description for Level 0"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Performed Informally (Level 1)</Label>
                  <Textarea
                    value={formData.performedInformally}
                    onChange={(e) =>
                      setFormData({ ...formData, performedInformally: e.target.value })
                    }
                    placeholder="Description for Level 1"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Planned and Tracked (Level 2)</Label>
                  <Textarea
                    value={formData.plannedAndTracked}
                    onChange={(e) =>
                      setFormData({ ...formData, plannedAndTracked: e.target.value })
                    }
                    placeholder="Description for Level 2"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Well Defined (Level 3)</Label>
                  <Textarea
                    value={formData.wellDefined}
                    onChange={(e) =>
                      setFormData({ ...formData, wellDefined: e.target.value })
                    }
                    placeholder="Description for Level 3"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Quantitatively Controlled (Level 4)</Label>
                  <Textarea
                    value={formData.quantitativelyControlled}
                    onChange={(e) =>
                      setFormData({ ...formData, quantitativelyControlled: e.target.value })
                    }
                    placeholder="Description for Level 4"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Continuously Improving (Level 5)</Label>
                  <Textarea
                    value={formData.continuouslyImproving}
                    onChange={(e) =>
                      setFormData({ ...formData, continuouslyImproving: e.target.value })
                    }
                    placeholder="Description for Level 5"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedControl(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={!formData.controlCode || !formData.name}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Control</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedControl?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Controls</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-gray-500 mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                >
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
