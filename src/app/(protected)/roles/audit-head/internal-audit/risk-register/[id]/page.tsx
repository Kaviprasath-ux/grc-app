"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  sectionProcess: string | null;
  subProcess: string | null;
  activity: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  auditTypeId: string | null;
  auditType: { id: string; name: string } | null;
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentScore: number | null;
  controlDescription: string | null;
  controlEffectiveness: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  creationDate: string;
  auditComment: string | null;
  status: string;
  evidenceFilePath: string | null;
  evidenceFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ViewRiskPage() {
  const router = useRouter();
  const params = useParams();
  const [risk, setRisk] = useState<InternalAuditRisk | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRisk();
  }, [params.id]);

  const fetchRisk = async () => {
    try {
      const response = await fetch(`/api/internal-audit/risks/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
      } else {
        router.push("/internal-audit/risk-register");
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
      router.push("/internal-audit/risk-register");
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return null;

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Low: "secondary",
      Medium: "default",
      High: "destructive",
      Extreme: "destructive",
    };

    return <Badge variant={variants[level] || "outline"}>{level}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Open: "default",
      Closed: "secondary",
      "Under Review": "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
            <h1 className="text-2xl font-semibold">Risk Details</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!risk) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/risk-register")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Risk Details - {risk.riskId}</h1>
          </div>
        </div>
        <Button onClick={() => router.push(`/internal-audit/risk-register/${risk.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Risk ID</p>
              <p className="font-medium">{risk.riskId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Name</p>
              <p className="font-medium">{risk.riskName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{risk.department?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{risk.category?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Audit Type</p>
              <p className="font-medium">{risk.auditType?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Creation Date</p>
              <p className="font-medium">{formatDate(risk.creationDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Section/Process</p>
              <p className="font-medium">{risk.sectionProcess || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sub Process</p>
              <p className="font-medium">{risk.subProcess || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activity</p>
              <p className="font-medium">{risk.activity || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Risk Description</p>
            <p className="font-medium">{risk.riskDescription || "-"}</p>
          </div>
        </div>

        {/* Inherent Risk Assessment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Inherent Risk Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Likelihood</p>
              <p className="font-medium">{risk.inherentLikelihood ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impact</p>
              <p className="font-medium">{risk.inherentImpact ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inherent Score</p>
              <p className="font-medium">{risk.inherentScore ?? "-"}</p>
            </div>
          </div>
        </div>

        {/* Control Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Control Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Control Description</p>
              <p className="font-medium">{risk.controlDescription || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Control Effectiveness</p>
              <p className="font-medium">{risk.controlEffectiveness || "-"}</p>
            </div>
          </div>
        </div>

        {/* Residual Risk Assessment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Residual Risk Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Likelihood</p>
              <p className="font-medium">{risk.residualLikelihood ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impact</p>
              <p className="font-medium">{risk.residualImpact ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Residual Score</p>
              <p className="font-medium">{risk.residualScore ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <div className="mt-1">{getRiskLevelBadge(risk.riskLevel)}</div>
            </div>
          </div>
        </div>

        {/* Status & Comments */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Status & Comments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">{getStatusBadge(risk.status)}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Audit Comment</p>
              <p className="font-medium">{risk.auditComment || "-"}</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p>Created: {formatDate(risk.createdAt)}</p>
            </div>
            <div>
              <p>Last Updated: {formatDate(risk.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
