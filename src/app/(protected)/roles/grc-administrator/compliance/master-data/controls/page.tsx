"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Home,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

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
  const { t } = useLanguage();
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
  const [controlErrors, setControlErrors] = useState<Record<string, string>>({});

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
    setControlErrors({});
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
        title: t("Success"),
        description: t("Import completed") + `: ${successCount} ${t("controls imported")}, ${errorCount} ${t("errors")}`,
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
        title: t("Error"),
        description: t("Failed to import controls. Please check the file format."),
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/roles/grc-administrator/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Master Data")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Control")}</h1>
      </div>

      {/* Search and Actions - same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search controls...")}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 w-[300px] bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Import")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Dialog
            open={createDialogOpen}
            onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                resetForm();
                setControlErrors({});
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("New Control")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
              {/* Sticky Header */}
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-slate-800">
                    {t("Control Details")} - {t("Step")} {wizardStep} {t("of")} 3
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Step Indicator */}
              <div className="flex-shrink-0 flex items-center justify-center px-6 py-4 bg-slate-50/50 border-b border-slate-100">
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
                      className={`ltr:ml-2 rtl:mr-2 text-sm ${
                        step === wizardStep
                          ? "font-semibold text-slate-800"
                          : "text-slate-500"
                      }`}
                    >
                      {step === 1
                        ? t("Control Info")
                        : step === 2
                          ? t("Assignments")
                          : t("Review")}
                    </span>
                    {step < 3 && (
                      <div className="w-12 h-0.5 bg-slate-200 mx-3" />
                    )}
                  </div>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Step 1: Control Information */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Control Domain")} <span className="text-error">*</span>
                      </Label>
                      <Select
                        value={formData.domainId || "none"}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            domainId: value === "none" ? "" : value,
                          });
                          if (controlErrors.domainId) setControlErrors((prev) => { const { domainId, ...rest } = prev; return rest; });
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${controlErrors.domainId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select domain")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="none">{t("Select domain")}</SelectItem>
                          {domains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.domainId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.domainId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Control Name")} <span className="text-error">*</span>
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          if (controlErrors.name) setControlErrors((prev) => { const { name, ...rest } = prev; return rest; });
                        }}
                        placeholder={t("Enter control name")}
                        className={`mt-1.5 w-full bg-white ${controlErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                      />
                      {controlErrors.name && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.name}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Description")}
                      </Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder={t("Enter description")}
                        rows={3}
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Control Question")} <span className="text-error">*</span>
                      </Label>
                      <Textarea
                        value={formData.controlQuestion}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            controlQuestion: e.target.value,
                          });
                          if (controlErrors.controlQuestion) setControlErrors((prev) => { const { controlQuestion, ...rest } = prev; return rest; });
                        }}
                        placeholder={t("Enter control question")}
                        rows={2}
                        className={`mt-1.5 w-full bg-white ${controlErrors.controlQuestion ? "border-red-500 focus:ring-red-500" : ""}`}
                      />
                      {controlErrors.controlQuestion && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.controlQuestion}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Function Grouping")} <span className="text-error">*</span>
                      </Label>
                      <Select
                        value={formData.functionalGrouping || "none"}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            functionalGrouping: value === "none" ? "" : value,
                          });
                          if (controlErrors.functionalGrouping) setControlErrors((prev) => { const { functionalGrouping, ...rest } = prev; return rest; });
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${controlErrors.functionalGrouping ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select grouping")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="none">{t("Select grouping")}</SelectItem>
                          {functionalGroupings.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.functionalGrouping && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.functionalGrouping}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Assignments */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Department")} <span className="text-error">*</span>
                      </Label>
                      <Select
                        value={formData.departmentId || "none"}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            departmentId: value === "none" ? "" : value,
                            assigneeId: "",
                          });
                          if (controlErrors.departmentId) setControlErrors((prev) => { const { departmentId, ...rest } = prev; return rest; });
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${controlErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="none">{t("Select department")}</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.departmentId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.departmentId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        {t("Assignee")} <span className="text-error">*</span>
                      </Label>
                      <Select
                        value={formData.assigneeId || "none"}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            assigneeId: value === "none" ? "" : value,
                          });
                          if (controlErrors.assigneeId) setControlErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; });
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${controlErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select assignee")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="none">{t("Select assignee")}</SelectItem>
                          {filteredUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.assigneeId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.assigneeId}</p>
                        </div>
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
                          {t("Control Name")}
                        </p>
                        <p className="text-sm text-slate-800">{formData.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t("Control Code")}
                        </p>
                        <p className="text-sm text-slate-400">({t("Auto-generated")})</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {t("Description")}
                      </p>
                      <p className="text-sm text-slate-800">
                        {formData.description || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {t("Control Question")}
                      </p>
                      <p className="text-sm text-slate-800">
                        {formData.controlQuestion}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t("Control Domain")}
                        </p>
                        <p className="text-sm text-slate-800">
                          {domains.find((d) => d.id === formData.domainId)?.name ||
                            "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t("Functional Grouping")}
                        </p>
                        <p className="text-sm text-slate-800">
                          {formData.functionalGrouping}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t("Department")}
                        </p>
                        <p className="text-sm text-slate-800">
                          {departments.find((d) => d.id === formData.departmentId)
                            ?.name || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t("Assignee")}
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
              <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                {wizardStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(wizardStep - 1)}
                  >
                    {t("Previous")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                    setControlErrors({});
                  }}
                >
                  {t("Cancel")}
                </Button>
                {wizardStep < 3 ? (
                  <Button
                    onClick={() => {
                      if (wizardStep === 1) {
                        const errors: Record<string, string> = {};
                        if (!formData.domainId) errors.domainId = t("Please select the Control Domain");
                        if (!formData.name.trim()) errors.name = t("Please enter name");
                        if (!formData.controlQuestion?.trim()) errors.controlQuestion = t("Please enter the question");
                        if (!formData.functionalGrouping) errors.functionalGrouping = t("Please select the Functional Grouping");
                        if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                        setControlErrors({});
                      }
                      if (wizardStep === 2) {
                        const errors: Record<string, string> = {};
                        if (!formData.departmentId) errors.departmentId = t("Please select the Department");
                        if (!formData.assigneeId) errors.assigneeId = t("Please select the assignee");
                        if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                        setControlErrors({});
                      }
                      setWizardStep(wizardStep + 1);
                    }}
                  >
                    {t("Next")}
                  </Button>
                ) : (
                  <Button onClick={handleCreate}>{t("Create Control")}</Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">
                {t("Control Name")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">
                {t("Control Domain")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">
                {t("Control Code")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 max-w-[200px]">
                {t("Description")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">
                {t("Function Grouping")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">
                {t("Status")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">
                {t("Action")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Controls Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("Create a new control to get started.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              controls.map((control) => (
                <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4 max-w-[200px] truncate">
                    {control.name}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {control.domain?.name || "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {control.controlCode}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">
                    {control.description || "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {control.functionalGrouping || "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    <Badge
                      className={
                        statusColors[control.status] ||
                        "bg-slate-100 text-slate-600"
                      }
                    >
                      {control.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm pr-4">
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {total > 0
              ? `${t("Showing")} ${startItem} ${t("to")} ${endItem} ${t("of")} ${total}`
              : t("No controls")}
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
              {t("Page")} {page} {t("of")} {totalPages || 1}
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
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Edit Control")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Control Code")} <span className="text-red-500">*</span>
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
                  {t("Control Domain")}
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
                    <SelectItem value="none">{t("None")}</SelectItem>
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
                {t("Control Name")} <span className="text-red-500">*</span>
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
                {t("Description")}
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
                {t("Control Question")}
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
                  {t("Function Grouping")}
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
                    <SelectItem value="none">{t("None")}</SelectItem>
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
                  {t("Status")}
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
                    <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                    <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                    <SelectItem value="Partial Compliant">
                      {t("Partial Compliant")}
                    </SelectItem>
                    <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Department")}
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
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">{t("None")}</SelectItem>
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
                  {t("Assignee")}
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
                    <SelectValue placeholder={t("Select assignee")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">{t("None")}</SelectItem>
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
                  {t("Relative Control Weighting")}
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
                  {t("Scope")}
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
                    <SelectItem value="In-Scope">{t("In-Scope")}</SelectItem>
                    <SelectItem value="Not In-Scope">{t("Not In-Scope")}</SelectItem>
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
                    {t("Is Control List")}
                  </Label>
                </div>
              </div>
            </div>

            {/* CMM Maturity Levels */}
            <div className="border-t border-slate-100 pt-6">
              <h4 className="font-semibold text-slate-800 mb-5">
                {t("CMM Maturity Levels")}
              </h4>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Not Performed")} ({t("Level")} 0)
                  </Label>
                  <Textarea
                    value={formData.notPerformed}
                    onChange={(e) =>
                      setFormData({ ...formData, notPerformed: e.target.value })
                    }
                    placeholder={t("Description for Level 0")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Performed Informally")} ({t("Level")} 1)
                  </Label>
                  <Textarea
                    value={formData.performedInformally}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        performedInformally: e.target.value,
                      })
                    }
                    placeholder={t("Description for Level 1")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Planned and Tracked")} ({t("Level")} 2)
                  </Label>
                  <Textarea
                    value={formData.plannedAndTracked}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        plannedAndTracked: e.target.value,
                      })
                    }
                    placeholder={t("Description for Level 2")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Well Defined")} ({t("Level")} 3)
                  </Label>
                  <Textarea
                    value={formData.wellDefined}
                    onChange={(e) =>
                      setFormData({ ...formData, wellDefined: e.target.value })
                    }
                    placeholder={t("Description for Level 3")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Quantitatively Controlled")} ({t("Level")} 4)
                  </Label>
                  <Textarea
                    value={formData.quantitativelyControlled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantitativelyControlled: e.target.value,
                      })
                    }
                    placeholder={t("Description for Level 4")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Continuously Improving")} ({t("Level")} 5)
                  </Label>
                  <Textarea
                    value={formData.continuouslyImproving}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        continuouslyImproving: e.target.value,
                      })
                    }
                    placeholder={t("Description for Level 5")}
                    rows={2}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedControl(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.controlCode || !formData.name}
            >
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">
              {t("Delete Control")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedControl?.name}&quot;?
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("Delete")}
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
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Import Controls")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Upload a CSV file to import controls. You can download a template to see the required format.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")} *</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder={t("Choose a file...")}
                  className="flex-1 bg-white min-w-0"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  {t("Browse...")}
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
                {t("Supported formats")}: CSV
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Download Template")}
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
                {t("Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
