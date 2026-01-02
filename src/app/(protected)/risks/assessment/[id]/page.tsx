"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  category: { id: string; name: string } | null;
  owner: { id: string; fullName: string } | null;
  type: { id: string; name: string } | null;
  assessmentStatus: string;
  threats?: { threat: { id: string; name: string } }[];
  vulnerabilities?: { vulnerability: { id: string; name: string } }[];
  riskSources?: string | null;
}

interface Threat {
  id: string;
  name: string;
}

interface Vulnerability {
  id: string;
  name: string;
}

interface RiskLikelihood {
  id: string;
  title: string;
  score: number;
  timeFrame?: string;
  probability?: string;
}

interface ImpactCategory {
  id: string;
  name: string;
  description?: string;
}

interface ImpactRating {
  id: string;
  name: string;
  score: number;
  description?: string;
}

interface VulnerabilityRating {
  id: string;
  label: string;
  score: number;
}

interface RiskRange {
  id: string;
  title: string;
  lowRange: number;
  highRange: number;
  color: string;
}

const assessmentSteps = [
  { id: 1, name: "Risk Context" },
  { id: 2, name: "Likelihood" },
  { id: 3, name: "Impact" },
  { id: 4, name: "Vulnerability" },
  { id: 5, name: "Risk Rating" },
  { id: 6, name: "Risk Summary" },
];

