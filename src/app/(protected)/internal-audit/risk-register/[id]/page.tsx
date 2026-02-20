"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Home, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
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
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
          <Link href="/internal-audit/risk-register" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/risk-register" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Register")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("View Risk")}</span>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{t("Internal Audit")}</p>
            <h1 className="text-xl sm:text-2xl font-semibold">{t("Risk Details")}</h1>
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
    <div className="space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/internal-audit/risk-register" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/risk-register" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Register")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("View Risk")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/internal-audit/risk-register")}>
            <ArrowLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{t("Internal Audit")}</p>
            <h1 className="text-xl sm:text-2xl font-semibold">{t("Risk Details")} - {risk.riskId}</h1>
          </div>
        </div>
        <Button onClick={() => router.push(`/internal-audit/risk-register/${risk.id}/edit`)}>
          <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Edit")}
        </Button>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">{t("Basic Information")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("Risk ID")}</p>
              <p className="font-medium">{risk.riskId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Risk Name")}</p>
              <p className="font-medium">{risk.riskName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Department")}</p>
              <p className="font-medium">{risk.department?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Category")}</p>
              <p className="font-medium">{risk.category?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Audit Type")}</p>
              <p className="font-medium">{risk.auditType?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Creation Date")}</p>
              <p className="font-medium">{formatDate(risk.creationDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Section/Process")}</p>
              <p className="font-medium">{risk.sectionProcess || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Sub Process")}</p>
              <p className="font-medium">{risk.subProcess || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Activity")}</p>
              <p className="font-medium">{risk.activity || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("Risk Description")}</p>
            <p className="font-medium">{risk.riskDescription || "-"}</p>
          </div>
        </div>

        {/* Inherent Risk Assessment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">{t("Inherent Risk Assessment")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("Likelihood")}</p>
              <p className="font-medium">{risk.inherentLikelihood ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Impact")}</p>
              <p className="font-medium">{risk.inherentImpact ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Inherent Score")}</p>
              <p className="font-medium">{risk.inherentScore ?? "-"}</p>
            </div>
          </div>
        </div>

        {/* Control Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">{t("Control Information")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("Control Description")}</p>
              <p className="font-medium">{risk.controlDescription || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Control Effectiveness")}</p>
              <p className="font-medium">{risk.controlEffectiveness || "-"}</p>
            </div>
          </div>
        </div>

        {/* Residual Risk Assessment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">{t("Residual Risk Assessment")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("Likelihood")}</p>
              <p className="font-medium">{risk.residualLikelihood ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Impact")}</p>
              <p className="font-medium">{risk.residualImpact ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Residual Score")}</p>
              <p className="font-medium">{risk.residualScore ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Risk Level")}</p>
              <div className="mt-1">{getRiskLevelBadge(risk.riskLevel)}</div>
            </div>
          </div>
        </div>

        {/* Status & Comments */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">{t("Status & Comments")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("Status")}</p>
              <div className="mt-1">{getStatusBadge(risk.status)}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("Audit Comment")}</p>
              <p className="font-medium">{risk.auditComment || "-"}</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p>{t("Created")}: {formatDate(risk.createdAt)}</p>
            </div>
            <div>
              <p>{t("Last Updated")}: {formatDate(risk.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
