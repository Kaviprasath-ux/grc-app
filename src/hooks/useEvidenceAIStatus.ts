import { useState, useEffect, useCallback } from "react";

export interface EvidenceAIStatus {
  evidenceId: string;
  ingest: {
    status: string;
    ingestedAt: string | null;
    latestJob: {
      jobId: string;
      status: string;
      error: string | null;
      createdAt: string;
      completedAt: string | null;
    } | null;
  };
  review: {
    status: string;
    reviewedAt: string | null;
    latestReview: {
      id: string;
      status: string;
      critique: string | null;
      complianceSummary: string | null;
      complianceScore: number | null;
      gaps: any[] | null;
      suggestions: any[] | null;
      similarityScore: number | null;
      recommendations: any[] | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
}

interface UseEvidenceAIStatusResult {
  status: EvidenceAIStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

/**
 * Hook to fetch and poll AI status for an evidence
 */
export function useEvidenceAIStatus(evidenceId: string | null): UseEvidenceAIStatusResult {
  const [status, setStatus] = useState<EvidenceAIStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!evidenceId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/evidences/${evidenceId}/ai-status`);

      if (!response.ok) {
        throw new Error("Failed to fetch AI status");
      }

      const data = await response.json();
      setStatus(data);

      // Auto-stop polling if ingest is completed or failed (case-insensitive)
      const ingestStatus = data.ingest.status?.toLowerCase();
      if (
        ingestStatus === "completed" ||
        ingestStatus === "ingested" ||
        ingestStatus === "failed" ||
        ingestStatus === "not_started"
      ) {
        // Use functional update to avoid stale closure issue
        setPollInterval((currentInterval) => {
          if (currentInterval) {
            clearInterval(currentInterval);
          }
          return null;
        });
        setPolling(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Use functional update to avoid stale closure issue
      setPollInterval((currentInterval) => {
        if (currentInterval) {
          clearInterval(currentInterval);
        }
        return null;
      });
      setPolling(false);
    } finally {
      setLoading(false);
    }
  }, [evidenceId]);

  const startPolling = useCallback(() => {
    if (polling || !evidenceId) return;

    setPolling(true);
    fetchStatus(); // Fetch immediately

    const interval = setInterval(() => {
      fetchStatus();
    }, 10000); // Poll every 10 seconds

    setPollInterval(interval);
  }, [polling, evidenceId, fetchStatus]);

  const stopPolling = useCallback(() => {
    // Use functional update to get current interval value and avoid stale closure
    setPollInterval((currentInterval) => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      return null;
    });
    setPolling(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (evidenceId) {
      fetchStatus();
    }

    return () => {
      stopPolling();
    };
  }, [evidenceId]);

  // Auto-start polling if status is QUEUED or PROCESSING (case-insensitive)
  useEffect(() => {
    if (status && !polling) {
      const ingestStatus = status.ingest.status?.toLowerCase();
      if (ingestStatus === "queued" || ingestStatus === "processing") {
        startPolling();
      }
    }
  }, [status, polling]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
    startPolling,
    stopPolling,
  };
}
