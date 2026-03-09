"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, X, FileText, Target, Zap, Shield, BarChart3, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

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
  controlRisks?: { controlId: string; controlStrengthId: string | null; justification: string | null; control: { id: string; controlCode?: string; name: string }; controlStrength: { id: string; name: string; score: number } | null }[];
  riskSources?: string | null;
  assessmentFormData?: string | null;
}

interface AssessmentFormData {
  threatLikelihoods: Record<string, number>;
  threatImpacts: Record<string, Record<string, number>>;
  vulnerabilityRatings: Record<string, number>;
  lastStep?: number;
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

const assessmentStepIcons = [FileText, Target, Zap, Shield, BarChart3, ClipboardList];

export function RiskAssessmentWizardDialog({
  open,
  onOpenChange,
  riskId,
  onAssessmentComplete,
}: RiskAssessmentWizardDialogProps) {
  const { t } = useLanguage();
  const { canView, canCreate, canEdit } = usePermissions('risk.assessment');

  const assessmentSteps = [
    { id: 1, name: t("Risk Context"), icon: assessmentStepIcons[0] },
    { id: 2, name: t("Likelihood"), icon: assessmentStepIcons[1] },
    { id: 3, name: t("Impact"), icon: assessmentStepIcons[2] },
    { id: 4, name: t("Vulnerability"), icon: assessmentStepIcons[3] },
    { id: 5, name: t("Risk Rating"), icon: assessmentStepIcons[4] },
    { id: 6, name: t("Summary"), icon: assessmentStepIcons[5] },
  ];

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
  const [riskTolerance, setRiskTolerance] = useState<number>(10);
  const [controlStrengths, setControlStrengths] = useState<{ id: string; name: string; score: number }[]>([]);

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
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

    // Prepare form data to persist
    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
      lastStep: currentStep,
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
        likelihoodsRes, impactCatsRes, impactRatingsRes, vulnRatingsRes, riskRangesRes, scoreConfigRes, controlStrengthsRes
      ] = await Promise.all([
        fetch(`/api/risks/${riskId}`),
        fetch("/api/risk-threats"),
        fetch("/api/risk-vulnerabilities"),
        fetch("/api/risk-likelihoods"),
        fetch("/api/impact-categories"),
        fetch("/api/impact-ratings"),
        fetch("/api/vulnerability-ratings"),
        fetch("/api/risk-ranges"),
        fetch("/api/risk-score-config"),
        fetch("/api/control-strengths"),
      ]);

