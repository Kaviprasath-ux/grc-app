"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Check, ArrowLeft, ChevronLeft, ChevronRight, Link2, Home } from "lucide-react";
import { toast } from "sonner";
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
  assessmentFormData?: string | null;
}

interface AssessmentFormData {
  threatLikelihoods: Record<string, number>;
  threatImpacts: Record<string, Record<string, number>>;
  vulnerabilityRatings: Record<string, number>;
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

// Assessment steps - will be translated in component
const getAssessmentSteps = (t: (key: string) => string) => [
  { id: 1, name: t("Risk Context") },
  { id: 2, name: t("Likelihood") },
  { id: 3, name: t("Impact") },
  { id: 4, name: t("Vulnerability") },
  { id: 5, name: t("Risk Rating") },
  { id: 6, name: t("Risk Summary") },
];

export default function RiskAssessmentWizardPage() {
  const params = useParams();
  const router = useRouter();
  const riskId = params.id as string;
  const { canView, canCreate, canEdit, isLoading: permissionsLoading } = usePermissions('risk.assessment');
  const { t } = useLanguage();

  // Get translated assessment steps
  const assessmentSteps = getAssessmentSteps(t);

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

  // Risk Response dialog state
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [strategyExplanation, setStrategyExplanation] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);

  // Ref to track initial load (to avoid saving on mount)
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
  }, [riskId]);

  // Auto-save when form values change (debounced)
  useEffect(() => {
    // Skip initial load
    if (isInitialLoad.current) {
      // Mark initial load as complete once loading is done
      if (!loading) {
        isInitialLoad.current = false;
      }
      return;
    }

    // Only save if we have a risk and some values have been set
    const hasLikelihood = Object.keys(threatLikelihoods).length > 0;
    const hasImpact = Object.keys(threatImpacts).length > 0;
    const hasVulnerability = Object.keys(vulnerabilityRatingsForm).length > 0;

    if (!risk || (!hasLikelihood && !hasImpact && !hasVulnerability)) {
      return;
    }

    // Debounce the save to avoid too many API calls
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProgressValues();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [threatLikelihoods, threatImpacts, vulnerabilityRatingsForm, risk, loading]);

  // Debounced save function for auto-save
  const saveProgressValues = async () => {
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

    // Calculate scores
    const likelihoodRounded = Math.round(avgLikelihood);
    const impactRounded = Math.round(maxImpact);
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

    // Prepare form data to persist
    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
    };

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihood: likelihoodRounded,
          impact: impactRounded,
          riskScore: simpleRiskScore,
          riskRating,
          inherentLikelihood: likelihoodRounded,
          inherentImpact: impactRounded,
          inherentRiskScore: simpleRiskScore,
          residualLikelihood: likelihoodRounded,
          residualImpact: impactRounded,
          residualRiskScore: simpleRiskScore,
          assessmentFormData: JSON.stringify(formData),
        }),
      });
      console.log("Auto-saved assessment values");
    } catch (error) {
      console.error("Failed to auto-save:", error);
    }
  };

  // Set status to "In-Progress" when the assessment page loads for new assessments or re-assessments
  useEffect(() => {
    if (risk) {
      const status = risk.assessmentStatus || "Open";
      // Only set to In-Progress for: Open (new), Approved/Completed (re-assess), Rejected (revise)
      const shouldSetInProgress = ["Open", "Approved", "Completed", "Rejected"].includes(status);
      if (shouldSetInProgress) {
        updateAssessmentStatus("In-Progress");
      }
    }
  }, [risk?.id]);

  const updateAssessmentStatus = async (newStatus: string) => {
    if (!risk) return;
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: newStatus,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to update assessment status:", errorData);
      }
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

        // Load saved assessment form data if it exists
        if (data.assessmentFormData) {
          try {
            const savedFormData: AssessmentFormData = JSON.parse(data.assessmentFormData);
            if (savedFormData.threatLikelihoods) {
              setThreatLikelihoods(savedFormData.threatLikelihoods);
            }
            if (savedFormData.threatImpacts) {
              setThreatImpacts(savedFormData.threatImpacts);
            }
            if (savedFormData.vulnerabilityRatings) {
              setVulnerabilityRatingsForm(savedFormData.vulnerabilityRatings);
            }
          } catch (e) {
            console.error("Failed to parse assessment form data:", e);
          }
        }
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
    // Default to "Low Risk" if no matching range found (including zero scores)
    return matchingRange?.title || "Low Risk";
  };

  // Save progress function - saves current assessment values to the risk
  const saveProgress = async () => {
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

    // Calculate scores
    const likelihoodRounded = Math.round(avgLikelihood);
    const impactRounded = Math.round(maxImpact);
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

    // Prepare form data to persist
    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
    };

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihood: likelihoodRounded,
          impact: impactRounded,
          riskScore: simpleRiskScore,
          riskRating,
          inherentLikelihood: likelihoodRounded,
          inherentImpact: impactRounded,
          inherentRiskScore: simpleRiskScore,
          residualLikelihood: likelihoodRounded,
          residualImpact: impactRounded,
          residualRiskScore: simpleRiskScore,
          assessmentFormData: JSON.stringify(formData),
        }),
      });
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  const handleNext = async () => {
    if (currentStep < assessmentSteps.length) {
      // Save progress when moving to next step (from Likelihood, Impact, or Vulnerability steps)
      if (currentStep >= 2 && currentStep <= 4) {
        await saveProgress();
      }
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

    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);

    // Check if risk rating is NOT "Low Risk" - show Risk Response dialog
    // Only show dialog for higher risk ratings (Medium, High, Very High, Critical, Catastrophic)
    if (riskRating !== "Low Risk") {
      setShowResponseDialog(true);
      return;
    }

    // For Low Risk, proceed with normal save
    await saveAssessment();
  };

  const saveAssessment = async (responseStrategy?: string) => {
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

    // Calculate scores
    const likelihoodRounded = Math.round(avgLikelihood);
    const impactRounded = Math.round(maxImpact);
    const vulnerabilityRounded = Math.round(avgVulnerability);
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);

    // Calculate simple risk score (likelihood * impact) for the riskScore field
    const simpleRiskScore = likelihoodRounded * impactRounded;

    // Prepare form data to persist
    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
    };

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Basic assessment scores
          likelihood: likelihoodRounded,
          impact: impactRounded,
          riskScore: simpleRiskScore,
          riskRating,
          // Inherent risk scores (from the assessment)
          inherentLikelihood: likelihoodRounded,
          inherentImpact: impactRounded,
          inherentRiskScore: simpleRiskScore,
          // Residual risk scores (initially same as inherent, before controls are applied)
          residualLikelihood: likelihoodRounded,
          residualImpact: impactRounded,
          residualRiskScore: simpleRiskScore,
          // Status and other fields - Completed (no approval required)
          assessmentStatus: "Completed",
          responseStrategy: responseStrategy || undefined,
          lastAssessmentDate: new Date().toISOString(),
          // Persist form selections for re-assessment
          assessmentFormData: JSON.stringify(formData),
        }),
      });

      router.push("/risks/assessment");
    } catch (error) {
      console.error("Failed to save assessment:", error);
    }
  };

  const handleSaveResponse = async () => {
    if (!risk || !selectedStrategy) return;

    setSavingResponse(true);
    try {
      // Create risk response record
      const response = await fetch("/api/risk-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskId: risk.id,
          responseType: selectedStrategy,
          actionTitle: `${selectedStrategy} Strategy`,
          actionDescription: strategyExplanation,
          status: "Open",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Unknown error';
        console.error("Failed to create risk response:", errorMessage);
        toast.error(`Failed to create risk response: ${errorMessage}`);
        return;
      }

      // Now save the assessment with the response strategy
      await saveAssessment(selectedStrategy);

      // Reset dialog state
      setShowResponseDialog(false);
      setSelectedStrategy("");
      setStrategyExplanation("");
    } catch (error) {
      console.error("Failed to save response:", error);
    } finally {
      setSavingResponse(false);
    }
  };

  const handleCancelResponse = () => {
    setShowResponseDialog(false);
    setSelectedStrategy("");
    setStrategyExplanation("");
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

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/risks/assessment">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("Back")}
            </Button>
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">{t("Risk Management")}</p>
            <h1 className="text-2xl font-bold">{t("Risk Assessment")}</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Assessment.")} />;
  }

  if (!risk) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/risks/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/assessment" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Assessment")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Risk Assessment")}</span>
        </nav>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t("Risk not found")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/risks/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/assessment" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Assessment")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Risk Assessment")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Assessment")}</h1>

      {/* Stepper */}
      <nav className="mb-4 sm:mb-6 overflow-x-auto">
        <ol className="flex items-center justify-between min-w-[400px]">
          {assessmentSteps.map((step, index) => (
            <li key={step.id} className="flex-1 flex flex-col items-center relative">
              <div className="flex items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 text-xs sm:text-sm font-medium",
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
              <span className="mt-1 text-[10px] sm:text-xs text-center text-muted-foreground hidden sm:block">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("Risk Category")}</p>
                <p className="font-medium">{risk.category?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("Risk Owner")}</p>
                <p className="font-medium">{risk.owner?.fullName || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("Risk Sources")}</p>
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
                <div className="flex flex-wrap gap-2">
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
              <span>{t("Timeframe")}</span>
              <span>{t("Probability")}</span>
            </div>
          </div>
        )}

        {/* Step 3: Impact */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {riskThreats.map((threat) => (
              <div key={threat.id} className="space-y-3">
                <h4 className="font-semibold">{threat.name}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-medium">
                  <span>{t("Category")}</span>
                  <span className="hidden sm:block">{t("Impact Rating")}</span>
                </div>
                {impactCategories.map((category) => (
                  <div key={category.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <span className="text-sm">{category.name}</span>
                    <Select
                      value={threatImpacts[threat.id]?.[category.id]?.toString() || ""}
                      onValueChange={(val) => setThreatImpacts(prev => ({
                        ...prev,
                        [threat.id]: { ...prev[threat.id], [category.id]: parseInt(val) }
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select")} />
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
                  <p className="text-sm">{t("Impact Rating")} = {Math.max(...Object.values(threatImpacts[threat.id] || { default: 0 }), 0)}</p>
                  <p className="text-xs text-muted-foreground">{t("Note: The highest rating will be taken")}</p>
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
                <div className="flex flex-wrap gap-2">
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
              <h4 className="font-semibold">{t("Inherent Risk")}</h4>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-center">
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">{t("Likelihood")}</p>
                  <p className="font-bold">{calcLikelihood}</p>
                </div>
                <p className="font-bold">*</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">{t("Impact")}</p>
                  <p className="font-bold">{calcImpact}</p>
                </div>
                <p className="font-bold">*</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">{t("Vulnerability")}</p>
                  <p className="font-bold">{calcVulnerability}</p>
                </div>
                <p className="font-bold">=</p>
                <div className="p-3 bg-muted rounded">
                  <p className="text-xs text-muted-foreground">{t("Score")}</p>
                  <p className="font-bold">{riskScore.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span>{t("Inherent Risk Rating")}</span>
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
              <p className="text-sm text-muted-foreground">{t("Risk Score = Likelihood * Impact * Vulnerability")}</p>
              <p className="text-sm text-muted-foreground">{t("Risk Tolerance")} = 10</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">{t("Inherent Risk Rating")}</p>
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
              <div className="p-3 sm:p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">{t("Overall Control Rating")}</p>
                <p className="font-medium mt-2">-</p>
              </div>
              <div className="p-3 sm:p-4 bg-muted rounded text-center">
                <p className="text-sm text-muted-foreground">{t("Residual Risk Rating")}</p>
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
              <h4 className="font-semibold mb-2">{t("Existing Controls")}</h4>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <Link2 className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No controls linked to this risk")}</p>
                <p className="text-xs text-slate-400">{t("Link controls from the risk register to see them here")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t">
        <span className="text-xs font-medium text-slate-400 sm:me-auto text-center sm:text-left">
          {t("Step")} {currentStep} {t("of")} {assessmentSteps.length}
        </span>
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              router.push("/risks/assessment");
            } else {
              handlePrevious();
            }
          }}
        >
          {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
          {currentStep === 1 ? t("Cancel") : t("Previous")}
        </Button>
        {currentStep < assessmentSteps.length ? (
          <Button onClick={handleNext}>
            {t("Next")}
            <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        ) : (
          (canCreate || canEdit) && (
            <Button onClick={handleSave}>
              {t("Save")}
            </Button>
          )
        )}
      </div>

      {/* Risk Response Strategy Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("Risk Response Strategy")}</DialogTitle>
            <DialogDescription>
              {t("The risk rating is not Low. Please select a response strategy and provide an explanation.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("Select Strategy")}</Label>
              <RadioGroup
                value={selectedStrategy}
                onValueChange={setSelectedStrategy}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="Transfer" id="transfer" />
                  <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t("Transfer")}</div>
                    <p className="text-sm text-muted-foreground">{t("Transfer the risk to a third party (e.g., insurance, outsourcing)")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="Avoid" id="avoid" />
                  <Label htmlFor="avoid" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t("Avoid")}</div>
                    <p className="text-sm text-muted-foreground">{t("Eliminate the risk by not engaging in the activity")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="Accept" id="accept" />
                  <Label htmlFor="accept" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t("Accept")}</div>
                    <p className="text-sm text-muted-foreground">{t("Accept the risk without taking any action")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="Treat" id="treat" />
                  <Label htmlFor="treat" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t("Treat")}</div>
                    <p className="text-sm text-muted-foreground">{t("Implement controls to reduce the risk likelihood or impact")}</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy-explanation" className="text-sm font-medium">
                {t("Risk Response Strategy Explanation")}
              </Label>
              <Textarea
                id="strategy-explanation"
                placeholder={t("Explain how you plan to address this risk with the selected strategy...")}
                value={strategyExplanation}
                onChange={(e) => setStrategyExplanation(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelResponse}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSaveResponse}
              disabled={!selectedStrategy || savingResponse}
            >
              {savingResponse ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
