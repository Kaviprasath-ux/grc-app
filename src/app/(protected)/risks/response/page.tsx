"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan: string | null;
  treatmentDueDate: string | null;
  likelihood: number;
  impact: number;
  owner: { fullName: string } | null;
  assessmentStatus?: string;
}

// Horizontal Progress Bar component matching website
function ProgressBar({
  total,
  completed,
  label
}: {
  total: number;
  completed: number;
  label: string;
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded-sm overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300"></div>
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500"></div>
            <span>{label}</span>
          </div>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className="text-sm">{completed}/{total}</span>
        <br />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export default function RiskResponsePage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [strategyFilter, setStrategyFilter] = useState("Treat");
  const [progressFilter, setProgressFilter] = useState("Completed");

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      const response = await fetch("/api/risks");
      if (response.ok) {
        const data = await response.json();
        // Only show risks that have been assessed (have a response strategy or are in progress)
        const assessedRisks = (data.data || []).filter((risk: Risk) =>
          risk.responseStrategy || risk.assessmentStatus === "Completed" || risk.assessmentStatus === "In-Progress"
        );
        setRisks(assessedRisks.length > 0 ? assessedRisks : data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (risk: Risk) => {
    router.push(`/risks/response/${risk.id}`);
  };

  const getActionButton = (risk: Risk) => {
    const status = risk.assessmentStatus || risk.status;
    if (status === "Awaiting Approval") {
      return (
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90"
          onClick={() => openDetail(risk)}
        >
          View
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className="bg-primary hover:bg-primary/90"
        onClick={() => openDetail(risk)}
      >
        Resume
      </Button>
    );
  };

  // Filter risks based on strategy
  const filteredByStrategy = strategyFilter === "all"
    ? risks
    : risks.filter((risk) => risk.responseStrategy === strategyFilter);

  // Filter risks based on progress
  const filteredByProgress = progressFilter === "all"
    ? risks
    : risks.filter((risk) =>
        (progressFilter === "Completed" && risk.assessmentStatus === "Completed") ||
        (progressFilter === "In-Progress" && risk.assessmentStatus === "In-Progress")
      );

  // Calculate stats for strategy card (based on strategy filter)
  const strategyTotal = filteredByStrategy.length;
  const strategyClosed = filteredByStrategy.filter(r => r.status === "Closed" || r.assessmentStatus === "Completed").length;

  // Calculate stats for progress card (based on progress filter)
  const progressTotal = filteredByProgress.length;
  const progressCompleted = filteredByProgress.filter(r => r.assessmentStatus === "Completed").length;

  // Display all filtered risks (combine both filters for list)
  const displayRisks = risks.filter((risk) => {
    const matchesStrategy = strategyFilter === "all" || risk.responseStrategy === strategyFilter;
    return matchesStrategy;
  });

  const clearStrategyFilter = () => setStrategyFilter("all");
  const clearProgressFilter = () => setProgressFilter("all");

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Response Strategy" breadcrumb="Risk Management" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Risk Response Strategy" breadcrumb="Risk Management" />

      {/* Summary Cards with Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Response Strategy Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Risk Response Strategy</span>
              <div className="flex items-center border rounded">
                <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                  <SelectTrigger className="w-32 h-8 border-0">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Treat">Treat</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                    <SelectItem value="Avoid">Avoid</SelectItem>
                    <SelectItem value="Accept">Accept</SelectItem>
                  </SelectContent>
                </Select>
                {strategyFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 border-l"
                    onClick={clearStrategyFilter}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <ProgressBar
              total={strategyTotal}
              completed={strategyClosed}
              label="Closed"
            />
          </CardContent>
        </Card>

        {/* Risk Response Progress Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Risk Response Progress</span>
              <div className="flex items-center border rounded">
                <Select value={progressFilter} onValueChange={setProgressFilter}>
                  <SelectTrigger className="w-32 h-8 border-0">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                  </SelectContent>
                </Select>
                {progressFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 border-l"
                    onClick={clearProgressFilter}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <ProgressBar
              total={progressTotal}
              completed={progressCompleted}
              label="Completed"
            />
          </CardContent>
        </Card>
      </div>

      {/* Risk List */}
      <div className="space-y-3">
        {displayRisks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No risks found
            </CardContent>
          </Card>
        ) : (
          displayRisks.map((risk) => (
            <Card key={risk.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{risk.riskId}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-medium">{risk.name}</span>
                    </div>
                  </div>
                  {getActionButton(risk)}
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Residual Risk Rating</p>
                    <span className={cn(
                      "text-sm font-medium",
                      risk.riskRating === "Low Risk" && "text-green-600",
                      risk.riskRating === "High" && "text-orange-600",
                      risk.riskRating === "Very high" && "text-red-600",
                      risk.riskRating === "Catastrophic" && "text-red-800"
                    )}>
                      {risk.riskRating || "-"}
                    </span>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Priority</p>
                    <p className="font-medium"></p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk DueDate</p>
                    <p className="font-medium">
                      {risk.treatmentDueDate
                        ? new Date(risk.treatmentDueDate).toLocaleDateString("en-GB")
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Status</p>
                    <span className="text-sm font-medium">
                      {risk.assessmentStatus || risk.status || "Open"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