      if (riskRes.ok) {
        const data = await riskRes.json();
        setRisk(data);

        // Load saved assessment form data only for Resume (In-Progress/Draft/Closed)
        // For Re-assess (Completed/Approved/Submitted/Rejected) or Initiate (Open), start fresh
        const status = data.assessmentStatus || "Open";
        const isResume = ["In-Progress", "Draft", "Closed"].includes(status);

        if (isResume && data.assessmentFormData) {
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
            // Resume from last saved step
            if (savedFormData.lastStep) {
              setCurrentStep(savedFormData.lastStep);
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
      if (scoreConfigRes.ok) {
        const data = await scoreConfigRes.json();
        if (data.riskTolerance) setRiskTolerance(data.riskTolerance);
      }
      if (controlStrengthsRes.ok) {
        const data = await controlStrengthsRes.json();
        setControlStrengths(data);
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
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
      lastStep: currentStep,
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

    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);

    // Check if Risk Response Strategy is needed:
    // Condition: (RiskScore / RiskTolerance) <= ResidualRiskScore
    // If true → response needed, assessment status = "Closed"
    // If false → no response needed, assessment status = "Completed", risk status = "Completed"
    const toleranceThreshold = riskScoreCalc / (riskTolerance || 1);
    const needsResponse = toleranceThreshold <= residualRiskScore;

    if (needsResponse) {
      setShowResponseDialog(true);
      return;
    }

    // No response needed - mark as completed
    await saveAssessment(undefined, false);
  };

  // responseNeeded: true = response strategy required (assessment "Closed"), false = no response needed (assessment "Completed")
  const saveAssessment = async (responseStrategy?: string, responseNeeded: boolean = true) => {
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
    const riskScoreCalc = avgLikelihood * maxImpact * (avgVulnerability || 1);
    const riskRating = getRiskRatingFromScore(riskScoreCalc);
    const simpleRiskScore = likelihoodRounded * impactRounded;

    const formData: AssessmentFormData = {
      threatLikelihoods,
      threatImpacts,
      vulnerabilityRatings: vulnerabilityRatingsForm,
      lastStep: currentStep,
    };

    // Determine statuses based on whether response strategy is needed
    const assessmentStatus = responseNeeded ? "Closed" : "Completed";
    const riskStatus = responseNeeded ? undefined : "Completed";

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
          assessmentStatus,
          ...(riskStatus && { status: riskStatus }),
          responseStrategy: responseStrategy || undefined,
          lastAssessmentDate: new Date().toISOString(),
          assessmentFormData: JSON.stringify(formData),
        }),
      });

      toast.success(responseNeeded
        ? t("Assessment closed. Risk Response Strategy required.")
        : t("Assessment completed successfully. No response action needed."));
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

      await saveAssessment(selectedStrategy, true);

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

  // Translate dynamic settings data for non-English locales
  const { data: translatedThreats } = useTranslatedData(threats, { modelName: 'RiskThreat' });
  const { data: translatedVulnerabilities } = useTranslatedData(vulnerabilities, { modelName: 'RiskVulnerability' });
  const { data: translatedLikelihoodOptions } = useTranslatedData(likelihoodOptions, { modelName: 'RiskLikelihood' });
  const { data: translatedImpactCategories } = useTranslatedData(impactCategories, { modelName: 'ImpactCategory' });
  const { data: translatedImpactRatings } = useTranslatedData(impactRatings, { modelName: 'ImpactRating' });
  const { data: translatedVulnRatings } = useTranslatedData(vulnerabilityRatings, { modelName: 'VulnerabilityRating' });
  const { data: translatedRiskRanges } = useTranslatedData(riskRanges, { modelName: 'RiskRange' });

  // Translate the risk record itself (name, description) and its nested category/type
  const riskArray = useMemo(() => risk ? [risk] : [], [risk]);
  const { data: translatedRiskArray } = useTranslatedData(riskArray, { modelName: 'Risk' });
  const translatedRisk = translatedRiskArray[0] || risk;

  const riskCategoryArray = useMemo(() => risk?.category ? [risk.category] : [], [risk?.category]);
  const { data: translatedRiskCategoryArray } = useTranslatedData(riskCategoryArray, { modelName: 'RiskCategory' });
  const translatedCategory = translatedRiskCategoryArray[0];

  const riskTypeArray = useMemo(() => risk?.type ? [risk.type] : [], [risk?.type]);
  const { data: translatedRiskTypeArray } = useTranslatedData(riskTypeArray, { modelName: 'RiskType' });
  const translatedType = translatedRiskTypeArray[0];

  const riskThreats = risk?.threats?.map((t) => {
    const translated = translatedThreats.find(tr => tr.id === t.threat.id);
    return translated || t.threat;
  }) || translatedThreats.slice(0, 4);
  const riskVulnerabilities = risk?.vulnerabilities?.map((v) => {
    const translated = translatedVulnerabilities.find(tr => tr.id === v.vulnerability.id);
    return translated || v.vulnerability;
  }) || translatedVulnerabilities.slice(0, 3);

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

  const riskScore = calcLikelihood * calcImpact * (calcVulnerability || 1);
  const calculatedRating = getRiskRatingFromScore(riskScore);

  // Control Rating calculation
  const controlRatingResult = useMemo(() => {
    const linkedControls = risk?.controlRisks || [];
    const totalControlCount = linkedControls.length;
    const empty = { rating: 0, count: 0, hasControls: false, controls: [] as { controlCode: string; name: string; strengthName: string; value: number }[] };
    if (totalControlCount === 0) return empty;

    // Use control strengths from settings if available, otherwise fall back to max from linked controls
    const maxScore = controlStrengths.length > 0
      ? Math.max(...controlStrengths.map(cs => cs.score))
      : Math.max(...linkedControls.map(cr => cr.controlStrength?.score || 0), 0);

    if (maxScore === 0) return { ...empty, count: totalControlCount, hasControls: true, controls: linkedControls.map(cr => ({ controlCode: cr.control?.controlCode || "", name: cr.control?.name || "", strengthName: cr.controlStrength?.name || "-", value: 0 })) };

    const controlDetails: { controlCode: string; name: string; strengthName: string; value: number }[] = [];
    let sumControlValues = 0;
    for (const cr of linkedControls) {
      const controlWeight = cr.controlStrength?.score || 0;
      const controlValue = Math.round(((controlWeight / maxScore) * 100) * 100) / 100;
      sumControlValues += controlValue;
      controlDetails.push({
        controlCode: cr.control?.controlCode || "",
        name: cr.control?.name || "",
        strengthName: cr.controlStrength?.name || "-",
        value: controlValue,
      });
    }

    const rating = Math.round((sumControlValues / totalControlCount) * 100) / 100;
    return { rating, count: totalControlCount, hasControls: true, controls: controlDetails };
  }, [risk?.controlRisks, controlStrengths]);

  // Residual Risk = InherentRiskScore / TotalControlStrength (if TotalControlStrength != 0)
  const totalControlStrength = useMemo(() => {
    const linkedControls = risk?.controlRisks || [];
    let total = 0;
    for (const cr of linkedControls) {
      const score = cr.controlStrength?.score || 0;
      if (score !== 0) total += score;
    }
    return total;
  }, [risk?.controlRisks]);

  const residualRiskScore = totalControlStrength !== 0
    ? Math.round((riskScore / totalControlStrength) * 100) / 100
    : riskScore;
  const residualRiskRating = getRiskRatingFromScore(residualRiskScore);

  // Speedometer calculations for Risk Summary step
  const speedometerMaxScore = riskRanges.length > 0 ? Math.max(...riskRanges.map(r => r.highRange)) : 125;
  const speedometerPct = Math.min(Math.max(riskScore / speedometerMaxScore, 0), 1);
  const needleAngle = Math.PI * (1 - speedometerPct);
  const needleX = 100 + 60 * Math.cos(needleAngle);
  const needleY = 100 - 60 * Math.sin(needleAngle);
  const arcPoint = (angleDeg: number) => ({
    x: 100 + 70 * Math.cos(angleDeg * Math.PI / 180),
    y: 100 - 70 * Math.sin(angleDeg * Math.PI / 180),
  });
  const defaultZoneColors = ["#22c55e", "#eab308", "#f97316", "#ef4444"];
  const speedometerZones = riskRanges.length > 0
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" showCloseButton={false}>
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800 mb-2">
                  {t("Risk Assessment")}
                </DialogTitle>
                {risk && (
                  <p className="text-sm text-slate-500">
                    {risk.riskId} - {translatedRisk?.name || risk.name}
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
              <div className="overflow-x-auto pt-5 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="flex items-start justify-center min-w-max">
                {assessmentSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start">
                    <div className="flex flex-col items-center w-[60px] sm:w-[72px]">
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
                          "w-6 h-0.5 mt-[18px] -mx-1 transition-colors",
                          currentStep > step.id ? "bg-success" : "bg-slate-200"
                        )}
                      />
                    )}
                  </div>
                ))}
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : !risk ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">{t("Risk not found")}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Risk Header */}
                <div className="pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-primary-50 text-primary-700">{risk.riskId}</span>
                    <h3 className="font-semibold text-slate-800">{translatedRisk?.name || risk.name}</h3>
                  </div>
                  {(translatedRisk?.description || risk.description) && (
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{translatedRisk?.description || risk.description}</p>
                  )}
                </div>

                {/* Step 1: Risk Context */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("Risk Context")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                      <div className="flex justify-between py-2.5 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t("Category")}</span>
                        <span className="text-sm font-medium text-slate-800">{translatedCategory?.name || risk.category?.name || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t("Type")}</span>
                        <span className="text-sm font-medium text-slate-800">{translatedType?.name || risk.type?.name || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t("Owner")}</span>
                        <span className="text-sm font-medium text-slate-800">{risk.owner?.fullName || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t("Department")}</span>
                        <span className="text-sm font-medium text-slate-800">{translatedCategory?.name || risk.category?.name || "-"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Risk Sources")}</span>
                      <span className="text-sm font-medium text-slate-800 text-right max-w-[60%]">{translatedRisk?.riskSources || risk.riskSources || "-"}</span>
                    </div>
                  </div>
                )}

                {/* Step 2: Likelihood */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {riskThreats.map((threat, idx) => (
                      <div key={threat.id} className={cn(idx < riskThreats.length - 1 && "pb-6 border-b border-slate-200")}>
                        <h4 className="font-semibold text-slate-800 mb-3">{threat.name}</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {translatedLikelihoodOptions.map((option) => (
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
                    {riskThreats.map((threat, idx) => (
                      <div key={threat.id} className={cn(idx < riskThreats.length - 1 && "pb-6 border-b border-slate-200")}>
                        <h4 className="font-semibold text-slate-800 mb-4">{threat.name}</h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-slate-600 pb-2 border-b border-slate-200">
                            <span>{t("Impact Category")}</span>
                            <span>{t("Rating")}</span>
                          </div>
                          {translatedImpactCategories.map((category) => (
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
                                  <SelectValue placeholder={t("Select rating")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {translatedImpactRatings.map((rating) => (
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
                            <span className="font-medium">{t("Impact Rating")}:</span> {Math.max(...Object.values(threatImpacts[threat.id] || { default: 0 }), 0)}
                          </p>
                          <p className="text-xs text-slate-400">{t("Highest rating is taken")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 4: Vulnerability */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    {riskVulnerabilities.map((vuln, idx) => (
                      <div key={vuln.id} className={cn(idx < riskVulnerabilities.length - 1 && "pb-6 border-b border-slate-200")}>
                        <h4 className="font-semibold text-slate-800 mb-3">{vuln.name}</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {translatedVulnRatings.map((option) => (
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
                    <div className="pb-5 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-800 mb-4">{t("Inherent Risk Calculation")}</h4>
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-center text-center">
                        <div className="p-3 bg-white rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Likelihood")}</p>
                          <p className="text-xl font-bold text-slate-800">{calcLikelihood}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400 px-1">×</p>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Impact")}</p>
                          <p className="text-xl font-bold text-slate-800">{calcImpact}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400 px-1">×</p>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Vulnerability")}</p>
                          <p className="text-xl font-bold text-slate-800">{calcVulnerability}</p>
                        </div>
                        <p className="font-bold text-xl text-slate-400 px-1">=</p>
                        <div className="p-3 bg-primary-50 rounded-lg border border-primary-200 min-w-0">
                          <p className="text-[10px] text-primary-600 uppercase truncate">{t("Score")}</p>
                          <p className="text-xl font-bold text-primary-700">{riskScore.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Rating Result */}
                    <div className="pb-5 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500 mb-1">{t("Inherent Risk Rating")}</p>
                          <span className={cn(
                            "inline-block px-4 py-2 rounded-lg text-sm font-semibold",
                            calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                            calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                            calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                            calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                            calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                          )}>
                            {t(calculatedRating)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{t("Risk Score = Likelihood × Impact × Vulnerability")}</p>
                          <p className="text-xs text-slate-400">{t("Risk Tolerance")} = {riskTolerance}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ranges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {translatedRiskRanges.map((range) => (
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
                    {/* Speedometer Chart */}
                    <div className="pb-5 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-800 mb-3 text-center">{t("Inherent Risk Score")}</h4>
                      <div className="flex justify-center">
                        <div className="flex flex-col items-center">
                          <svg viewBox="0 0 200 130" className="w-52 h-auto">
                            {/* Zone arcs */}
                            {speedometerZones.map((zone, i) => {
                              const start = arcPoint(zone.startAngle);
                              const end = arcPoint(zone.endAngle);
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
                            {/* Needle */}
                            <line x1="100" y1="100" x2={needleX.toFixed(1)} y2={needleY.toFixed(1)} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="100" cy="100" r="5" fill="#1e293b" />
                            <circle cx="100" cy="100" r="2" fill="white" />
                            {/* Score */}
                            <text x="100" y="122" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">{riskScore.toFixed(1)}</text>
                          </svg>
                          <span className={cn(
                            "inline-block px-4 py-1.5 rounded-full text-sm font-semibold -mt-1",
                            calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                            calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                            calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                            calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                            calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                          )}>
                            {t(calculatedRating)}
                          </span>
                        </div>
                      </div>
                      {/* Risk Ranges Legend */}
                      <div className="flex justify-center gap-3 mt-4">
                        {translatedRiskRanges.map((range) => (
                          <div key={range.id} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: range.color || "#94a3b8" }} />
                            <span className="text-[10px] text-slate-500">{range.title} ({range.lowRange}-{range.highRange})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Risk Calculation Breakdown */}
                    <div className="pb-5 border-b border-slate-200">
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-center text-center">
                        <div className="p-2.5 rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Likelihood")}</p>
                          <p className="text-lg font-bold text-slate-800">{calcLikelihood}</p>
                        </div>
                        <p className="font-bold text-lg text-slate-400 px-1">&times;</p>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Impact")}</p>
                          <p className="text-lg font-bold text-slate-800">{calcImpact}</p>
                        </div>
                        <p className="font-bold text-lg text-slate-400 px-1">&times;</p>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 min-w-0">
                          <p className="text-[10px] text-slate-500 uppercase truncate">{t("Vulnerability")}</p>
                          <p className="text-lg font-bold text-slate-800">{calcVulnerability}</p>
                        </div>
                        <p className="font-bold text-lg text-slate-400 px-1">=</p>
                        <div className="p-2.5 bg-primary-50 rounded-lg border border-primary-200 min-w-0">
                          <p className="text-[10px] text-primary-600 uppercase truncate">{t("Score")}</p>
                          <p className="text-lg font-bold text-primary-700">{riskScore.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Ratings Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200">
                      <div className="p-4 text-center rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase mb-2">{t("Inherent Risk")}</p>
                        <span className={cn(
                          "inline-block px-3 py-1.5 rounded-lg text-sm font-semibold",
                          calculatedRating === "Critical" || calculatedRating === "Catastrophic" ? "bg-red-100 text-red-800" : "",
                          calculatedRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                          calculatedRating === "High" ? "bg-amber-100 text-amber-800" : "",
                          calculatedRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                          calculatedRating === "Low" || calculatedRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                        )}>
                          {t(calculatedRating)}
                        </span>
                        <p className="text-xs text-slate-400 mt-1.5">{t("Score")}: {riskScore.toFixed(2)}</p>
                      </div>
                      <div className="p-4 text-center rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase mb-2">{t("Control Rating")}</p>
                        {controlRatingResult.hasControls ? (
                          <>
                            <p className="text-lg font-semibold text-slate-800">{controlRatingResult.rating.toFixed(2)}%</p>
                            <p className="text-xs text-slate-400 mt-1.5">{controlRatingResult.count} {t("controls linked")}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-semibold text-slate-800">-</p>
                            <p className="text-xs text-slate-400 mt-1.5">{t("No controls linked")}</p>
                          </>
                        )}
                      </div>
                      <div className="p-4 text-center rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase mb-2">{t("Residual Risk")}</p>
                        <span className={cn(
                          "inline-block px-3 py-1.5 rounded-lg text-sm font-semibold",
                          residualRiskRating === "Critical" || residualRiskRating === "Catastrophic" || residualRiskRating === "CataStrophic" ? "bg-red-100 text-red-800" : "",
                          residualRiskRating === "Very High" ? "bg-orange-100 text-orange-800" : "",
                          residualRiskRating === "High" ? "bg-amber-100 text-amber-800" : "",
                          residualRiskRating === "Medium" ? "bg-yellow-100 text-yellow-800" : "",
                          residualRiskRating === "Low" || residualRiskRating === "Low Risk" ? "bg-green-100 text-green-800" : ""
                        )}>
                          {t(residualRiskRating)}
                        </span>
                        <p className="text-xs text-slate-400 mt-1.5">{t("Score")}: {residualRiskScore.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Existing Controls */}
                    <div className="pb-5 border-b border-slate-200">
                      <h4 className="font-semibold text-primary-700 mb-3">{t("Existing Controls")}</h4>
                      {controlRatingResult.hasControls ? (
                        <div className="space-y-2">
                          {controlRatingResult.controls.map((ctrl, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                              <p className="text-sm font-medium text-primary-700">
                                {ctrl.controlCode} : {ctrl.name}
                              </p>
                              <div className="flex items-center gap-2">
                                {/* Mini gauge */}
                                <svg width="32" height="20" viewBox="0 0 32 20">
                                  <path d="M4 18 A14 14 0 0 1 28 18" fill="none" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
                                  <path
                                    d="M4 18 A14 14 0 0 1 28 18"
                                    fill="none"
                                    stroke={ctrl.value >= 75 ? "#22c55e" : ctrl.value >= 50 ? "#eab308" : "#f59e0b"}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(ctrl.value / 100) * 37.7} 37.7`}
                                  />
                                </svg>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-slate-800">{ctrl.value.toFixed(0)}%</p>
                                  <p className="text-[10px] text-slate-500">{ctrl.strengthName}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="text-sm text-slate-500">{t("No controls linked")}</p>
                        </div>
                      )}
                    </div>

                    {/* Assessment Details */}
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-3">{t("Assessment Details")}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Risk ID")}</p>
                          <p className="text-sm font-medium text-slate-800">{risk.riskId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Risk Name")}</p>
                          <p className="text-sm font-medium text-slate-800">{translatedRisk?.name || risk.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Likelihood Score")}</p>
                          <p className="text-sm font-medium text-slate-800">{calcLikelihood}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Impact Score")}</p>
                          <p className="text-sm font-medium text-slate-800">{calcImpact}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Vulnerability Score")}</p>
                          <p className="text-sm font-medium text-slate-800">{calcVulnerability}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase mb-0.5">{t("Control Rating")}</p>
                          <p className="text-sm font-medium text-slate-800">{controlRatingResult.hasControls ? `${controlRatingResult.rating.toFixed(2)}%` : "-"}</p>
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
            <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <span className="text-xs font-medium text-slate-400 me-auto">
                {t("Step")} {currentStep} {t("of")} {assessmentSteps.length}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Risk Response Strategy Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]" showCloseButton={false}>
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Risk Response Strategy")}</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  {t("The risk rating is not Low. Please select a response strategy and provide an explanation.")}
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
              <Label className="text-sm font-medium text-slate-700">{t("Select Strategy")}</Label>
              <RadioGroup
                value={selectedStrategy}
                onValueChange={setSelectedStrategy}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Transfer" id="transfer" />
                  <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">{t("Transfer")}</div>
                    <p className="text-sm text-slate-500">{t("Transfer the risk to a third party (e.g., insurance, outsourcing)")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Avoid" id="avoid" />
                  <Label htmlFor="avoid" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">{t("Avoid")}</div>
                    <p className="text-sm text-slate-500">{t("Eliminate the risk by not engaging in the activity")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Accept" id="accept" />
                  <Label htmlFor="accept" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">{t("Accept")}</div>
                    <p className="text-sm text-slate-500">{t("Accept the risk without taking any action")}</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="Treat" id="treat" />
                  <Label htmlFor="treat" className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800">{t("Treat")}</div>
                    <p className="text-sm text-slate-500">{t("Implement controls to reduce the risk likelihood or impact")}</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="strategy-explanation" className="text-sm font-medium text-slate-700">
                {t("Risk Response Strategy Explanation")}
              </Label>
              <Textarea
                id="strategy-explanation"
                placeholder={t("Explain how you plan to address this risk with the selected strategy...")}
                value={strategyExplanation}
                onChange={(e) => setStrategyExplanation(e.target.value)}
                className="min-h-[100px] bg-white"
              />
            </div>
          </div>
          <DialogFooter className="flex-row">
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
    </>
  );
}
