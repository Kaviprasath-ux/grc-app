"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Upload, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Department {
  id: string;
  name: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface AuditType {
  id: string;
  name: string;
}

interface Probability {
  id: string;
  label: string;
  value: number;
}

interface Impact {
  id: string;
  label: string;
  value: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface AddRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddRiskDialog({ open, onOpenChange, onSuccess }: AddRiskDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);

  // File upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    riskId: "",
    riskName: "",
    riskDescription: "",
    departmentId: "",
    sectionProcess: "",
    subProcess: "",
    activity: "",
    categoryId: "",
    auditTypeId: "",
    inherentLikelihood: "",
    inherentImpact: "",
    controlDescription: "",
    controlEffectiveness: "",
    residualLikelihood: "",
    residualImpact: "",
    creationDate: new Date().toISOString().split("T")[0],
    auditComment: "",
    status: "Open",
  });

  // Field errors state
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (open) {
      fetchReferenceData();
      fetchNextRiskId();
    }
  }, [open]);

  const fetchNextRiskId = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/next-id");
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, riskId: data.nextRiskId }));
      }
    } catch (error) {
      console.error("Failed to fetch next risk ID:", error);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [deptRes, catRes, typeRes, probRes, impactRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/internal-audit/categories"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (typeRes.ok) setAuditTypes(await typeRes.json());
      if (probRes.ok) setProbabilities(await probRes.json());
      if (impactRes.ok) setImpacts(await impactRes.json());
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
    }
  };

  const calculateInherentScore = () => {
    const likelihood = formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : 0;
    const impact = formData.inherentImpact ? parseInt(formData.inherentImpact) : 0;
    return likelihood * impact;
  };

  const calculateResidualScore = () => {
    const likelihood = formData.residualLikelihood ? parseInt(formData.residualLikelihood) : 0;
    const impact = formData.residualImpact ? parseInt(formData.residualImpact) : 0;
    return likelihood * impact;
  };

  // File upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFiles(Array.from(files));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: uploadData.file.id || Date.now().toString(),
              name: file.name,
              size: file.size,
              type: file.type,
            },
          ]);
        } else {
          toast({
            title: t("Error"),
            description: `${t("Failed to upload")} ${file.name}`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: t("Error"),
        description: t("Failed to upload files"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const resetForm = () => {
    setFormData({
      riskId: "",
      riskName: "",
      riskDescription: "",
      departmentId: "",
      sectionProcess: "",
      subProcess: "",
      activity: "",
      categoryId: "",
      auditTypeId: "",
      inherentLikelihood: "",
      inherentImpact: "",
      controlDescription: "",
      controlEffectiveness: "",
      residualLikelihood: "",
      residualImpact: "",
      creationDate: new Date().toISOString().split("T")[0],
      auditComment: "",
      status: "Open",
    });
    setFieldErrors({});
    setUploadedFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Risk Name
    if (!formData.riskName.trim()) {
      errors.riskName = t("Risk name is required");
    }

    // Validation: Risk Description
    if (!formData.riskDescription.trim()) {
      errors.riskDescription = t("Risk description is required");
    }

    // Validation: Inherent Likelihood
    if (!formData.inherentLikelihood) {
      errors.inherentLikelihood = t("Inherent likelihood is required");
    }

    // Validation: Inherent Impact
    if (!formData.inherentImpact) {
      errors.inherentImpact = t("Inherent impact is required");
    }

    // Validation: Residual Likelihood
    if (!formData.residualLikelihood) {
      errors.residualLikelihood = t("Residual likelihood is required");
    }

    // Validation: Residual Impact
    if (!formData.residualImpact) {
      errors.residualImpact = t("Residual impact is required");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});
    setSaving(true);

    try {
      const inherentScore = calculateInherentScore();
      const residualScore = calculateResidualScore();

      const response = await fetch("/api/internal-audit/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          riskId: formData.riskId || null,
          inherentLikelihood: formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : null,
          inherentImpact: formData.inherentImpact ? parseInt(formData.inherentImpact) : null,
          inherentScore: inherentScore || null,
          residualLikelihood: formData.residualLikelihood ? parseInt(formData.residualLikelihood) : null,
          residualImpact: formData.residualImpact ? parseInt(formData.residualImpact) : null,
          residualScore: residualScore || null,
          departmentId: formData.departmentId || null,
          categoryId: formData.categoryId || null,
          auditTypeId: formData.auditTypeId || null,
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Risk created successfully."),
        });
        resetForm();
        onSuccess();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to create risk."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create risk:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create risk."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t("Add Risk")}</DialogTitle>
          <DialogDescription>
            {t("Fill in the details below to add a new risk to the register.")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
                {t("Basic Information")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Risk ID")} <span className="text-slate-400 font-normal text-xs">({t("Auto-generated")})</span>
                  </Label>
                  <Input
                    value={formData.riskId}
                    onChange={(e) => setFormData({ ...formData, riskId: e.target.value })}
                    placeholder={t("Auto-generated if left empty")}
                    className="mt-1.5 w-full bg-slate-50"
                    disabled
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Risk Name")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.riskName}
                    onChange={(e) => {
                      setFormData({ ...formData, riskName: e.target.value });
                      if (fieldErrors.riskName) {
                        setFieldErrors({ ...fieldErrors, riskName: "" });
                      }
                    }}
                    placeholder={t("Enter risk name")}
                    className={`mt-1.5 w-full bg-white ${fieldErrors.riskName ? "border-red-500" : ""}`}
                  />
                  {fieldErrors.riskName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.riskName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Audit Type")}</Label>
                  <Select
                    value={formData.auditTypeId}
                    onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select audit type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {auditTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Section/Process")}</Label>
                  <Input
                    value={formData.sectionProcess}
                    onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                    placeholder={t("Enter section/process")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Sub Process")}</Label>
                  <Input
                    value={formData.subProcess}
                    onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                    placeholder={t("Enter sub process")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Activity")}</Label>
                  <Input
                    value={formData.activity}
                    onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                    placeholder={t("Enter activity")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Risk Description")} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={formData.riskDescription}
                  onChange={(e) => {
                    setFormData({ ...formData, riskDescription: e.target.value });
                    if (fieldErrors.riskDescription) {
                      setFieldErrors({ ...fieldErrors, riskDescription: "" });
                    }
                  }}
                  placeholder={t("Enter risk description")}
                  className={`mt-1.5 w-full bg-white ${fieldErrors.riskDescription ? "border-red-500" : ""}`}
                  rows={3}
                />
                {fieldErrors.riskDescription && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.riskDescription}</p>
                )}
              </div>
            </div>

            {/* Inherent Risk Assessment */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
                {t("Inherent Risk Assessment")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Likelihood")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.inherentLikelihood}
                    onValueChange={(value) => {
                      setFormData({ ...formData, inherentLikelihood: value });
                      if (fieldErrors.inherentLikelihood) {
                        setFieldErrors({ ...fieldErrors, inherentLikelihood: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentLikelihood ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select likelihood")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {probabilities.map((prob) => (
                        <SelectItem key={prob.id} value={prob.value.toString()}>
                          {prob.label} ({prob.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.inherentLikelihood && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentLikelihood}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Impact")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.inherentImpact}
                    onValueChange={(value) => {
                      setFormData({ ...formData, inherentImpact: value });
                      if (fieldErrors.inherentImpact) {
                        setFieldErrors({ ...fieldErrors, inherentImpact: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentImpact ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select impact")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {impacts.map((imp) => (
                        <SelectItem key={imp.id} value={imp.value.toString()}>
                          {imp.label} ({imp.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.inherentImpact && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentImpact}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Control Information */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
                {t("Control Information")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Control Description")}</Label>
                  <Textarea
                    value={formData.controlDescription}
                    onChange={(e) => setFormData({ ...formData, controlDescription: e.target.value })}
                    placeholder={t("Enter control description")}
                    className="mt-1.5 w-full bg-white"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Control Effectiveness")}</Label>
                  <Select
                    value={formData.controlEffectiveness}
                    onValueChange={(value) => setFormData({ ...formData, controlEffectiveness: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select effectiveness")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Effective">{t("Effective")}</SelectItem>
                      <SelectItem value="Partially Effective">{t("Partially Effective")}</SelectItem>
                      <SelectItem value="Ineffective">{t("Ineffective")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Residual Risk Assessment */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
                {t("Residual Risk Assessment")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Likelihood")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.residualLikelihood}
                    onValueChange={(value) => {
                      setFormData({ ...formData, residualLikelihood: value });
                      if (fieldErrors.residualLikelihood) {
                        setFieldErrors({ ...fieldErrors, residualLikelihood: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualLikelihood ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select likelihood")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {probabilities.map((prob) => (
                        <SelectItem key={prob.id} value={prob.value.toString()}>
                          {prob.label} ({prob.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.residualLikelihood && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.residualLikelihood}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Impact")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.residualImpact}
                    onValueChange={(value) => {
                      setFormData({ ...formData, residualImpact: value });
                      if (fieldErrors.residualImpact) {
                        setFieldErrors({ ...fieldErrors, residualImpact: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualImpact ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select impact")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {impacts.map((imp) => (
                        <SelectItem key={imp.id} value={imp.value.toString()}>
                          {imp.label} ({imp.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.residualImpact && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.residualImpact}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
                {t("Additional Information")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Creation Date")}</Label>
                  <DatePicker
                    value={formData.creationDate}
                    onChange={(date) => setFormData({ ...formData, creationDate: date ? date.toISOString().split('T')[0] : "" })}
                    placeholder={t("Select date")}
                    className="mt-1.5 w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Open">{t("Open")}</SelectItem>
                      <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                      <SelectItem value="Closed">{t("Closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Audit Comment")}</Label>
                  <Textarea
                    value={formData.auditComment}
                    onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                    placeholder={t("Enter audit comment")}
                    className="mt-1.5 w-full bg-white"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Saving...") : t("Save")}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
