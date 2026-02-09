"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Upload, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";

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

export default function AddRiskPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchReferenceData();
    fetchNextRiskId();
  }, []);

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
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: Risk Name
    if (!formData.riskName.trim()) {
      toast({
        title: t("Error"),
        description: t("Risk name is required"),
        variant: "destructive",
      });
      return;
    }

    // Validation: Risk Description
    if (!formData.riskDescription.trim()) {
      toast({
        title: t("Error"),
        description: t("Risk description is required"),
        variant: "destructive",
      });
      return;
    }

    // Validation: Inherent Likelihood
    if (!formData.inherentLikelihood) {
      toast({
        title: t("Error"),
        description: t("Inherent likelihood is required"),
        variant: "destructive",
      });
      return;
    }

    // Validation: Inherent Impact
    if (!formData.inherentImpact) {
      toast({
        title: t("Error"),
        description: t("Inherent impact is required"),
        variant: "destructive",
      });
      return;
    }

    // Validation: Residual Likelihood
    if (!formData.residualLikelihood) {
      toast({
        title: t("Error"),
        description: t("Residual likelihood is required"),
        variant: "destructive",
      });
      return;
    }

    // Validation: Residual Impact
    if (!formData.residualImpact) {
      toast({
        title: t("Error"),
        description: t("Residual impact is required"),
        variant: "destructive",
      });
      return;
    }

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
        router.push("/internal-audit/risk-register");
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/internal-audit/risk-register")}
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">{t("Add Risk")}</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/internal-audit/risk-register")}
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">{t("Add Risk")}</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Basic Information")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Risk ID")} <span className="text-slate-400 font-normal text-xs">({t("Auto-generated")})</span>
                </Label>
                <Input
                  id="riskId"
                  value={formData.riskId}
                  onChange={(e) => setFormData({ ...formData, riskId: e.target.value })}
                  placeholder={t("Auto-generated if left empty")}
                  className="mt-1.5 w-full bg-slate-50"
                  disabled
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Risk Name")} <span className="text-red-500">*</span></Label>
                <Input
                  id="riskName"
                  value={formData.riskName}
                  onChange={(e) => setFormData({ ...formData, riskName: e.target.value })}
                  placeholder={t("Enter risk name")}
                  className="mt-1.5 w-full bg-white"
                  required
                />
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
                  id="sectionProcess"
                  value={formData.sectionProcess}
                  onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                  placeholder={t("Enter section/process")}
                  className="mt-1.5 w-full bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Sub Process")}</Label>
                <Input
                  id="subProcess"
                  value={formData.subProcess}
                  onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                  placeholder={t("Enter sub process")}
                  className="mt-1.5 w-full bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Activity")}</Label>
                <Input
                  id="activity"
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder={t("Enter activity")}
                  className="mt-1.5 w-full bg-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Risk Description")} <span className="text-red-500">*</span></Label>
              <Textarea
                id="riskDescription"
                value={formData.riskDescription}
                onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                placeholder={t("Enter risk description")}
                className="mt-1.5 w-full bg-white"
                rows={3}
                required
              />
            </div>
          </div>

          {/* Inherent Risk Assessment */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Inherent Risk Assessment")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.inherentLikelihood}
                  onValueChange={(value) => setFormData({ ...formData, inherentLikelihood: value })}
                  required
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
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
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.inherentImpact}
                  onValueChange={(value) => setFormData({ ...formData, inherentImpact: value })}
                  required
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
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
              </div>
            </div>
          </div>

          {/* Control Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Control Information")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Control Description")}</Label>
                <Textarea
                  id="controlDescription"
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
            <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Residual Risk Assessment")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.residualLikelihood}
                  onValueChange={(value) => setFormData({ ...formData, residualLikelihood: value })}
                  required
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
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
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.residualImpact}
                  onValueChange={(value) => setFormData({ ...formData, residualImpact: value })}
                  required
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
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
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Additional Information")}</h3>
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
                  id="auditComment"
                  value={formData.auditComment}
                  onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                  placeholder={t("Enter audit comment")}
                  className="mt-1.5 w-full bg-white"
                  rows={2}
                />
              </div>
            </div>

            {/* File Upload Section */}
            <div className="mt-4">
              <Label className="text-sm font-medium text-slate-700">{t("Attachments")}</Label>
              <div
                className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragOver ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                    <p className="text-slate-500 text-sm">{t("Uploading...")}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-slate-600 text-sm font-medium">{t("Drag and drop files here")}</p>
                    <p className="text-slate-400 text-xs mt-1">{t("or click to browse")}</p>
                    <p className="text-slate-400 text-xs mt-2">
                      {t("Supported: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG")}
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  multiple
                />
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{file.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/internal-audit/risk-register")}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
