"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, ChevronRight, ChevronLeft } from "lucide-react";
import { PageHeader, TimelineSteps } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  assessmentStatus: string;
  category: { name: string } | null;
  owner: { fullName: string } | null;
  riskType: string;
  likelihoodScore: number | null;
  impactScore: number | null;
  vulnerabilityScore: number | null;
  inherentRiskRating: number | null;
  riskThreats: { threat: { id: string; name: string }; likelihoodScore: number | null }[];
  riskVulnerabilities: { vulnerability: { id: string; name: string }; score: number | null }[];
  riskControls: { control: { id: string; controlCode: string; name: string }; effectiveness: number | null }[];
}

interface ImpactCategory {
  id: string;
  name: string;
}

interface ImpactRating {
  id: string;
  name: string;
  score: number;
}

interface VulnerabilityRating {
  id: string;
  name: string;
  score: number;
}

interface Likelihood {
  id: string;
  title: string;
  score: number;
}

const STEPS = [
  { id: 1, name: "Risk Context" },
  { id: 2, name: "Likelihood" },
  { id: 3, name: "Impact" },
  { id: 4, name: "Vulnerability" },
  { id: 5, name: "Risk Rating" },
  { id: 6, name: "Risk Summary" },
];

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

export default function RiskAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Master data
  const [impactCategories, setImpactCategories] = useState<ImpactCategory[]>([]);
  const [impactRatings, setImpactRatings] = useState<ImpactRating[]>([]);
  const [vulnRatings, setVulnRatings] = useState<VulnerabilityRating[]>([]);
  const [likelihoods, setLikelihoods] = useState<Likelihood[]>([]);

  // Assessment data
  const [threatLikelihoods, setThreatLikelihoods] = useState<Record<string, number>>({});
  const [threatImpacts, setThreatImpacts] = useState<Record<string, Record<string, { rating: string; score: number }>>>({});
  const [vulnScores, setVulnScores] = useState<Record<string, { rating: string; score: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [riskRes, impactCatsRes, impactRatingsRes, vulnRatingsRes, likelihoodsRes] = await Promise.all([
          fetch(`/api/risks/${resolvedParams.id}`),
          fetch("/api/impact-categories"),
          fetch("/api/impact-ratings"),
          fetch("/api/vulnerability-ratings"),
          fetch("/api/likelihoods"),
        ]);

        const riskData = await riskRes.json();
        setRisk(riskData);
        setImpactCategories(await impactCatsRes.json());
        setImpactRatings(await impactRatingsRes.json());
        setVulnRatings(await vulnRatingsRes.json());
        setLikelihoods(await likelihoodsRes.json());

        // Initialize threat likelihoods
        const initLikelihoods: Record<string, number> = {};
        riskData.riskThreats?.forEach((rt: { threat: { id: string }; likelihoodScore: number | null }) => {
          initLikelihoods[rt.threat.id] = rt.likelihoodScore || 1;
        });
        setThreatLikelihoods(initLikelihoods);

        // Initialize vulnerability scores
        const initVulns: Record<string, { rating: string; score: number }> = {};
        riskData.riskVulnerabilities?.forEach((rv: { vulnerability: { id: string }; score: number | null }) => {
          initVulns[rv.vulnerability.id] = { rating: "Weak", score: rv.score || 5 };
        });
        setVulnScores(initVulns);

        // If already assessed, mark all steps complete
        if (riskData.assessmentStatus === "Assessed" || riskData.status === "Completed") {
          setCompletedSteps([1, 2, 3, 4, 5, 6]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [resolvedParams.id]);

  const calculateRiskScore = () => {
    const maxLikelihood = Math.max(...Object.values(threatLikelihoods), 1);
    let maxImpact = 0;
    Object.values(threatImpacts).forEach(impacts => {
      Object.values(impacts).forEach(impact => {
        if (impact.score > maxImpact) maxImpact = impact.score;
      });
    });
    if (maxImpact === 0) maxImpact = 10;
    const maxVuln = Math.max(...Object.values(vulnScores).map(v => v.score), 5);
    return maxLikelihood * maxImpact * maxVuln;
  };

  const getRatingFromScore = (score: number) => {
    if (score <= 10) return "Low Risk";
    if (score <= 50) return "High";
    if (score <= 99) return "very high";
    return "Catastrophic";
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const handleNext = () => {
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndExit = async () => {
    if (!risk) return;
    setSaving(true);

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "In-Progress",
          assessmentStatus: "In-Progress",
        }),
      });
      router.push("/risk-management/assessment");
    } catch (error) {
      console.error("Error saving:", error);
    }
    setSaving(false);
  };

  const handleCompleteAssessment = async () => {
    if (!risk) return;
    setSaving(true);

    const score = calculateRiskScore();
    const rating = getRatingFromScore(score);

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihoodScore: Math.max(...Object.values(threatLikelihoods), 1),
          impactScore: Math.max(...Object.values(threatImpacts).flatMap(t => Object.values(t).map(i => i.score)), 10),
          vulnerabilityScore: Math.max(...Object.values(vulnScores).map(v => v.score), 5),
          inherentRiskRating: score,
          riskRating: rating,
          status: "Completed",
          assessmentStatus: "Assessed",
          assessmentDate: new Date().toISOString(),
        }),
      });
      router.push("/risk-management/assessment");
    } catch (error) {
      console.error("Error completing assessment:", error);
    }
    setSaving(false);
  };

  // Step renderers
  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Risk Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Risk ID</Label>
            <p className="text-lg font-medium">{risk?.riskId}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Risk Name</Label>
            <p className="text-lg font-medium">{risk?.name}</p>
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-muted-foreground">Description</Label>
            <p className="text-lg">{risk?.description || "-"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Risk Category</Label>
            <p className="text-lg font-medium">{risk?.category?.name || "-"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Risk Owner</Label>
            <p className="text-lg font-medium">{risk?.owner?.fullName || "-"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Risk Type</Label>
            <p className="text-lg font-medium">{risk?.riskType || "-"}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current Status</Label>
            <Badge variant="outline">{risk?.status}</Badge>
          </div>
        </div>

        {/* Linked Threats */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Linked Threats</Label>
          {risk?.riskThreats && risk.riskThreats.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {risk.riskThreats.map(rt => (
                <Badge key={rt.threat.id} variant="secondary">{rt.threat.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No threats linked</p>
          )}
        </div>

        {/* Linked Vulnerabilities */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Linked Vulnerabilities</Label>
          {risk?.riskVulnerabilities && risk.riskVulnerabilities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {risk.riskVulnerabilities.map(rv => (
                <Badge key={rv.vulnerability.id} variant="secondary">{rv.vulnerability.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No vulnerabilities linked</p>
          )}
        </div>

        {/* Linked Controls */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Linked Controls</Label>
          {risk?.riskControls && risk.riskControls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {risk.riskControls.map(rc => (
                <Badge key={rc.control.id} variant="secondary">
                  {rc.control.controlCode} - {rc.control.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No controls linked</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Likelihood Assessment</CardTitle>
        <p className="text-sm text-muted-foreground">Rate the likelihood of each threat occurring</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {risk?.riskThreats && risk.riskThreats.length > 0 ? (
          risk.riskThreats.map(rt => (
            <div key={rt.threat.id} className="flex items-center justify-between border rounded-lg p-4">
              <span className="font-medium">{rt.threat.name}</span>
              <div className="flex gap-2">
                {likelihoods.map(l => (
                  <Button
                    key={l.id}
                    size="sm"
                    variant={threatLikelihoods[rt.threat.id] === l.score ? "default" : "outline"}
                    onClick={() => setThreatLikelihoods(prev => ({ ...prev, [rt.threat.id]: l.score }))}
                  >
                    {l.title} ({l.score})
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No threats have been linked to this risk. Please add threats in the Risk Register first.
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Impact Assessment</CardTitle>
        <p className="text-sm text-muted-foreground">Rate the impact for each threat across impact categories</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {risk?.riskThreats && risk.riskThreats.length > 0 ? (
          risk.riskThreats.map(rt => (
            <div key={rt.threat.id} className="border rounded-lg p-4 space-y-4">
              <p className="font-semibold text-lg">{rt.threat.name}</p>
              <div className="grid gap-3">
                {impactCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <Select
                      value={threatImpacts[rt.threat.id]?.[cat.id]?.rating || ""}
                      onValueChange={(v) => {
                        const rating = impactRatings.find(r => r.name === v);
                        setThreatImpacts(prev => ({
                          ...prev,
                          [rt.threat.id]: {
                            ...(prev[rt.threat.id] || {}),
                            [cat.id]: { rating: v, score: rating?.score || 10 },
                          },
                        }));
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent>
                        {impactRatings.map(r => (
                          <SelectItem key={r.id} value={r.name}>
                            {r.name} ({r.score})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No threats have been linked to this risk.
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Vulnerability Assessment</CardTitle>
        <p className="text-sm text-muted-foreground">Rate the vulnerability strength for each vulnerability</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {risk?.riskVulnerabilities && risk.riskVulnerabilities.length > 0 ? (
          risk.riskVulnerabilities.map(rv => (
            <div key={rv.vulnerability.id} className="flex items-center justify-between border rounded-lg p-4">
              <span className="font-medium">{rv.vulnerability.name}</span>
              <div className="flex gap-2">
                {vulnRatings.map(vr => (
                  <Button
                    key={vr.id}
                    size="sm"
                    variant={vulnScores[rv.vulnerability.id]?.rating === vr.name ? "default" : "outline"}
                    onClick={() => setVulnScores(prev => ({
                      ...prev,
                      [rv.vulnerability.id]: { rating: vr.name, score: vr.score },
                    }))}
                  >
                    {vr.name} ({vr.score})
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No vulnerabilities have been linked to this risk. Please add vulnerabilities in the Risk Register first.
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep5 = () => {
    const score = calculateRiskScore();
    const rating = getRatingFromScore(score);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Rating Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-6 rounded-lg">
            <p className="text-sm mb-4 text-muted-foreground">
              Risk Score = Likelihood × Impact × Vulnerability
            </p>
            <p className="text-4xl font-bold">{score.toFixed(2)}</p>
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-lg">Inherent Risk Rating:</Label>
            <Badge className={`${ratingColors[rating]} text-lg px-4 py-2`}>{rating}</Badge>
          </div>

          <div className="border rounded-lg p-4">
            <p className="font-medium mb-4">Risk Range Reference:</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>Low Risk: 0 - 10</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span>High: 11 - 50</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span>Very High: 51 - 99</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span>Catastrophic: 100 - 500</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStep6 = () => {
    const score = calculateRiskScore();
    const rating = getRatingFromScore(score);
    const controlEffectiveness = risk?.riskControls?.length
      ? risk.riskControls.reduce((acc, rc) => acc + (rc.effectiveness || 0), 0) / risk.riskControls.length
      : 0;
    const residualRisk = score * (1 - controlEffectiveness / 100);
    const residualRating = getRatingFromScore(residualRisk);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <Label className="text-muted-foreground">Inherent Risk Score</Label>
              <p className="text-3xl font-bold mt-2">{score.toFixed(2)}</p>
              <Badge className={`${ratingColors[rating]} mt-2`}>{rating}</Badge>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <Label className="text-muted-foreground">Control Effectiveness</Label>
              <p className="text-3xl font-bold mt-2">{controlEffectiveness.toFixed(1)}%</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <Label className="text-muted-foreground">Residual Risk Score</Label>
              <p className="text-3xl font-bold mt-2">{residualRisk.toFixed(2)}</p>
              <Badge className={`${ratingColors[residualRating]} mt-2`}>{residualRating}</Badge>
            </div>
          </div>

          {/* Assessment Details */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Likelihood Assessment</Label>
                <div className="mt-2 space-y-1">
                  {risk?.riskThreats?.map(rt => (
                    <div key={rt.threat.id} className="flex justify-between text-sm">
                      <span>{rt.threat.name}</span>
                      <span className="font-medium">{threatLikelihoods[rt.threat.id] || "-"}</span>
                    </div>
                  ))}
                  {(!risk?.riskThreats || risk.riskThreats.length === 0) && (
                    <span className="text-muted-foreground text-sm">No threats</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Vulnerability Assessment</Label>
                <div className="mt-2 space-y-1">
                  {risk?.riskVulnerabilities?.map(rv => (
                    <div key={rv.vulnerability.id} className="flex justify-between text-sm">
                      <span>{rv.vulnerability.name}</span>
                      <span className="font-medium">{vulnScores[rv.vulnerability.id]?.rating || "-"}</span>
                    </div>
                  ))}
                  {(!risk?.riskVulnerabilities || risk.riskVulnerabilities.length === 0) && (
                    <span className="text-muted-foreground text-sm">No vulnerabilities</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Existing Controls</Label>
              <div className="mt-2 space-y-2">
                {risk?.riskControls?.map(rc => (
                  <div key={rc.control.id} className="border rounded p-2 text-sm">
                    <p className="font-medium">{rc.control.controlCode} - {rc.control.name}</p>
                    {rc.effectiveness && (
                      <p className="text-muted-foreground">Effectiveness: {rc.effectiveness}%</p>
                    )}
                  </div>
                ))}
                {(!risk?.riskControls || risk.riskControls.length === 0) && (
                  <span className="text-muted-foreground text-sm">No controls linked</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Risk not found</p>
        <Button className="mt-4" onClick={() => router.push("/risk-management/assessment")}>
          Back to Assessment List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Risk Assessment - ${risk.riskId}`}
        description={risk.name}
        actions={[
          {
            label: "Back",
            onClick: () => router.push("/risk-management/assessment"),
            variant: "outline" as const,
            icon: ArrowLeft,
          },
          {
            label: "Save & Exit",
            onClick: handleSaveAndExit,
            variant: "outline" as const,
            icon: Save,
          },
        ]}
      />

      {/* Timeline Steps */}
      <Card>
        <CardContent className="pt-6">
          <TimelineSteps
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
            allowNavigation={true}
          />
        </CardContent>
      </Card>

      {/* Current Step Content */}
      {renderCurrentStep()}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <div className="flex gap-2">
          {currentStep < 6 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCompleteAssessment} disabled={saving}>
              {saving ? "Completing..." : "Complete Assessment"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
