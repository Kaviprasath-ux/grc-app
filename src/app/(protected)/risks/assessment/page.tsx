"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { cn } from "@/lib/utils";
import { Search, ArrowUpDown, Check, ChevronLeft, ChevronRight } from "lucide-react";

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

interface Category {
  id: string;
  name: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface Threat {
  id: string;
  name: string;
}

interface Vulnerability {
  id: string;
  name: string;
}

const assessmentSteps = [
  { id: 1, name: "Risk Context" },
  { id: 2, name: "Likelihood" },
  { id: 3, name: "Impact" },
  { id: 4, name: "Vulnerability" },
  { id: 5, name: "Risk Rating" },
  { id: 6, name: "Risk Summary" },
];

const likelihoodOptions = [
  { label: "Rare", value: 1 },
  { label: "Moderate", value: 5 },
  { label: "High", value: 10 },
];

const impactCategories = [
  "Financial",
  "Reputational Impact",
  "Regulatory",
  "Safety",
  "Operational",
];

const impactOptions = [
  { label: "Low", value: 1 },
  { label: "Insignificant", value: 2 },
  { label: "Minor", value: 5 },
  { label: "High impact", value: 10 },
];

const vulnerabilityOptions = [
  { label: "strong", value: 10 },
  { label: "medium", value: 7 },
  { label: "Weak", value: 5 },
];

const riskRatingScale = [
  { label: "Low Risk", range: "[0 - 10]", min: 0, max: 10 },
  { label: "High", range: "[11 - 50]", min: 11, max: 50 },
  { label: "very high", range: "[51 - 99]", min: 51, max: 99 },
  { label: "Catastrophic", range: "[100 - 500]", min: 100, max: 500 },
];

function getRiskRatingFromScore(score: number): string {
  if (score >= 100) return "Catastrophic";
  if (score >= 51) return "very high";
  if (score >= 11) return "High";
  return "Low Risk";
}

export default function RiskAssessmentPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Assessment wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Assessment form data
  const [threatLikelihoods, setThreatLikelihoods] = useState<Record<string, number>>({});
  const [threatImpacts, setThreatImpacts] = useState<Record<string, Record<string, number>>>({});
  const [vulnerabilityRatings, setVulnerabilityRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [risksRes, categoriesRes, typesRes, threatsRes, vulnsRes] = await Promise.all([
        fetch("/api/risks"),
        fetch("/api/risk-categories"),
        fetch("/api/risk-types"),
        fetch("/api/risk-threats"),
        fetch("/api/risk-vulnerabilities"),
      ]);

      if (risksRes.ok) {
        const data = await risksRes.json();
        setRisks(data.data || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setRiskTypes(data);
      }
      if (threatsRes.ok) {
        const data = await threatsRes.json();
        setThreats(data);
      }
      if (vulnsRes.ok) {
        const data = await vulnsRes.json();
        setVulnerabilities(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter risks
  const filteredRisks = risks.filter((risk) => {
    const matchesSearch =
      searchTerm === "" ||
      risk.riskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || (risk.assessmentStatus || "Open") === statusFilter;

    const matchesRating =
      ratingFilter === "all" || risk.riskRating === ratingFilter;

    const matchesCategory =
      categoryFilter === "all" || risk.category?.id === categoryFilter;

    const matchesType =
      typeFilter === "all" || risk.type?.id === typeFilter;

    return matchesSearch && matchesStatus && matchesRating && matchesCategory && matchesType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRisks.length / pageSize);
  const paginatedRisks = filteredRisks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getActionButton = (risk: Risk) => {
    const status = risk.assessmentStatus || "Open";
    switch (status) {
      case "Completed":
        return (
          <Button size="sm" variant="outline" onClick={() => openAssessment(risk)}>
            Re-assess
          </Button>
        );
      case "In-Progress":
        return (
          <Button size="sm" variant="outline" onClick={() => openAssessment(risk)}>
            Resume
          </Button>
        );
      default:
        return (
          <Button size="sm" onClick={() => openAssessment(risk)}>
            Initiate
          </Button>
        );
    }
  };

  const openAssessment = (risk: Risk) => {
    setSelectedRisk(risk);
    setCurrentStep(1);
    // Reset form data
    setThreatLikelihoods({});
    setThreatImpacts({});
    setVulnerabilityRatings({});
    setWizardOpen(true);
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
    if (!selectedRisk) return;

    // Calculate scores
    const likelihoodValues = Object.values(threatLikelihoods);
    const avgLikelihood = likelihoodValues.length > 0
      ? likelihoodValues.reduce((a, b) => a + b, 0) / likelihoodValues.length
      : 0;

    // For impact, take the max of each threat's max category
    let maxImpact = 0;
    Object.values(threatImpacts).forEach((categories) => {
      const categoryMax = Math.max(...Object.values(categories), 0);
      if (categoryMax > maxImpact) maxImpact = categoryMax;
    });

    const vulnerabilityValues = Object.values(vulnerabilityRatings);
    const avgVulnerability = vulnerabilityValues.length > 0
      ? vulnerabilityValues.reduce((a, b) => a + b, 0) / vulnerabilityValues.length
      : 0;

    const riskScore = avgLikelihood * maxImpact * (avgVulnerability / 10);
    const riskRating = getRiskRatingFromScore(riskScore);

    try {
      // Update risk with assessment data
      await fetch(`/api/risks/${selectedRisk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihood: Math.round(avgLikelihood),
          impact: Math.round(maxImpact),
          riskRating,
          assessmentStatus: "Completed",
        }),
      });

      setWizardOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to save assessment:", error);
    }
  };

  const riskThreats = selectedRisk?.threats?.map((t) => t.threat) || threats.slice(0, 3);
  const riskVulnerabilities = selectedRisk?.vulnerabilities?.map((v) => v.vulnerability) || vulnerabilities.slice(0, 3);

  // Calculate current scores for display
  const calcLikelihood = Object.values(threatLikelihoods).length > 0
    ? Math.round(Object.values(threatLikelihoods).reduce((a, b) => a + b, 0) / Object.values(threatLikelihoods).length)
    : 0;

  let calcImpact = 0;
  Object.values(threatImpacts).forEach((categories) => {
    const categoryMax = Math.max(...Object.values(categories), 0);
    if (categoryMax > calcImpact) calcImpact = categoryMax;
  });

  const calcVulnerability = Object.values(vulnerabilityRatings).length > 0
    ? Math.round(Object.values(vulnerabilityRatings).reduce((a, b) => a + b, 0) / Object.values(vulnerabilityRatings).length)
    : 0;

  const riskScore = calcLikelihood * calcImpact * (calcVulnerability / 10 || 1);
  const calculatedRating = getRiskRatingFromScore(riskScore);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Assessment" description="Assess and evaluate risks" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Assessment"
        breadcrumb="Risk Management"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search By Risk ID, Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            <SelectItem value="Assessment Pending">Assessment Pending</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In-Progress">In-Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Risk Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk Rating</SelectItem>
            <SelectItem value="Catastrophic">Catastrophic</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Low Risk">Low Risk</SelectItem>
            <SelectItem value="very high">very high</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Category</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Risk type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk type</SelectItem>
            {riskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Grid */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk ID <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Name <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Description <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Rating <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Category <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Owner <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  RiskType <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Status <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRisks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No risks found
                </TableCell>
              </TableRow>
            ) : (
              paginatedRisks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell className="font-medium">{risk.riskId}</TableCell>
                  <TableCell>{risk.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{risk.description}</TableCell>
                  <TableCell>
                    {risk.riskRating ? <RiskRatingBadge rating={risk.riskRating} /> : "-"}
                  </TableCell>
                  <TableCell>{risk.category?.name || "-"}</TableCell>
                  <TableCell>{risk.owner?.fullName || "No items found"}</TableCell>
                  <TableCell>{risk.type?.name || "-"}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      (risk.assessmentStatus || "Open") === "Completed" && "bg-green-100 text-green-800",
                      (risk.assessmentStatus || "Open") === "In-Progress" && "bg-yellow-100 text-yellow-800",
                      (risk.assessmentStatus || "Open") === "Open" && "bg-blue-100 text-blue-800"
                    )}>
                      {risk.assessmentStatus || "Open"}
                    </span>
                  </TableCell>
                  <TableCell>{getActionButton(risk)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Currently showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredRisks.length)} of {filteredRisks.length}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-2" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-2" />
          </Button>
        </div>
      </div>

      {/* Assessment Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Risk Assessment</DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <nav className="mb-6">
            <ol className="flex items-center justify-between">
              {assessmentSteps.map((step, index) => (
                <li key={step.id} className="flex-1 flex flex-col items-center relative">
                  <div className="flex items-center">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                        currentStep > step.id
                          ? "border-green-500 bg-green-500 text-white"
                          : currentStep === step.id
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-gray-500"
                      )}
                    >
                      {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                    </button>
                  </div>
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className="mt-1 text-xs text-center text-muted-foreground hover:text-foreground"
                  >
                    {step.name}
                  </button>
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

          {selectedRisk && (
            <>
              {/* Risk Header (shown on all steps) */}
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <div className="flex gap-2 items-center">
                  <h4 className="font-bold">{selectedRisk.riskId}</h4>
                  <h4 className="font-bold">{selectedRisk.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{selectedRisk.description}</p>
              </div>

              {/* Step 1: Risk Context */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Category</p>
                      <p className="font-medium">{selectedRisk.category?.name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Owner</p>
                      <p className="font-medium">{selectedRisk.owner?.fullName || "No items found"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Sources</p>
                      <p className="font-medium">{selectedRisk.riskSources || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Likelihood */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {riskThreats.length > 0 ? (
                    riskThreats.map((threat) => (
                      <div key={threat.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">{threat.name}</h4>
                        <div className="flex gap-2">
                          {likelihoodOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setThreatLikelihoods({
                                ...threatLikelihoods,
                                [threat.id]: option.value
                              })}
                              className={cn(
                                "flex-1 p-3 rounded-lg border text-center transition-colors",
                                threatLikelihoods[threat.id] === option.value
                                  ? "border-primary bg-primary/10"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <p className="font-medium">{option.label}</p>
                              <p className="text-lg font-bold">{option.value}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No threats associated with this risk
                    </p>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Timeframe</span>
                    <span>Probability</span>
                  </div>
                </div>
              )}

              {/* Step 3: Impact */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  {riskThreats.map((threat) => (
                    <div key={threat.id} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">{threat.name}</h4>
                      <div className="grid grid-cols-2 gap-2 mb-2 text-sm text-muted-foreground">
                        <span>Category</span>
                        <span>Impact Rating</span>
                      </div>
                      {impactCategories.map((category) => (
                        <div key={category} className="grid grid-cols-2 gap-2 py-2 border-t">
                          <span className="text-sm">{category}</span>
                          <Select
                            value={threatImpacts[threat.id]?.[category]?.toString() || ""}
                            onValueChange={(value) => {
                              setThreatImpacts({
                                ...threatImpacts,
                                [threat.id]: {
                                  ...threatImpacts[threat.id],
                                  [category]: parseInt(value)
                                }
                              });
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {impactOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value.toString()}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm">
                          Impact Rating = {Math.max(...Object.values(threatImpacts[threat.id] || {}), 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Note: The highest rating will be taken</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: Vulnerability */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  {riskVulnerabilities.length > 0 ? (
                    riskVulnerabilities.map((vuln) => (
                      <div key={vuln.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">{vuln.name}</h4>
                        <div className="flex gap-2">
                          {vulnerabilityOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setVulnerabilityRatings({
                                ...vulnerabilityRatings,
                                [vuln.id]: option.value
                              })}
                              className={cn(
                                "flex-1 p-3 rounded-lg border text-center transition-colors",
                                vulnerabilityRatings[vuln.id] === option.value
                                  ? "border-primary bg-primary/10"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <p className="font-medium">{option.label}</p>
                              <p className="text-lg font-bold">{option.value}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No vulnerabilities associated with this risk
                    </p>
                  )}
                </div>
              )}

              {/* Step 5: Risk Rating */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-4">Inherent Risk</h4>
                    <div className="flex items-center gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">=</p>
                        <p className="text-2xl font-bold">{calcLikelihood}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">*</p>
                        <p className="text-2xl font-bold">{calcImpact}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">*</p>
                        <p className="text-2xl font-bold">{calcVulnerability}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-sm">Inherent Risk Rating</span>
                      <RiskRatingBadge rating={calculatedRating} />
                      <span className="text-sm">({riskScore.toFixed(2)})</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Risk Score = Likelihood * Impact * Vulnerability
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Risk Tolerance = 10
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {riskRatingScale.map((scale) => (
                      <div
                        key={scale.label}
                        className={cn(
                          "p-3 rounded-lg border text-center",
                          calculatedRating === scale.label && "border-primary bg-primary/10"
                        )}
                      >
                        <p className="font-medium text-sm">{scale.label}</p>
                        <p className="text-xs text-muted-foreground">{scale.range}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 6: Risk Summary */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Inherent Risk Rating</p>
                      <div className="mt-2">
                        <RiskRatingBadge rating={calculatedRating} />
                      </div>
                      <p className="text-xs mt-1">({riskScore.toFixed(2)})</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Overall Control Rating</p>
                      <p className="text-lg font-bold mt-2">-</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Residual Risk Rating</p>
                      <div className="mt-2">
                        <RiskRatingBadge rating={calculatedRating} />
                      </div>
                      <p className="text-xs mt-1">({riskScore.toFixed(2)})</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Existing Controls</h4>
                    <p className="text-sm text-muted-foreground">No controls linked to this risk</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              {currentStep < assessmentSteps.length ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSave}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
