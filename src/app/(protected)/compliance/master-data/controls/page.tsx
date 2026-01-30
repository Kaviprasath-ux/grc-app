"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  Compliant: "bg-success-light text-success-dark",
  "Non Compliant": "bg-error-light text-error-dark",
  "Partial Compliant": "bg-warning-light text-warning-dark",
  "Not Applicable": "bg-slate-100 text-slate-600",
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
  const { toast } = useToast();
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
    notPerformed: "",
    performedInformally: "",
    plannedAndTracked: "",
    wellDefined: "",
    quantitativelyControlled: "",
    continuouslyImproving: "",
  });

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
          relativeControlWeighting: formData.relativeControlWeighting
            ? parseInt(formData.relativeControlWeighting)
            : null,
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
      relativeControlWeighting:
        control.relativeControlWeighting?.toString() || "",
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
      [
        "Control Name",
        "Control Domain",
        "Control Code",
        "Description",
        "Function Grouping",
        "Entities",
        "Status",
      ],
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
      [
        "Control Name",
        "Control Domain",
        "Control Code",
        "Description",
        "Control Question",
        "Function Grouping",
        "Entities",
        "Status",
      ],
      [
        "Example Control",
        "Compliance",
        "CTRL-001",
        "Description here",
        "Is this control effective?",
        "Govern",
        "Organization Wide",
        "Non Compliant",
      ],
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
      const dataLines = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        const matches = line.match(/("([^"]*)"|[^,]+)/g) || [];
        const values = matches.map((v) => v.replace(/^"|"$/g, "").trim());

        if (values.length >= 2) {
          const [
            name,
            domainName,
            controlCode,
            description,
            controlQuestion,
            functionalGrouping,
            entities,
            status,
          ] = values;

          const domain = domains.find(
            (d) => d.name.toLowerCase() === domainName?.toLowerCase()
          );

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

      toast({
        title: "Success",
        description: `Import completed: ${successCount} controls imported, ${errorCount} errors`,
      });
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchControls();
    } catch (error) {
      console.error("Error importing controls:", error);
      toast({
        title: "Error",
        description: "Failed to import controls. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/master-data")}
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Control</h1>
            <p className="text-sm text-slate-500">Manage control definitions</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search controls..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="max-w-md bg-white"
        />
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Control
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
            {/* Sticky Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  Control Details - Step {wizardStep} of 3
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center px-6 py-4 bg-slate-50/50 flex-shrink-0">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium ${
                      step === wizardStep
                        ? "bg-primary text-primary-foreground border-primary"
                        : step < wizardStep
                          ? "bg-success text-white border-success"
                          : "bg-white border-slate-300 text-slate-500"
                    }`}
                  >
                    {step < wizardStep ? <Check className="h-4 w-4" /> : step}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      step === wizardStep
                        ? "font-semibold text-slate-800"
                        : "text-slate-500"
                    }`}
                  >
                    {step === 1
                      ? "Control Info"
                      : step === 2
                        ? "Assignments"
                        : "Review"}
                  </span>
                  {step < 3 && (
                    <div className="w-12 h-0.5 bg-slate-200 mx-3" />
                  )}
                </div>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {/* Step 1: Control Information */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Control Domain
                    </Label>
                    <Select
                      value={formData.domainId || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          domainId: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
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
                    <Label className="text-sm font-medium text-slate-700">
                      Control Name *
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter control name"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Description
                    </Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Enter description"
                      rows={3}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Control Question *
                    </Label>
                    <Textarea
                      value={formData.controlQuestion}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          controlQuestion: e.target.value,
                        })
                      }
                      placeholder="Enter control question"
                      rows={2}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Function Grouping *
                    </Label>
                    <Select
                      value={formData.functionalGrouping || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          functionalGrouping: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select grouping" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="none">Select grouping</SelectItem>
                        {functionalGroupings.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 2: Assignments */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Department *
                    </Label>
                    <Select
                      value={formData.departmentId || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          departmentId: value === "none" ? "" : value,
                          assigneeId: "",
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
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
                    <Label className="text-sm font-medium text-slate-700">
                      Assignee *
                    </Label>
                    <Select
                      value={formData.assigneeId || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          assigneeId: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="none">Select assignee</SelectItem>
                        {filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.assigneeId && formData.departmentId && (
                      <p className="text-error text-sm mt-1">
                        Please select the assignee
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Control Name
                      </p>
                      <p className="text-sm text-slate-800">{formData.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Control Code
                      </p>
                      <p className="text-sm text-slate-400">(Auto-generated)</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Description
                    </p>
                    <p className="text-sm text-slate-800">
                      {formData.description || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Control Question
                    </p>
                    <p className="text-sm text-slate-800">
                      {formData.controlQuestion}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Control Domain
                      </p>
                      <p className="text-sm text-slate-800">
                        {domains.find((d) => d.id === formData.domainId)?.name ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Functional Grouping
                      </p>
                      <p className="text-sm text-slate-800">
                        {formData.functionalGrouping}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Department
                      </p>
                      <p className="text-sm text-slate-800">
                        {departments.find((d) => d.id === formData.departmentId)
                          ?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Assignee
                      </p>
                      <p className="text-sm text-slate-800">
                        {users.find((u) => u.id === formData.assigneeId)
                          ?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
              {wizardStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setWizardStep(wizardStep - 1)}
                >
                  Previous
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={
                    wizardStep === 1
                      ? !formData.name ||
                        !formData.controlQuestion ||
                        !formData.functionalGrouping
                      : !formData.departmentId || !formData.assigneeId
                  }
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleCreate}>Create Control</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-3">
                Control Name
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">
                Control Domain
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">
                Control Code
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3 max-w-[200px]">
                Description
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">
                Function Grouping
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3 w-[100px]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-slate-500">No controls found</p>
                </TableCell>
              </TableRow>
            ) : (
              controls.map((control) => (
                <TableRow key={control.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800 max-w-[200px] truncate">
                    {control.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {control.domain?.name || "-"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {control.controlCode}
                  </TableCell>
                  <TableCell className="text-slate-600 max-w-[200px] truncate">
                    {control.description || "-"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {control.functionalGrouping || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        statusColors[control.status] ||
                        "bg-slate-100 text-slate-600"
                      }
                    >
                      {control.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(control)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(control)}
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            {total > 0
              ? `Showing ${startItem} to ${endItem} of ${total}`
              : "No controls"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="px-6 py-5 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Edit Control
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Control Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.controlCode}
                  onChange={(e) =>
                    setFormData({ ...formData, controlCode: e.target.value })
                  }
                  className="mt-1.5 w-full bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Control Domain
                </Label>
                <Select
                  value={formData.domainId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      domainId: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
              <Label className="text-sm font-medium text-slate-700">
                Control Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Description
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="mt-1.5 w-full bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Control Question
              </Label>
              <Textarea
                value={formData.controlQuestion}
                onChange={(e) =>
                  setFormData({ ...formData, controlQuestion: e.target.value })
                }
                rows={2}
                className="mt-1.5 w-full bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Function Grouping
                </Label>
                <Select
                  value={formData.functionalGrouping || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      functionalGrouping: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="text-sm font-medium text-slate-700">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Non Compliant">Non Compliant</SelectItem>
                    <SelectItem value="Compliant">Compliant</SelectItem>
                    <SelectItem value="Partial Compliant">
                      Partial Compliant
                    </SelectItem>
                    <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Department
                </Label>
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      departmentId: value === "none" ? "" : value,
                      assigneeId: "",
                    })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="text-sm font-medium text-slate-700">
                  Assignee
                </Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      assigneeId: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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

            {/* Additional Fields */}
            <div className="grid grid-cols-3 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Relative Control Weighting
                </Label>
                <Input
                  type="number"
                  value={formData.relativeControlWeighting}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      relativeControlWeighting: e.target.value,
                    })
                  }
                  placeholder="0-100"
                  className="mt-1.5 w-full bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Scope
                </Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="In-Scope">In-Scope</SelectItem>
                    <SelectItem value="Not In-Scope">Not In-Scope</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isControlList"
                    checked={formData.isControlList}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isControlList: checked as boolean })
                    }
                  />
                  <Label
                    htmlFor="isControlList"
                    className="text-sm text-slate-600 cursor-pointer"
                  >
                    Is Control List
                  </Label>
                </div>
              </div>
            </div>

            {/* CMM Maturity Levels */}
            <div className="border-t border-slate-100 pt-6">
              <h4 className="font-semibold text-slate-800 mb-5">
                CMM Maturity Levels
              </h4>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Not Performed (Level 0)
                  </Label>
                  <Textarea
                    value={formData.notPerformed}
                    onChange={(e) =>
                      setFormData({ ...formData, notPerformed: e.target.value })
                    }
                    placeholder="Description for Level 0"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Performed Informally (Level 1)
                  </Label>
                  <Textarea
                    value={formData.performedInformally}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        performedInformally: e.target.value,
                      })
                    }
                    placeholder="Description for Level 1"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Planned and Tracked (Level 2)
                  </Label>
                  <Textarea
                    value={formData.plannedAndTracked}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        plannedAndTracked: e.target.value,
                      })
                    }
                    placeholder="Description for Level 2"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Well Defined (Level 3)
                  </Label>
                  <Textarea
                    value={formData.wellDefined}
                    onChange={(e) =>
                      setFormData({ ...formData, wellDefined: e.target.value })
                    }
                    placeholder="Description for Level 3"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Quantitatively Controlled (Level 4)
                  </Label>
                  <Textarea
                    value={formData.quantitativelyControlled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantitativelyControlled: e.target.value,
                      })
                    }
                    placeholder="Description for Level 4"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Continuously Improving (Level 5)
                  </Label>
                  <Textarea
                    value={formData.continuouslyImproving}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        continuouslyImproving: e.target.value,
                      })
                    }
                    placeholder="Description for Level 5"
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 bg-white rounded-b-lg flex-shrink-0">
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
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">
              Delete Control
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete &quot;{selectedControl?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-semantic-error hover:bg-semantic-error/90 h-9"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="px-6 py-5 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Import Controls
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500">
              Upload a CSV file to import controls. You can download a template
              to see the required format.
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">File *</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder="Choose a file..."
                  className="flex-1 bg-white min-w-0"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  Browse...
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Supported formats: CSV
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
