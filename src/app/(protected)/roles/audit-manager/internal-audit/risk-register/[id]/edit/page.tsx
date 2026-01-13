"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function EditRiskPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [riskId, setRiskId] = useState("");

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);

  // Form data
  const [formData, setFormData] = useState({
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
    creationDate: "",
    auditComment: "",
    status: "Open",
  });

  useEffect(() => {
    fetchReferenceData();
    fetchRisk();
  }, [params.id]);

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

  const fetchRisk = async () => {
    try {
      const response = await fetch(`/api/internal-audit/risks/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setRiskId(data.riskId);
        setFormData({
          riskName: data.riskName || "",
          riskDescription: data.riskDescription || "",
          departmentId: data.departmentId || "",
          sectionProcess: data.sectionProcess || "",
          subProcess: data.subProcess || "",
          activity: data.activity || "",
          categoryId: data.categoryId || "",
          auditTypeId: data.auditTypeId || "",
          inherentLikelihood: data.inherentLikelihood?.toString() || "",
          inherentImpact: data.inherentImpact?.toString() || "",
          controlDescription: data.controlDescription || "",
          controlEffectiveness: data.controlEffectiveness || "",
          residualLikelihood: data.residualLikelihood?.toString() || "",
          residualImpact: data.residualImpact?.toString() || "",
          creationDate: data.creationDate ? data.creationDate.split("T")[0] : "",
          auditComment: data.auditComment || "",
          status: data.status || "Open",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch risk details.",
          variant: "destructive",
        });
        router.push("/internal-audit/risk-register");
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
      toast({
        title: "Error",
        description: "Failed to fetch risk details.",
        variant: "destructive",
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.riskName.trim()) {
      toast({
        title: "Error",
        description: "Risk name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const inherentScore = calculateInherentScore();
      const residualScore = calculateResidualScore();

      const response = await fetch(`/api/internal-audit/risks/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
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
          title: "Success",
          description: "Risk updated successfully.",
        });
        router.push("/internal-audit/risk-register");
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update risk.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update risk:", error);
      toast({
        title: "Error",
        description: "Failed to update risk.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Edit Risk</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/risk-register")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Edit Risk - {riskId}</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-card rounded-lg border p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="riskName">Risk Name *</Label>
                <Input
                  id="riskName"
                  value={formData.riskName}
                  onChange={(e) => setFormData({ ...formData, riskName: e.target.value })}
                  placeholder="Enter risk name"
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select department" />
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
              <div>
                <Label htmlFor="categoryId">Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="auditTypeId">Audit Type</Label>
                <Select
                  value={formData.auditTypeId}
                  onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select audit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {auditTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sectionProcess">Section/Process</Label>
                <Input
                  id="sectionProcess"
                  value={formData.sectionProcess}
                  onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                  placeholder="Enter section/process"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="subProcess">Sub Process</Label>
                <Input
                  id="subProcess"
                  value={formData.subProcess}
                  onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                  placeholder="Enter sub process"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="activity">Activity</Label>
                <Input
                  id="activity"
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder="Enter activity"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="creationDate">Creation Date</Label>
                <Input
                  id="creationDate"
                  type="date"
                  value={formData.creationDate}
                  onChange={(e) => setFormData({ ...formData, creationDate: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="riskDescription">Risk Description</Label>
              <Textarea
                id="riskDescription"
                value={formData.riskDescription}
                onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                placeholder="Enter risk description"
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          {/* Inherent Risk Assessment */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Inherent Risk Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="inherentLikelihood">Likelihood</Label>
                <Select
                  value={formData.inherentLikelihood}
                  onValueChange={(value) => setFormData({ ...formData, inherentLikelihood: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {probabilities.map((prob) => (
                      <SelectItem key={prob.id} value={prob.value.toString()}>
                        {prob.label} ({prob.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inherentImpact">Impact</Label>
                <Select
                  value={formData.inherentImpact}
                  onValueChange={(value) => setFormData({ ...formData, inherentImpact: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {impacts.map((imp) => (
                      <SelectItem key={imp.id} value={imp.value.toString()}>
                        {imp.label} ({imp.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inherent Score</Label>
                <Input
                  value={calculateInherentScore() || "-"}
                  disabled
                  className="mt-2 bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Control Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Control Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="controlDescription">Control Description</Label>
                <Textarea
                  id="controlDescription"
                  value={formData.controlDescription}
                  onChange={(e) => setFormData({ ...formData, controlDescription: e.target.value })}
                  placeholder="Enter control description"
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="controlEffectiveness">Control Effectiveness</Label>
                <Select
                  value={formData.controlEffectiveness}
                  onValueChange={(value) => setFormData({ ...formData, controlEffectiveness: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select effectiveness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Effective">Effective</SelectItem>
                    <SelectItem value="Partially Effective">Partially Effective</SelectItem>
                    <SelectItem value="Ineffective">Ineffective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Residual Risk Assessment */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Residual Risk Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="residualLikelihood">Likelihood</Label>
                <Select
                  value={formData.residualLikelihood}
                  onValueChange={(value) => setFormData({ ...formData, residualLikelihood: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {probabilities.map((prob) => (
                      <SelectItem key={prob.id} value={prob.value.toString()}>
                        {prob.label} ({prob.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="residualImpact">Impact</Label>
                <Select
                  value={formData.residualImpact}
                  onValueChange={(value) => setFormData({ ...formData, residualImpact: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {impacts.map((imp) => (
                      <SelectItem key={imp.id} value={imp.value.toString()}>
                        {imp.label} ({imp.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Residual Score</Label>
                <Input
                  value={calculateResidualScore() || "-"}
                  disabled
                  className="mt-2 bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium border-b pb-2">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="auditComment">Audit Comment</Label>
                <Textarea
                  id="auditComment"
                  value={formData.auditComment}
                  onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                  placeholder="Enter audit comment"
                  className="mt-2"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/internal-audit/risk-register")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