export default function RiskAssessmentWizardPage() {
  const params = useParams();
  const router = useRouter();
  const riskId = params.id as string;

  const [risk, setRisk] = useState<Risk | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  // Risk Settings data (dynamic from APIs)
  const [likelihoodOptions, setLikelihoodOptions] = useState<RiskLikelihood[]>([]);
  const [impactCategories, setImpactCategories] = useState<ImpactCategory[]>([]);
  const [impactRatings, setImpactRatings] = useState<ImpactRating[]>([]);
  const [vulnerabilityRatings, setVulnerabilityRatingsOptions] = useState<VulnerabilityRating[]>([]);
  const [riskRanges, setRiskRanges] = useState<RiskRange[]>([]);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Assessment form data
  const [threatLikelihoods, setThreatLikelihoods] = useState<Record<string, number>>({});
  const [threatImpacts, setThreatImpacts] = useState<Record<string, Record<string, number>>>({});
  const [vulnerabilityRatingsForm, setVulnerabilityRatingsForm] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, [riskId]);

  // Set status to "In-Progress" when the assessment page loads (if not already completed)
  useEffect(() => {
    if (risk && risk.assessmentStatus !== "Completed" && risk.assessmentStatus !== "In-Progress") {
      updateAssessmentStatus("In-Progress");
    }
  }, [risk?.id]);

  const updateAssessmentStatus = async (newStatus: string) => {
    if (!risk) return;
    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: newStatus,
        }),
      });
    } catch (error) {
      console.error("Failed to update assessment status:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [
        riskRes, threatsRes, vulnsRes,
        likelihoodsRes, impactCatsRes, impactRatingsRes, vulnRatingsRes, riskRangesRes
      ] = await Promise.all([
        fetch(`/api/risks/${riskId}`),
        fetch("/api/risk-threats"),
        fetch("/api/risk-vulnerabilities"),
        fetch("/api/risk-likelihoods"),
        fetch("/api/impact-categories"),
        fetch("/api/impact-ratings"),
        fetch("/api/vulnerability-ratings"),
        fetch("/api/risk-ranges"),
      ]);

      if (riskRes.ok) {
        const data = await riskRes.json();
        setRisk(data);
      }
      if (threatsRes.ok) {
        const data = await threatsRes.json();
        setThreats(data);
      }
      if (vulnsRes.ok) {
        const data = await vulnsRes.json();
        setVulnerabilities(data);
      }
      if (likelihoodsRes.ok) {
        const data = await likelihoodsRes.json();
        setLikelihoodOptions(data);
      }
      if (impactCatsRes.ok) {
        const data = await impactCatsRes.json();
        setImpactCategories(data);
      }
      if (impactRatingsRes.ok) {
        const data = await impactRatingsRes.json();
        setImpactRatings(data);
      }
      if (vulnRatingsRes.ok) {
        const data = await vulnRatingsRes.json();
        setVulnerabilityRatingsOptions(data);
      }
      if (riskRangesRes.ok) {
        const data = await riskRangesRes.json();
        setRiskRanges(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskRatingFromScore = (score: number): string => {
    if (riskRanges.length === 0) {
      if (score >= 100) return "Catastrophic";
      if (score >= 51) return "Very High";
      if (score >= 11) return "High";
      return "Low Risk";
    }
    const matchingRange = riskRanges.find(
      range => score >= range.lowRange && score <= range.highRange
    );
    return matchingRange?.title || "Unknown";
  };

  const handleNext = () => {
    if (currentStep < assessmentSteps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!risk) return;

    const likelihoodValues = Object.values(threatLikelihoods);
    const avgLikelihood = likelihoodValues.length > 0
      ? likelihoodValues.reduce((a, b) => a + b, 0) / likelihoodValues.length
      : 0;

    let maxImpact = 0;
    Object.values(threatImpacts).forEach((categories) => {
      const categoryMax = Math.max(...Object.values(categories), 0);
      if (categoryMax > maxImpact) maxImpact = categoryMax;
    });

    const vulnerabilityValues = Object.values(vulnerabilityRatingsForm);
    const avgVulnerability = vulnerabilityValues.length > 0
      ? vulnerabilityValues.reduce((a, b) => a + b, 0) / vulnerabilityValues.length
      : 0;

    const riskScore = avgLikelihood * maxImpact * (avgVulnerability / 10);
    const riskRating = getRiskRatingFromScore(riskScore);

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihood: Math.round(avgLikelihood),
          impact: Math.round(maxImpact),
          riskRating,
          assessmentStatus: "Completed",
          lastAssessmentDate: new Date().toISOString(),
        }),
      });

      router.push("/risks/assessment");
    } catch (error) {
      console.error("Failed to save assessment:", error);
    }
  };

  const riskThreats = risk?.threats?.map((t) => t.threat) || threats.slice(0, 4);
  const riskVulnerabilities = risk?.vulnerabilities?.map((v) => v.vulnerability) || vulnerabilities.slice(0, 3);

  // Calculate current scores for display
  const calcLikelihood = Object.values(threatLikelihoods).length > 0
    ? Math.round(Object.values(threatLikelihoods).reduce((a, b) => a + b, 0) / Object.values(threatLikelihoods).length)
    : 0;

  let calcImpact = 0;
  Object.values(threatImpacts).forEach((categories) => {
    const categoryMax = Math.max(...Object.values(categories), 0);
    if (categoryMax > calcImpact) calcImpact = categoryMax;
  });

  const calcVulnerability = Object.values(vulnerabilityRatingsForm).length > 0
    ? Math.round(Object.values(vulnerabilityRatingsForm).reduce((a, b) => a + b, 0) / Object.values(vulnerabilityRatingsForm).length)
    : 0;

  const riskScore = calcLikelihood * calcImpact * (calcVulnerability / 10 || 1);
  const calculatedRating = getRiskRatingFromScore(riskScore);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Assessment" description="Risk Management" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Assessment" description="Risk Management" />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Risk not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/risks/assessment">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">Risk Management</p>
          <h1 className="text-2xl font-bold">Risk Assessment</h1>
        </div>
      </div>

      {/* Stepper */}
      <nav className="mb-6">
        <ol className="flex items-center justify-between">
          {assessmentSteps.map((step, index) => (
            <li key={step.id} className="flex-1 flex flex-col items-center relative">
              <div className="flex items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                    currentStep > step.id
                      ? "border-green-500 bg-green-500 text-white"
                      : currentStep === step.id
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 bg-white text-gray-500"
                  )}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
              </div>
              <span className="mt-1 text-xs text-center text-muted-foreground">
                {step.name}
              </span>
              {index < assessmentSteps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-4 left-1/2 w-full h-0.5",
                    currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                  )}
                  style={{ marginLeft: "16px" }}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Risk Header */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex gap-2 items-center">
          <h4 className="font-bold">{risk.riskId}</h4>
          <h4 className="font-bold">{risk.name}</h4>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Risk Context */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Risk Category</p>
                <p className="font-medium">{risk.category?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Owner</p>
                <p className="font-medium">{risk.owner?.fullName || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Sources</p>
                <p className="font-medium">{risk.riskSources || "-"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Likelihood */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {riskThreats.map((threat) => (
              <div key={threat.id} className="space-y-2">
                <h4 className="font-semibold">{threat.name}</h4>
                <div className="flex gap-2">
                  {likelihoodOptions.map((option) => (
                    <Button
                      key={option.id}
                      variant={threatLikelihoods[threat.id] === option.score ? "default" : "outline"}
                      onClick={() => setThreatLikelihoods(prev => ({ ...prev, [threat.id]: option.score }))}
                      className="flex flex-col h-auto py-2"
                    >
                      <p>{option.title}</p>
                      <p className="text-xs">{option.score}</p>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Timeframe</span>
              <span>Probability</span>
            </div>
          </div>
        )}

        {/* Step 3: Impact */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {riskThreats.map((threat) => (
              <div key={threat.id} className="space-y-3">
                <h4 className="font-semibold">{threat.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm font-medium">
                  <span>Category</span>
                  <span>Impact Rating</span>
                </div>
                {impactCategories.map((category) => (
                  <div key={category.id} className="grid grid-cols-2 gap-2 items-center">
                    <span className="text-sm">{category.name}</span>
                    <Select
                      value={threatImpacts[threat.id]?.[category.id]?.toString() || ""}
                      onValueChange={(val) => setThreatImpacts(prev => ({
                        ...prev,
                        [threat.id]: { ...prev[threat.id], [category.id]: parseInt(val) }
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {impactRatings.map((rating) => (
                          <SelectItem key={rating.id} value={String(rating.score ?? 0)}>
                            {rating.name} ({rating.score})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <p className="text-sm">Impact Rating = {Math.max(...Object.values(threatImpacts[threat.id] || { default: 0 }), 0)}</p>
                  <p className="text-xs text-muted-foreground">Note: The highest rating will be taken</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Vulnerability */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {riskVulnerabilities.map((vuln) => (
              <div key={vuln.id} className="space-y-2">
                <h4 className="font-semibold">{vuln.name}</h4>
                <div className="flex gap-2">
                  {vulnerabilityRatings.map((option) => (
                    <Button
                      key={option.id}
                      variant={vulnerabilityRatingsForm[vuln.id] === option.score ? "default" : "outline"}
                      onClick={() => setVulnerabilityRatingsForm(prev => ({ ...prev, [vuln.id]: option.score }))}
                      className="flex flex-col h-auto py-2"
                    >
                      <p>{option.label}</p>
                      <p className="text-xs">{option.score}</p>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 5: Risk Rating */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Inherent Risk</h4>
              <div className="flex items-center gap-4 text-center">
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Likelihood</p>
                  <p className="font-bold">{calcLikelihood}</p>
                </div>
                <p className="font-bold">*</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Impact</p>
                  <p className="font-bold">{calcImpact}</p>
                </div>
                <p className="font-bold">*</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Vulnerability</p>
                  <p className="font-bold">{calcVulnerability}</p>
                </div>
                <p className="font-bold">=</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="font-bold">{riskScore.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span>Inherent Risk Rating</span>
                <span className={cn(
                  "px-3 py-1 rounded font-medium",
                  calculatedRating === "Critical" && "bg-red-100 text-red-800",
                  calculatedRating === "High" && "bg-orange-100 text-orange-800",
                  calculatedRating === "Medium" && "bg-yellow-100 text-yellow-800",
                  calculatedRating === "Low" && "bg-green-100 text-green-800"
                )}>
                  {calculatedRating}
                </span>
                <span className="text-muted-foreground">({riskScore.toFixed(2)})</span>
              </div>
              <p className="text-sm text-muted-foreground">Risk Score = Likelihood * Impact * Vulnerability</p>
              <p className="text-sm text-muted-foreground">Risk Tolerance = 10</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {riskRanges.map((range) => (
                <div
                  key={range.id}
                  className="p-3 rounded text-center"
                  style={{ backgroundColor: range.color ? `${range.color}20` : "#f0f0f0" }}
                >
                  <p className="font-medium">{range.title}</p>
                  <p className="text-xs text-muted-foreground">[{range.lowRange} - {range.highRange}]</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Risk Summary */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">Inherent Risk Rating</p>
                <span className={cn(
                  "inline-block mt-2 px-3 py-1 rounded font-medium",
                  calculatedRating === "Critical" && "bg-red-100 text-red-800",
                  calculatedRating === "High" && "bg-orange-100 text-orange-800",
                  calculatedRating === "Medium" && "bg-yellow-100 text-yellow-800",
                  calculatedRating === "Low" && "bg-green-100 text-green-800"
                )}>
                  {calculatedRating}
                </span>
                <p className="text-sm text-muted-foreground mt-1">({riskScore.toFixed(2)})</p>
              </div>
              <div className="p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">Overall Control Rating</p>
                <p className="font-medium mt-2">-</p>
              </div>
              <div className="p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">Residual Risk Rating</p>
                <span className={cn(
                  "inline-block mt-2 px-3 py-1 rounded font-medium",
                  calculatedRating === "Critical" && "bg-red-100 text-red-800",
                  calculatedRating === "High" && "bg-orange-100 text-orange-800",
                  calculatedRating === "Medium" && "bg-yellow-100 text-yellow-800",
                  calculatedRating === "Low" && "bg-green-100 text-green-800"
                )}>
                  {calculatedRating}
                </span>
                <p className="text-sm text-muted-foreground mt-1">({riskScore.toFixed(2)})</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Existing Controls</h4>
              <p className="text-sm text-muted-foreground">No controls linked to this risk</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => router.push("/risks/assessment")}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrevious}>
              Previous
            </Button>
          )}
          {currentStep < assessmentSteps.length ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSave}>Save</Button>
          )}
        </div>
      </div>
    </div>
  );
}
