"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

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

interface RiskAssessmentWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string | null;
  onAssessmentComplete?: () => void;
}

const assessmentSteps = [
  { id: 1, name: "Risk Context" },
  { id: 2, name: "Likelihood" },
  { id: 3, name: "Impact" },
  { id: 4, name: "Vulnerability" },
  { id: 5, name: "Risk Rating" },
  { id: 6, name: "Risk Summary" },
];

export function RiskAssessmentWizardDialog({
  open,
  onOpenChange,
  riskId,
  onAssessmentComplete,
}: RiskAssessmentWizardDialogProps) {
  const { canView, canCreate, canEdit } = usePermissions('risk.assessment');

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

  // Reset state when dialog opens with a new risk
  useEffect(() => {
    if (open && riskId) {
      setCurrentStep(1);
      setThreatLikelihoods({});
      setThreatImpacts({});
      setVulnerabilityRatingsForm({});
      setRisk(null);
      setLoading(true);
      isInitialLoad.current = true;
      fetchData();
    }
  }, [open, riskId]);

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

  // Set status to "In-Progress" when the assessment dialog loads
  useEffect(() => {
    if (risk && open) {
      const status = risk.assessmentStatus || "Open";
      const shouldSetInProgress = ["Open", "Approved", "Completed", "Rejected"].includes(status);
      if (shouldSetInProgress) {
        updateAssessmentStatus("In-Progress");
      }
    }
  }, [risk?.id, open]);

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
    if (!riskId) return;

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
    return matchingRange?.title || "Low Risk";
  };

  // Save progress function
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

    const likelihoodRounded = Math.round(avgLikelihood);
    const impactRounded = Math.round(maxImpact);
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

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

    if (riskRating !== "Low Risk") {
      setShowResponseDialog(true);
      return;
    }

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

    const likelihoodRounded = Math.round(avgLikelihood);
    const impactRounded = Math.round(maxImpact);
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability / 10 || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

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
          assessmentStatus: "Completed",
          responseStrategy: responseStrategy || undefined,
          lastAssessmentDate: new Date().toISOString(),
          assessmentFormData: JSON.stringify(formData),
        }),
      });

      toast.success("Assessment completed successfully");
      onOpenChange(false);
      onAssessmentComplete?.();
    } catch (error) {
      console.error("Failed to save assessment:", error);
      toast.error("Failed to save assessment");
    }
  };

  const handleSaveResponse = async () => {
    if (!risk || !selectedStrategy) return;

    setSavingResponse(true);
    try {
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

      await saveAssessment(selectedStrategy);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" showCloseButton={false}>
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800 mb-2">
                  Risk Assessment
                </DialogTitle>
                {risk && (
                  <p className="text-sm text-slate-500">
                    {risk.riskId} - {risk.name}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="flex-shrink-0 h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Step Indicator */}
            {!loading && risk && (
              <div className="flex items-start justify-center pt-5">
                {assessmentSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start">
                    <div className="flex flex-col items-center w-20">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                          currentStep > step.id
                            ? "bg-success text-white"
                            : currentStep === step.id
                            ? "bg-primary-600 text-white"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        )}
                      >
                        {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                      </div>
                      <span
                        className={cn(
                          "mt-2 text-[10px] font-medium text-center leading-tight",
                          currentStep >= step.id ? "text-slate-700" : "text-slate-400"
                        )}
                      >
                        {step.name}
                      </span>
                    </div>
                    {index < assessmentSteps.length - 1 && (
                      <div
                        className={cn(
                          "w-6 h-0.5 mt-[18px] -mx-2 transition-colors",
                          currentStep > step.id ? "bg-success" : "bg-slate-200"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : !risk ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">Risk not found</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Risk Header */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-slate-800">{risk.riskId}</span>
                    <span className="font-semibold text-slate-800">{risk.name}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{risk.description}</p>
                </div>

                {/* Step 1: Risk Context */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase mb-1">Risk Category</p>
                        <p className="font-medium text-slate-800">{risk.category?.name || "-"}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase mb-1">Risk Type</p>
                        <p className="font-medium text-slate-800">{risk.type?.name || "-"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase mb-1">Risk Owner</p>
                        <p className="font-medium text-slate-800">{risk.owner?.fullName || "-"}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase mb-1">Department</p>
                        <p className="font-medium text-slate-800">{risk.category?.name || "-"}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 uppercase mb-1">Risk Sources</p>
                      <p className="font-medium text-slate-800">{risk.riskSources || "-"}</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Likelihood */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {riskThreats.map((threat) => (
                      <div key={threat.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="font-semibold text-slate-800 mb-3">{threat.name}</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {likelihoodOptions.map((option) => (
                            <Button
                              key={option.id}
                              variant={threatLikelihoods[threat.id] === option.score ? "default" : "outline"}
                              onClick={() => setThreatLikelihoods(prev => ({ ...prev, [threat.id]: option.score }))}
                              className="flex flex-col h-auto py-3 px-2 w-full"
                            >
                              <span className="text-xs font-medium">{option.title}</span>
                              <span className="text-xs opacity-70 mt-0.5">{option.score}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 3: Impact */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {riskThreats.map((threat) => (
                      <div key={threat.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="font-semibold text-slate-800 mb-4">{threat.name}</h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-slate-600 pb-2 border-b border-slate-200">
                            <span>Impact Category</span>
                            <span>Rating</span>
                          </div>
                          {impactCategories.map((category) => (
                            <div key={category.id} className="grid grid-cols-2 gap-4 items-center">
                              <span className="text-sm text-slate-700">{category.name}</span>
                              <Select
                                value={threatImpacts[threat.id]?.[category.id]?.toString() || ""}
                                onValueChange={(val) => setThreatImpacts(prev => ({
                                  ...prev,
                                  [threat.id]: { ...prev[threat.id], [category.id]: parseInt(val) }
                                }))}
                              >
                                <SelectTrigger className="w-full bg-white">
                                  <SelectValue placeholder="Select rating" />
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
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Impact Rating:</span> {Math.max(...Object.values(threatImpacts[threat.id] || { default: 0 }), 0)}
                          </p>
                          <p className="text-xs text-slate-400">Highest rating is taken</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 4: Vulnerability */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    {riskVulnerabilities.map((vuln) => (
                      <div key={vuln.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="font-semibold text-slate-800 mb-3">{vuln.name}</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {vulnerabilityRatings.map((option) => (
                            <Button
                              key={option.id}
                              variant={vulnerabilityRatingsForm[vuln.id] === option.score ? "default" : "outline"}
                              onClick={() => setVulnerabilityRatingsForm(prev => ({ ...prev, [vuln.id]: option.score }))}
                              className="flex flex-col h-auto py-3 px-2 w-full"
                            >
                              <span className="text-xs font-medium">{option.label}</span>
                              <span className="text-xs opacity-70 mt-0.5">{option.score}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 5: Risk Rating */}
                {currentStep === 5 && (
                  <div className="space-y-5">
                    {/* Risk Calculation */}
                    <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-4">Inherent Risk Calculation</h4>
                      <div className="grid grid-cols-7 gap-2 items-center text-center">
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase">Likelihood</p>
                          <p className="text-xl font-bold text-slate-800">{calcLikelihood}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400">×</p>
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase">Impact</p>
                          <p className="text-xl font-bold text-slate-800">{calcImpact}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400">×</p>
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase">Vulnerability</p>
                          <p className="text-xl font-bold text-slate-800">{calcVulnerability}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400">=</p>
                        <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                          <p className="text-xs text-primary-600 uppercase">Score</p>
                          <p className="text-xl font-bold text-primary-700">{riskScore.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Rating Result */}
                    <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500 mb-1">Inherent Risk Rating</p>
                          <span className={cn(
                            "inline-block px-4 py-2 rounded-lg text-sm font-semibold",
                            calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                            calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                            calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                            calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                            calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                          )}>
                            {calculatedRating}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Risk Score = Likelihood × Impact × Vulnerability</p>
                          <p className="text-xs text-slate-400">Risk Tolerance = 10</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ranges */}
                    <div className="grid grid-cols-4 gap-3">
                      {riskRanges.map((range) => (
                        <div
                          key={range.id}
                          className="p-4 rounded-lg text-center border"
                          style={{
                            backgroundColor: range.color ? `${range.color}15` : "#f8fafc",
                            borderColor: range.color ? `${range.color}40` : "#e2e8f0"
                          }}
                        >
                          <p className="font-semibold text-sm text-slate-700">{range.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{range.lowRange} - {range.highRange}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 6: Risk Summary */}
                {currentStep === 6 && (
                  <div className="space-y-5">
                    {/* Risk Ratings Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 uppercase mb-3">Inherent Risk Rating</p>
                        <span className={cn(
                          "inline-block px-4 py-2 rounded-lg text-sm font-semibold",
                          calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                          calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                          calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                          calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                          calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                        )}>
                          {calculatedRating}
                        </span>
                        <p className="text-xs text-slate-400 mt-2">Score: {riskScore.toFixed(2)}</p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 uppercase mb-3">Overall Control Rating</p>
                        <p className="text-lg font-semibold text-slate-800">-</p>
                        <p className="text-xs text-slate-400 mt-2">No controls linked</p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 uppercase mb-3">Residual Risk Rating</p>
                        <span className={cn(
                          "inline-block px-4 py-2 rounded-lg text-sm font-semibold",
                          calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                          calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                          calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                          calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                          calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                        )}>
                          {calculatedRating}
                        </span>
                        <p className="text-xs text-slate-400 mt-2">Score: {riskScore.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Existing Controls */}
                    <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-3">Existing Controls</h4>
                      <p className="text-sm text-slate-500">No controls linked to this risk</p>
                    </div>

                    {/* Assessment Summary */}
                    <div className="p-5 bg-slate-50 rounded-lg border border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-3">Assessment Summary</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-1">Risk ID</p>
                          <p className="text-sm font-medium text-slate-800">{risk.riskId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-1">Risk Name</p>
                          <p className="text-sm font-medium text-slate-800">{risk.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-1">Calculated Likelihood</p>
                          <p className="text-sm font-medium text-slate-800">{calcLikelihood}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-1">Calculated Impact</p>
                          <p className="text-sm font-medium text-slate-800">{calcImpact}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          {!loading && risk && (
            <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <span className="text-xs font-medium text-slate-400 me-auto">
                Step {currentStep} of {assessmentSteps.length}
              </span>
              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep === 1) {
                    onOpenChange(false);
                  } else {
                    handlePrevious();
                  }
                }}
              >
                {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>
              {currentStep < assessmentSteps.length ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              ) : (
                (canCreate || canEdit) && (
                  <Button onClick={handleSave}>
                    Save
                  </Button>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Risk Response Strategy Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800">Risk Response Strategy</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  The risk rating is not Low. Please select a response strategy and provide an explanation.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowResponseDialog(false)}
                className="flex-shrink-0 h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-700">Select Strategy</Label>
              <RadioGroup
                value={selectedStrategy}
                onValueChange={setSelectedStrategy}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Transfer" id="transfer" />
                  <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">Transfer</div>
                    <p className="text-sm text-slate-500">Transfer the risk to a third party (e.g., insurance, outsourcing)</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Avoid" id="avoid" />
                  <Label htmlFor="avoid" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">Avoid</div>
                    <p className="text-sm text-slate-500">Eliminate the risk by not engaging in the activity</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Accept" id="accept" />
                  <Label htmlFor="accept" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">Accept</div>
                    <p className="text-sm text-slate-500">Accept the risk without taking any action</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Treat" id="treat" />
                  <Label htmlFor="treat" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">Treat</div>
                    <p className="text-sm text-slate-500">Implement controls to reduce the risk likelihood or impact</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="strategy-explanation" className="text-sm font-medium text-slate-700">
                Risk Response Strategy Explanation
              </Label>
              <Textarea
                id="strategy-explanation"
                placeholder="Explain how you plan to address this risk with the selected strategy..."
                value={strategyExplanation}
                onChange={(e) => setStrategyExplanation(e.target.value)}
                className="min-h-[100px] bg-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelResponse}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveResponse}
              disabled={!selectedStrategy || savingResponse}
            >
              {savingResponse ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
