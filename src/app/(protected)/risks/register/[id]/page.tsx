"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedRecord } from "@/hooks/useTranslatedData";
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  riskRating: string;
  riskScore: number;
  likelihood: number;
  impact: number;
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentRiskScore: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualRiskScore: number | null;
  status: string;
  assessmentStatus: string | null;
  responseStatus: string | null;
  responseStrategy: string | null;
  lastAssessmentDate: string | null;
  nextReviewDate: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string } | null;
  impactedAsset: { id: string; assetId: string; name: string } | null;
  impactedProcess: { id: string; processCode: string; name: string } | null;
  threats: { threat: { id: string; name: string } }[];
  vulnerabilities: { vulnerability: { id: string; name: string } }[];
  controlRisks: {
    control: { id: string; controlCode: string; name: string; description: string | null };
    controlStrength: { id: string; name: string; score: number } | null;
  }[];
  assessmentFormData: string | null;
}

// Donut chart component for Likelihood / Impact / Vulnerability
function DonutChart({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-800">{value}</span>
        </div>
      </div>
    </div>
  );
}

// Speedometer chart with colored zone arcs, needle, score, rating badge, and legend
function SpeedometerChart({
  score, maxScore, rating, label, riskRanges,
}: {
  score: number; maxScore: number; rating: string; label: string;
  riskRanges: { name: string; lowRange: number; highRange: number; color: string }[];
}) {
  const defaultZoneColors = ["#22c55e", "#2563eb", "#1e293b", "#dc2626"];
  const zones = riskRanges.length > 0
    ? riskRanges.map((range, i) => {
        const total = riskRanges.length;
        return {
          startAngle: 180 - (i * 180 / total),
          endAngle: 180 - ((i + 1) * 180 / total),
          color: range.color || defaultZoneColors[i % defaultZoneColors.length],
        };
      })
    : defaultZoneColors.map((color, i) => ({
        startAngle: 180 - (i * 45),
        endAngle: 180 - ((i + 1) * 45),
        color,
      }));

  const pct = Math.min(Math.max(score / (maxScore || 125), 0), 1);
  const needleAngle = Math.PI * (1 - pct);
  const nx = 100 + 60 * Math.cos(needleAngle);
  const ny = 100 - 60 * Math.sin(needleAngle);
  const arcPt = (deg: number) => ({
    x: 100 + 70 * Math.cos(deg * Math.PI / 180),
    y: 100 - 70 * Math.sin(deg * Math.PI / 180),
  });

  const getRatingBgColor = (r: string) => {
    const lower = (r || "").toLowerCase();
    if (lower.includes("catastroph") || lower.includes("critical")) return "bg-red-100 text-red-800";
    if (lower.includes("very high")) return "bg-orange-100 text-orange-800";
    if (lower.includes("high")) return "bg-amber-100 text-amber-800";
    if (lower.includes("medium")) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-primary-700 mb-2">{label}</h4>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 130" className="w-52 h-auto">
          {zones.map((zone, i) => {
            const start = arcPt(zone.startAngle);
            const end = arcPt(zone.endAngle);
            return (
              <path
                key={i}
                d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A 70 70 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
                stroke={zone.color}
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          <line x1="100" y1="100" x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="100" r="5" fill="#1e293b" />
          <circle cx="100" cy="100" r="2" fill="white" />
          <text x="100" y="122" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">{score.toFixed(1)}</text>
        </svg>
        <span className={cn("inline-block px-4 py-1 rounded-full text-xs font-semibold -mt-1", getRatingBgColor(rating))}>
          {rating}
        </span>
        {/* Legend */}
        {riskRanges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {riskRanges.map((range, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: range.color || defaultZoneColors[i % defaultZoneColors.length] }} />
                <span className="text-[10px] text-slate-500">{range.name} ({range.lowRange}-{range.highRange})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RiskDetailPage() {
  const params = useParams();
  const { t, isRTL } = useLanguage();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [riskRanges, setRiskRanges] = useState<{ name: string; lowRange: number; highRange: number; color: string }[]>([]);
  const [likelihoodOptions, setLikelihoodOptions] = useState<{ id: string; title: string; score: number }[]>([]);

  const { data: translatedRisk } = useTranslatedRecord(risk, { modelName: 'Risk' });

  useEffect(() => {
    if (params.id) {
      fetchRisk(params.id as string);
      fetch("/api/risk-ranges").then(r => r.ok ? r.json() : []).then(setRiskRanges).catch(() => {});
      fetch("/api/risk-likelihoods").then(r => r.ok ? r.json() : []).then(setLikelihoodOptions).catch(() => {});
    }
  }, [params.id]);

  const fetchRisk = async (id: string) => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating: string) => {
    const lower = (rating || "").toLowerCase();
    if (lower.includes("catastroph") || lower.includes("critical")) return "bg-red-100 text-red-700 border-red-200";
    if (lower.includes("very high")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (lower.includes("high")) return "bg-amber-100 text-amber-700 border-amber-200";
    if (lower.includes("medium") || lower.includes("likely")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const getLikelihoodLabel = (score: number) => {
    const found = likelihoodOptions.find(l => l.score === score);
    return found?.title || `Score ${score}`;
  };

  const getImpactLabel = (score: number) => {
    if (score >= 5) return "Catastrophic";
    if (score >= 4) return "High";
    if (score >= 3) return "Medium";
    if (score >= 2) return "Low";
    return "Negligible";
  };

  const getVulnerabilityLabel = (score: number) => {
    if (score >= 4) return "Critical";
    if (score >= 3) return "High";
    if (score >= 2) return "Medium";
    return "Low";
  };

  // Compute vulnerability factor average from assessment form data
  const vulnerabilityAvg = useMemo(() => {
    if (!risk?.assessmentFormData) return 0;
    try {
      const formData = JSON.parse(risk.assessmentFormData);
      const vulnRatings = formData.vulnerabilityRatings as Record<string, number> | undefined;
      if (!vulnRatings) return 0;
      const values = Object.values(vulnRatings).filter(v => v > 0);
      if (values.length === 0) return 0;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    } catch {
      return 0;
    }
  }, [risk?.assessmentFormData]);

  // Control rating from linked controls
  const controlRating = useMemo(() => {
    if (!risk?.controlRisks?.length) return null;
    const total = risk.controlRisks.reduce((sum, cr) => sum + (cr.controlStrength?.score || 0), 0);
    return (total / risk.controlRisks.length).toFixed(1);
  }, [risk?.controlRisks]);

  // Total control strength for residual calculation
  const totalControlStrength = useMemo(() => {
    if (!risk?.controlRisks?.length) return 0;
    return risk.controlRisks.reduce((sum, cr) => sum + (cr.controlStrength?.score || 0), 0);
  }, [risk?.controlRisks]);

  // Inherent = likelihood * impact * vulnerability (same formula as assessment wizard)
  // Residual = inherent / totalControlStrength
  const inherentScore = useMemo(() => {
    if (!risk) return 0;
    return risk.likelihood * risk.impact * (vulnerabilityAvg || 1);
  }, [risk, vulnerabilityAvg]);

  const residualScore = useMemo(() => {
    if (totalControlStrength > 0) {
      return Math.round((inherentScore / totalControlStrength) * 100) / 100;
    }
    return inherentScore;
  }, [inherentScore, totalControlStrength]);

  const gaugeMax = riskRanges.length > 0 ? Math.max(...riskRanges.map(r => r.highRange)) : 125;

  // Get rating from risk ranges
  const getRatingFromScore = (score: number) => {
    for (const range of riskRanges) {
      if (score >= range.lowRange && score <= range.highRange) return range.name;
    }
    if (score >= 100) return "Catastrophic";
    if (score >= 50) return "Very high";
    if (score >= 25) return "High";
    if (score >= 10) return "Medium";
    return "Low";
  };

  const inherentRating = getRatingFromScore(inherentScore);
  const residualRating = getRatingFromScore(residualScore);

  const totalSlides = 4;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">{t("Risk not found")}</p>
      </div>
    );
  }

  const displayRisk = translatedRisk || risk;

  // Carousel slides
  const slides = [
    // Slide 1: Risk Overview
    <div key="overview" className="space-y-6">
      <h3 className="text-lg font-bold text-primary-700">{t("Risk Overview")}</h3>
      {/* Risk name + description */}
      <div className="bg-slate-50 rounded-xl p-5">
        <p className="text-sm font-semibold text-primary-700">{risk.riskId}:{displayRisk.name}</p>
        <p className="text-sm text-slate-600 mt-1">{displayRisk.description || "-"}</p>
      </div>

      {/* Assets table */}
      <div className="bg-slate-50 rounded-xl p-5">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1a1f4e] text-white">
                <th className="px-4 py-2.5 text-left text-xs font-semibold">{t("Asset ID")}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold">{t("Name")}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold">{t("AssetValueScore")}</th>
              </tr>
            </thead>
            <tbody>
              {risk.impactedAsset ? (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-sm text-slate-700">{risk.impactedAsset.assetId}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-700">{risk.impactedAsset.name}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-700">-</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-sm text-slate-400">{t("No Data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Threats & Vulnerabilities */}
        <div className="mt-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-primary-700">{t("Potential Threat")}</p>
            {risk.threats?.length > 0 ? (
              risk.threats.map(th => (
                <p key={th.threat.id} className="text-sm text-slate-600">{th.threat.name}</p>
              ))
            ) : (
              <p className="text-sm text-slate-400">-</p>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-700">{t("Associated Vulnerabilities")}</p>
            {risk.vulnerabilities?.length > 0 ? (
              risk.vulnerabilities.map(v => (
                <p key={v.vulnerability.id} className="text-sm text-slate-600">{v.vulnerability.name}</p>
              ))
            ) : (
              <p className="text-sm text-slate-400">-</p>
            )}
          </div>
        </div>
      </div>
    </div>,

    // Slide 2: Risk Context - Gauges
    <div key="context-gauges" className="space-y-6">
      <h3 className="text-lg font-bold text-primary-700">{t("Risk Context")}</h3>
      {/* Risk score gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpeedometerChart
          score={residualScore}
          maxScore={gaugeMax}
          rating={residualRating}
          label={t("Residual Risk Rating")}
          riskRanges={riskRanges}
        />
        <SpeedometerChart
          score={inherentScore}
          maxScore={gaugeMax}
          rating={inherentRating}
          label={t("Inherent Risk Rating")}
          riskRanges={riskRanges}
        />
      </div>

      {/* Likelihood / Impact / Vulnerability donut charts */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2">
            <DonutChart
              value={risk.likelihood || 0}
              max={5}
              color="#dc2626"
              label={t("Likelihood")}
            />
            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", getRatingColor(getLikelihoodLabel(risk.likelihood)))}>
              {getLikelihoodLabel(risk.likelihood)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <DonutChart
              value={risk.impact || 0}
              max={5}
              color="#dc2626"
              label={t("Impact")}
            />
            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", getRatingColor(getImpactLabel(risk.impact)))}>
              {getImpactLabel(risk.impact)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <DonutChart
              value={vulnerabilityAvg}
              max={5}
              color="#dc2626"
              label={t("Vulnerability Factor")}
            />
            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", getRatingColor(getVulnerabilityLabel(vulnerabilityAvg)))}>
              {getVulnerabilityLabel(vulnerabilityAvg)}
            </span>
          </div>
        </div>
      </div>
    </div>,

    // Slide 3: Risk Context - Details grid
    <div key="context-details" className="space-y-6">
      <h3 className="text-lg font-bold text-primary-700">{t("Risk Context")}</h3>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Category")}</p>
            <p className="text-sm text-slate-700">{risk.category?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Owner")}</p>
            <p className="text-sm text-slate-700">{risk.owner?.fullName || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Sources")}</p>
            <p className="text-sm text-slate-700">{risk.riskSources || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Likelihood")}</p>
            <p className="text-sm text-slate-700">{getLikelihoodLabel(risk.likelihood)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Impact")}</p>
            <p className="text-sm text-slate-700">{getImpactLabel(risk.impact)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Inherent Risk Rating")}</p>
            <p className="text-sm text-slate-700">{inherentScore.toFixed(2)}{inherentRating ? ` (${inherentRating})` : ""}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Response Strategy")}</p>
            <p className="text-sm text-slate-700">{risk.responseStrategy || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Residual Risk Rating")}</p>
            <p className="text-sm text-slate-700">{residualScore.toFixed(2)}{residualRating ? ` (${residualRating})` : ""}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Control Rating")}</p>
            <p className="text-sm text-slate-700">{controlRating || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Status")}</p>
            <p className="text-sm text-slate-700">{risk.assessmentStatus || risk.status || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Assessment Date")}</p>
            <p className="text-sm text-slate-700">{risk.lastAssessmentDate ? new Date(risk.lastAssessmentDate).toLocaleDateString() : "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Next Review Date")}</p>
            <p className="text-sm text-slate-700">{risk.nextReviewDate ? new Date(risk.nextReviewDate).toLocaleDateString() : "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-700">{t("Risk Type")}</p>
            <p className="text-sm text-slate-700">{risk.type?.name || "-"}</p>
          </div>
        </div>
      </div>
    </div>,

    // Slide 4: Controls
    <div key="controls" className="space-y-6">
      <div className="inline-block bg-primary-700 text-white text-sm font-semibold px-4 py-1.5 rounded">
        {t("Controls")}
      </div>
      <div className="bg-slate-50 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-primary-700">{t("Controls")}</h4>
        {risk.controlRisks?.length > 0 ? (
          risk.controlRisks.map((cr) => (
            <div key={cr.control.id} className="bg-white rounded-lg border border-primary-200 p-4">
              <p className="text-sm font-semibold text-primary-700">
                {cr.control.controlCode} : {cr.control.name}
              </p>
              {cr.control.description && (
                <p className="text-sm text-slate-600 mt-1">{cr.control.description}</p>
              )}
              {cr.controlStrength && (
                <p className="text-xs text-slate-500 mt-1">{t("Strength")}: {cr.controlStrength.name} ({cr.controlStrength.score})</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">{t("No controls linked")}</p>
        )}
      </div>
    </div>,
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className={cn("flex items-center gap-1.5 text-sm", isRTL && "flex-row-reverse")}>
        <Link href="/risks/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-primary-600">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </Link>
        <ChevronRight className={cn("h-3.5 w-3.5 text-slate-300", isRTL && "rotate-180")} />
        <Link href="/risks/register" className="text-slate-500 hover:text-primary-600">
          {t("Risk Register")}
        </Link>
        <ChevronRight className={cn("h-3.5 w-3.5 text-slate-300", isRTL && "rotate-180")} />
        <span className="text-primary-700 font-medium">{risk.riskId}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{risk.riskId}: {displayRisk.name}</h1>
        <span className={cn("text-xs px-3 py-1 rounded-full border font-medium", getRatingColor(risk.riskRating))}>
          {risk.riskRating}
        </span>
      </div>

      {/* Carousel content */}
      <div className="min-h-[450px]">
        {slides[currentSlide]}
      </div>

      {/* Carousel navigation */}
      <div className={cn("flex items-center justify-center gap-3", isRTL && "flex-row-reverse")}>
        <button
          onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          className="text-primary-600 disabled:text-slate-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={cn(
              "w-3 h-3 rounded-full border-2 transition-colors",
              currentSlide === i
                ? "bg-primary-600 border-primary-600"
                : "bg-white border-slate-300 hover:border-primary-400"
            )}
          />
        ))}
        <button
          onClick={() => setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1))}
          disabled={currentSlide === totalSlides - 1}
          className="text-primary-600 disabled:text-slate-300"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
