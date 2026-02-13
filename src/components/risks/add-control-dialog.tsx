"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onControlAdded?: (control: PlannedControl) => void;
  riskId: string;
}

interface PlannedControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
  department?: string;
  assignedTo?: string;
}

interface ControlDomain {
  id: string;
  name: string;
  code?: string;
}

interface Department {
  id: string;
  name: string;
}

interface UserRole {
  role: {
    name: string;
  };
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  userRoles?: UserRole[];
}

const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

export function AddControlDialog({
  open,
  onOpenChange,
  onControlAdded,
  riskId,
}: AddControlDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // API data
  const [domains, setDomains] = useState<ControlDomain[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Form state
  const [newControl, setNewControl] = useState({
    name: "",
    description: "",
    controlQuestion: "",
    functionalGrouping: "",
    domainId: "",
    departmentId: "",
    assigneeId: "",
  });
  const [controlErrors, setControlErrors] = useState<Record<string, string>>({});

  // Create domain dialog
  const [isCreateDomainDialogOpen, setIsCreateDomainDialogOpen] = useState(false);
  const [newDomain, setNewDomain] = useState({ code: "", name: "" });
  const [creatingDomain, setCreatingDomain] = useState(false);
  const [domainErrors, setDomainErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchFilterOptions();
    }
  }, [open]);

  const fetchFilterOptions = async () => {
    try {
      const [domainRes, deptRes, userRes] = await Promise.all([
        fetch("/api/control-domains"),
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);
      if (domainRes.ok) setDomains(await domainRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const resetForm = () => {
    setStep(1);
    setNewControl({
      name: "",
      description: "",
      controlQuestion: "",
      functionalGrouping: "",
      domainId: "",
      departmentId: "",
      assigneeId: "",
    });
    setControlErrors({});
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Filter users for Assignee dropdown: only DepartmentReviewers and DepartmentContributors from the selected department
  const getFilteredUsersForAssignee = () => {
    if (!newControl.departmentId) return [];

    return users.filter((u) => {
      if (u.departmentId !== newControl.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  };

  const handleCreateDomain = async () => {
    const errors: Record<string, string> = {};
    if (!newDomain.code.trim()) errors.code = t("Please enter Domain Code");
    if (!newDomain.name.trim()) errors.name = t("Please enter Domain name");
    if (Object.keys(errors).length > 0) { setDomainErrors(errors); return; }
    setDomainErrors({});
    setCreatingDomain(true);
    try {
      const response = await fetch("/api/control-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });

      if (response.ok) {
        const createdDomain = await response.json();
        toast({
          title: t("Success"),
          description: t("Domain created successfully"),
        });
        setIsCreateDomainDialogOpen(false);
        setNewDomain({ code: "", name: "" });
        setDomainErrors({});
        // Refresh domains list and select the newly created domain
        const domainRes = await fetch("/api/control-domains");
        if (domainRes.ok) {
          setDomains(await domainRes.json());
        }
        // Auto-select the newly created domain
        setNewControl({ ...newControl, domainId: createdDomain.id });
      } else {
        const errorData = await response.json();
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to create domain"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating domain:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create domain"),
        variant: "destructive"
      });
    } finally {
      setCreatingDomain(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Generate a control ID
      const controlId = `CTRL-${Date.now().toString(36).toUpperCase()}`;

      const selectedDomain = domains.find(d => d.id === newControl.domainId);
      const selectedDepartment = departments.find(d => d.id === newControl.departmentId);
      const selectedAssignee = users.find(u => u.id === newControl.assigneeId);

      const plannedControl: PlannedControl = {
        id: crypto.randomUUID(),
        controlId,
        name: newControl.name,
        description: newControl.description || null,
        domain: selectedDomain?.name,
        functionalGrouping: newControl.functionalGrouping,
        department: selectedDepartment?.name,
        assignedTo: selectedAssignee?.fullName,
      };

      // Call the API to save the planned control
      const response = await fetch(`/api/risks/${riskId}/planned-controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plannedControl,
          controlQuestion: newControl.controlQuestion,
          domainId: newControl.domainId,
          departmentId: newControl.departmentId,
          assigneeId: newControl.assigneeId,
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Control added successfully"),
        });
        onControlAdded?.(plannedControl);
        handleClose();
      } else {
        const errorData = await response.json();
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to add control"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to add control:", error);
      toast({
        title: t("Error"),
        description: t("Failed to add control"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Control")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Step Progress */}
          <div className="flex-shrink-0 flex items-start justify-center py-5 px-6 border-b border-slate-100">
            {[
              { id: 1, name: t("Information") },
              { id: 2, name: t("Assignment") },
              { id: 3, name: t("Review") },
            ].map((stepItem, index) => (
              <div key={stepItem.id} className="flex items-start">
                <div className="flex flex-col items-center w-24">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      step > stepItem.id
                        ? "bg-success text-white"
                        : step === stepItem.id
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    )}
                  >
                    {step > stepItem.id ? <Check className="h-4 w-4" /> : stepItem.id}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center",
                      step >= stepItem.id ? "text-slate-700" : "text-slate-400"
                    )}
                  >
                    {stepItem.name}
                  </span>
                </div>
                {index < 2 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mt-[18px] -mx-3 transition-colors",
                      step > stepItem.id ? "bg-success" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Step 1: Control Information */}
              {step === 1 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Control Information")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Control Domain")} <span className="text-error">*</span></Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Select value={newControl.domainId} onValueChange={(v) => { setNewControl({ ...newControl, domainId: v }); if (controlErrors.domainId) setControlErrors((prev) => { const { domainId, ...rest } = prev; return rest; }); }}>
                          <SelectTrigger className={`bg-white flex-1 ${controlErrors.domainId ? "border-red-500 focus:ring-red-500" : ""}`}>
                            <SelectValue placeholder={t("Select domain")} />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                            {domains.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setIsCreateDomainDialogOpen(true)}
                          className="h-10 w-10 shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {controlErrors.domainId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.domainId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Functional Grouping")} <span className="text-error">*</span></Label>
                      <Select value={newControl.functionalGrouping} onValueChange={(v) => { setNewControl({ ...newControl, functionalGrouping: v }); if (controlErrors.functionalGrouping) setControlErrors((prev) => { const { functionalGrouping, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.functionalGrouping ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select grouping")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {FUNCTIONAL_GROUPINGS.map((g) => (
                            <SelectItem key={g} value={g}>{t(g)}</SelectItem>
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
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={newControl.name}
                      onChange={(e) => { setNewControl({ ...newControl, name: e.target.value }); if (controlErrors.name) setControlErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter control name")}
                      className={`mt-1.5 bg-white ${controlErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {controlErrors.name && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{controlErrors.name}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <Textarea
                      value={newControl.description}
                      onChange={(e) => setNewControl({ ...newControl, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 bg-white"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Question")} <span className="text-error">*</span></Label>
                    <Input
                      value={newControl.controlQuestion}
                      onChange={(e) => { setNewControl({ ...newControl, controlQuestion: e.target.value }); if (controlErrors.controlQuestion) setControlErrors((prev) => { const { controlQuestion, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter control question")}
                      className={`mt-1.5 bg-white ${controlErrors.controlQuestion ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {controlErrors.controlQuestion && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{controlErrors.controlQuestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Assignments */}
              {step === 2 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Assignment Details")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-error">*</span></Label>
                      <Select value={newControl.departmentId} onValueChange={(v) => { setNewControl({ ...newControl, departmentId: v, assigneeId: "" }); if (controlErrors.departmentId) setControlErrors((prev) => { const { departmentId, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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
                      <Label className="text-sm font-medium text-slate-700">{t("Assignee")} <span className="text-error">*</span></Label>
                      <Select
                        value={newControl.assigneeId}
                        onValueChange={(v) => { setNewControl({ ...newControl, assigneeId: v }); if (controlErrors.assigneeId) setControlErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; }); }}
                        disabled={!newControl.departmentId}
                      >
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={
                            !newControl.departmentId
                              ? t("Select department first")
                              : t("Select assignee")
                          } />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {getFilteredUsersForAssignee().length > 0 ? (
                            getFilteredUsersForAssignee().map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-2 text-sm text-slate-400 text-center">
                              {t("No department reviewers found")}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {controlErrors.assigneeId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.assigneeId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Review Information")}</h3>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-2">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Domain")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{domains.find(d => d.id === newControl.domainId)?.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 ltr:border-l rtl:border-r border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Functional Grouping")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.functionalGrouping ? t(newControl.functionalGrouping) : "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 col-span-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Control Name")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 col-span-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Description")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.description || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 col-span-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Control Question")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.controlQuestion || "-"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Department")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{departments.find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3 ltr:border-l rtl:border-r border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Assignee")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{users.find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <span className="text-xs font-medium text-slate-400 me-auto">
              {t("Step")} {step} {t("of")} 3
            </span>
            <Button variant="outline" onClick={() => {
              if (step > 1) setStep(step - 1);
              else handleClose();
            }}>
              {step > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
              {step === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button onClick={() => {
              if (step === 1) {
                const errors: Record<string, string> = {};
                if (!newControl.domainId) errors.domainId = t("Please select the Control Domain");
                if (!newControl.name.trim()) errors.name = t("Please enter name");
                if (!newControl.controlQuestion?.trim()) errors.controlQuestion = t("Please enter the question");
                if (!newControl.functionalGrouping) errors.functionalGrouping = t("Please select the Functional Grouping");
                if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                setControlErrors({});
              }
              if (step === 2) {
                const errors: Record<string, string> = {};
                if (!newControl.departmentId) errors.departmentId = t("Please select the Department");
                if (!newControl.assigneeId) errors.assigneeId = t("Please select the assignee");
                if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                setControlErrors({});
              }
              if (step < 3) setStep(step + 1);
              else handleSubmit();
            }} disabled={loading}>
              {step === 3 ? (loading ? t("Creating...") : t("Create")) : t("Next")}
              {step < 3 && <ChevronRight className="h-4 w-4 ms-1" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Domain Dialog */}
      <Dialog open={isCreateDomainDialogOpen} onOpenChange={(open) => { if (!open) { setIsCreateDomainDialogOpen(false); setNewDomain({ code: "", name: "" }); setDomainErrors({}); } else { setIsCreateDomainDialogOpen(true); } }}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Create New Domain")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Domain Code")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newDomain.code}
                onChange={(e) => {
                  setNewDomain({ ...newDomain, code: e.target.value });
                  if (domainErrors.code) setDomainErrors((prev) => { const { code, ...rest } = prev; return rest; });
                }}
                placeholder={t("e.g., GOV")}
                className={`mt-1.5 w-full bg-white ${domainErrors.code ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainErrors.code && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainErrors.code}</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Domain Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newDomain.name}
                onChange={(e) => {
                  setNewDomain({ ...newDomain, name: e.target.value });
                  if (domainErrors.name) setDomainErrors((prev) => { const { name, ...rest } = prev; return rest; });
                }}
                placeholder={t("e.g., Governance")}
                className={`mt-1.5 w-full bg-white ${domainErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainErrors.name && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainErrors.name}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsCreateDomainDialogOpen(false);
              setNewDomain({ code: "", name: "" });
              setDomainErrors({});
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreateDomain} disabled={creatingDomain}>
              {creatingDomain ? t("Creating...") : t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
