"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEvidenceAIStatus } from "@/hooks/useEvidenceAIStatus";
import { AIStatusBadge } from "./AIStatusBadge";

interface EvidenceAIReviewProps {
  evidenceId: string;
  hasAttachments: boolean;
}

// Types for AI review response data
interface GapItem {
  issue?: string;
  risk?: string;
  severity?: string;
  status?: string;
  controlCode?: string;
  description?: string;
  gap?: string;
}

interface SuggestionItem {
  risk?: string;
  severity?: string;
  controlCode?: string;
  description?: string;
  suggestion?: string;
}

interface RawResponseItem {
  status_code?: number;
  question?: string;
  control_code?: string;
  answer?: string;
  score?: number | null;
  status?: string;
  uuid?: string;
  Issue?: string;
  Risk?: string;
  Severity?: string;
}

export function EvidenceAIReview({ evidenceId, hasAttachments }: EvidenceAIReviewProps) {
  const { status, loading, error, refresh, startPolling } = useEvidenceAIStatus(evidenceId);
  const [triggering, setTriggering] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Trigger AI Ingest
  const handleTriggerIngest = async () => {
    if (!hasAttachments) {
      toast.error("Please upload evidence files first");
      return;
    }

    setTriggering(true);
    try {
      const response = await fetch("/api/ai/evidence/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to trigger AI ingest");
      }

      const data = await response.json();
      toast.success("AI ingest started successfully");

      // Start polling for status
      startPolling();

      // Refresh status
      await refresh();
    } catch (err) {
      console.error("Error triggering ingest:", err);
      toast.error(err instanceof Error ? err.message : "Failed to trigger AI ingest");
    } finally {
      setTriggering(false);
    }
  };

  // Trigger AI Review
  const handleTriggerReview = async () => {
    setReviewing(true);
    try {
      const response = await fetch("/api/ai/evidence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to trigger AI review");
      }

      const data = await response.json();
      toast.success("AI review completed successfully");

      // Refresh status to show results
      await refresh();
    } catch (err) {
      console.error("Error triggering review:", err);
      toast.error(err instanceof Error ? err.message : "Failed to trigger AI review");
    } finally {
      setReviewing(false);
    }
  };

  // Clear AI Review - calls cleanup endpoint to delete from RunPod
  const handleClearAIReview = async () => {
    setClearing(true);
    try {
      const response = await fetch("/api/ai/evidence/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to clear AI review");
      }

      const data = await response.json();
      console.log("[Clear AI Review] Cleanup completed:", data);
      toast.success("AI review cleared successfully");

      // Refresh status
      await refresh();
    } catch (err) {
      console.error("Error clearing AI review:", err);
      toast.error(err instanceof Error ? err.message : "Failed to clear AI review");
    } finally {
      setClearing(false);
    }
  };

  if (loading && !status) {
    return (
      <Card className="mb-4">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4 border-red-200">
        <CardContent className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const ingestStatus = status?.ingest.status || "NOT_STARTED";
  const reviewStatus = status?.review.status || "NOT_READY";
  const latestReview = status?.review.latestReview;

  const canTriggerIngest = hasAttachments && (ingestStatus === "NOT_STARTED" || ingestStatus === "FAILED");
  const isIngestComplete = ingestStatus === "INGESTED" || ingestStatus === "COMPLETED";
  const canTriggerReview = isIngestComplete && reviewStatus !== "IN_PROGRESS" && reviewStatus !== "COMPLETED";
  const isProcessing = ingestStatus === "QUEUED" || ingestStatus === "PROCESSING" || reviewStatus === "IN_PROGRESS";

  return (
    <Card className="mb-4">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className={`h-5 w-5 ${reviewStatus === "COMPLETED" ? "text-green-600" : "text-slate-400"}`} />
            <span className="font-medium">AI Review</span>
          </div>
          <div className="flex items-center gap-2">
            {ingestStatus !== "NOT_STARTED" && <AIStatusBadge status={ingestStatus} size="sm" />}
            {reviewStatus !== "NOT_READY" && <AIStatusBadge status={reviewStatus} size="sm" />}
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {(ingestStatus !== "NOT_STARTED" || reviewStatus !== "NOT_READY") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAIReview}
                disabled={clearing || isProcessing}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Clear AI Review"
              >
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ingest Section */}
        {ingestStatus === "NOT_STARTED" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Upload evidence files and trigger AI processing to extract and analyze content.
            </p>
            <Button
              onClick={handleTriggerIngest}
              disabled={!hasAttachments || triggering}
              size="sm"
              variant="outline"
            >
              {triggering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting AI Processing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Start AI Processing
                </>
              )}
            </Button>
            {!hasAttachments && (
              <p className="text-xs text-amber-600">Upload evidence files first</p>
            )}
          </div>
        )}

        {(ingestStatus === "QUEUED" || ingestStatus === "PROCESSING") && (
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800">
              AI is processing your evidence files. This may take a few minutes...
            </AlertDescription>
          </Alert>
        )}

        {ingestStatus === "FAILED" && status?.ingest.latestJob?.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              AI processing failed: {status.ingest.latestJob.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Review Section */}
        {isIngestComplete && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-slate-600">
                {reviewStatus === "COMPLETED"
                  ? "AI review completed"
                  : reviewStatus === "IN_PROGRESS"
                    ? "AI review in progress..."
                    : "Evidence processed and ready for AI review"}
              </p>
            </div>

            {canTriggerReview && (
              <Button
                onClick={handleTriggerReview}
                disabled={reviewing || reviewStatus === "IN_PROGRESS"}
                size="sm"
              >
                {reviewing || reviewStatus === "IN_PROGRESS" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Start AI Review
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Review Results */}
        {latestReview && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-slate-800">AI Review Results</h4>
            </div>

            {/* Compliance Status */}
            {latestReview.critique && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Status:</span>
                <Badge variant={latestReview.critique === "compliant" ? "default" : "destructive"}>
                  {latestReview.critique}
                </Badge>
              </div>
            )}

            {latestReview.complianceScore !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Compliance Score:</span>
                <Badge variant={latestReview.complianceScore >= 80 ? "default" : "destructive"}>
                  {latestReview.complianceScore.toFixed(1)}%
                </Badge>
              </div>
            )}

            {latestReview.complianceSummary && (
              <div className="bg-slate-50 rounded-lg p-3">
                <h5 className="text-sm font-medium text-slate-700 mb-2">AI Analysis</h5>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {latestReview.complianceSummary}
                </p>
              </div>
            )}

            {latestReview.gaps && latestReview.gaps.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <h5 className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Identified Issues
                </h5>
                <div className="space-y-2">
                  {latestReview.gaps.map((gap: GapItem | string, idx: number) => (
                    <div key={idx} className="text-sm text-amber-800 border-b border-amber-200 pb-2 last:border-0 last:pb-0">
                      {typeof gap === "string" ? (
                        <p>{gap}</p>
                      ) : (
                        <>
                          {gap.issue && <p className="font-medium">{gap.issue}</p>}
                          {gap.risk && <p className="text-amber-700 mt-1">Risk: {gap.risk}</p>}
                          {gap.severity && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Severity: {gap.severity}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latestReview.suggestions && latestReview.suggestions.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h5 className="text-sm font-medium text-blue-900 mb-2">Risk Assessment</h5>
                <div className="space-y-2">
                  {latestReview.suggestions.map((suggestion: SuggestionItem | string, idx: number) => (
                    <div key={idx} className="text-sm text-blue-800 border-b border-blue-200 pb-2 last:border-0 last:pb-0">
                      {typeof suggestion === "string" ? (
                        <p>{suggestion}</p>
                      ) : (
                        <>
                          {suggestion.risk && <p>{suggestion.risk}</p>}
                          {suggestion.severity && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Severity: {suggestion.severity}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Response Details - show detailed items if available */}
            {latestReview.rawResponse && Array.isArray(latestReview.rawResponse) && latestReview.rawResponse.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3">
                <h5 className="text-sm font-medium text-slate-700 mb-2">Control Assessment Details</h5>
                <div className="space-y-3">
                  {latestReview.rawResponse.map((item: RawResponseItem, idx: number) => (
                    <div key={idx} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                      {item.control_code && (
                        <p className="text-xs font-medium text-slate-500">Control: {item.control_code}</p>
                      )}
                      {item.answer && (
                        <p className="text-sm text-slate-600 mt-1">{item.answer}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {item.status && (
                          <Badge variant={item.status === "compliant" ? "default" : "destructive"} className="text-xs">
                            {item.status}
                          </Badge>
                        )}
                        {item.Severity && (
                          <Badge variant="outline" className="text-xs">
                            {item.Severity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Reviewed: {new Date(latestReview.createdAt).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
