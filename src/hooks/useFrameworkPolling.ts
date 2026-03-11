"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useFrameworkPolling
 * 
 * Hook for polling framework generation job status.
 * Automatically starts polling when provided a jobId.
 * Handles timeout, completion, and errors.
 */

export interface PollingState {
  jobId: string | null;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "PENDING_RESULT" | null;
  isPolling: boolean;
  isComplete: boolean;
  isFailed: boolean;
  error: string | null;
  timeElapsed: number; // milliseconds
  estimatedTimeRemaining: number; // milliseconds
  progress: number; // 0-100 percentage
}

export interface PollingOptions {
  pollInterval?: number; // milliseconds between polls (default: 15000)
  maxDuration?: number; // max polling duration in milliseconds (default: 120 * 60 * 1000 = 120 minutes)
  onStatusChange?: (status: string) => void;
  onComplete?: (jobId: string) => void;
  onFailed?: (error: string) => void;
}

const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds
const DEFAULT_MAX_DURATION = 120 * 60 * 1000; // 120 minutes
const ESTIMATED_TOTAL_TIME = 60 * 60 * 1000; // 60 minutes average

export function useFrameworkPolling(options: PollingOptions = {}) {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    maxDuration = DEFAULT_MAX_DURATION,
    onStatusChange,
    onComplete,
    onFailed,
  } = options;

  const [state, setState] = useState<PollingState>({
    jobId: null,
    status: null,
    isPolling: false,
    isComplete: false,
    isFailed: false,
    error: null,
    timeElapsed: 0,
    estimatedTimeRemaining: 0,
    progress: 0,
  });

  // Start polling for a job
  const startPolling = useCallback((jobId: string) => {
    setState((prev) => ({
      ...prev,
      jobId,
      status: "QUEUED",
      isPolling: true,
      isComplete: false,
      isFailed: false,
      error: null,
      timeElapsed: 0,
      estimatedTimeRemaining: ESTIMATED_TOTAL_TIME,
      progress: 5, // Start at 5%
    }));
  }, []);

  // Perform a single poll
  const poll = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/ai/framework-status/${jobId}`);

      if (!response.ok) {
        throw new Error(`Poll failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(
        `Failed to poll status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, []);

  // Main polling effect
  useEffect(() => {
    if (!state.isPolling || !state.jobId) {
      return;
    }

    let pollTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let intervalTimer: NodeJS.Timeout | null = null;
    let isActive = true; // Flag to track if effect is still active

    // Set initial timeout
    timeoutTimer = setTimeout(() => {
      if (!isActive) return;
      
      setState((prev) => ({
        ...prev,
        isPolling: false,
        isFailed: true,
        error: "Job timeout - exceeded 120 minutes",
        status: "FAILED",
      }));

      if (onFailed) {
        onFailed("Job timeout - exceeded 120 minutes");
      }
    }, maxDuration);

    // Update elapsed time every second
    intervalTimer = setInterval(() => {
      if (!isActive) return;
      
      setState((prev) => {
        const newElapsed = prev.timeElapsed + 1000;
        const remaining = Math.max(0, ESTIMATED_TOTAL_TIME - newElapsed);
        const progress = Math.min(95, 5 + (newElapsed / ESTIMATED_TOTAL_TIME) * 90);

        return {
          ...prev,
          timeElapsed: newElapsed,
          estimatedTimeRemaining: remaining,
          progress,
        };
      });
    }, 1000);

    // Perform initial poll immediately, then schedule subsequent polls at intervals
    const performPoll = async () => {
      if (!isActive) return;

      try {
        const result = await poll(state.jobId!);

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          status: result.status || prev.status,
        }));

        if (onStatusChange) {
          onStatusChange(result.status);
        }

        // If job is done, stop polling and try to get result
        if (result.status === "COMPLETED") {
          if (pollTimer) clearTimeout(pollTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (intervalTimer) clearInterval(intervalTimer);
          isActive = false;

          setState((prev) => ({
            ...prev,
            isPolling: false,
            isComplete: true,
            status: "PENDING_RESULT",
            progress: 90,
          }));

          if (onComplete) {
            onComplete(state.jobId!);
          }
          return;
        }

        if (result.status === "FAILED") {
          if (pollTimer) clearTimeout(pollTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (intervalTimer) clearInterval(intervalTimer);
          isActive = false;

          setState((prev) => ({
            ...prev,
            isPolling: false,
            isFailed: true,
            error: "Job failed on AI backend",
            status: "FAILED",
          }));

          if (onFailed) {
            onFailed("Job failed on AI backend");
          }
          return;
        }

        // Schedule next poll
        if (isActive) {
          pollTimer = setTimeout(performPoll, pollInterval);
        }
      } catch (error) {
        if (!isActive) return;

        if (pollTimer) clearTimeout(pollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (intervalTimer) clearInterval(intervalTimer);
        isActive = false;

        const errorMsg = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          isPolling: false,
          isFailed: true,
          error: errorMsg,
          status: "FAILED",
        }));

        if (onFailed) {
          onFailed(errorMsg);
        }
      }
    };

    // Start initial poll
    performPoll();

    // Cleanup
    return () => {
      isActive = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    };
  }, [state.isPolling, state.jobId, poll, pollInterval, maxDuration, onStatusChange, onComplete, onFailed]);

  // Stop polling manually
  const stopPolling = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPolling: false,
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      jobId: null,
      status: null,
      isPolling: false,
      isComplete: false,
      isFailed: false,
      error: null,
      timeElapsed: 0,
      estimatedTimeRemaining: 0,
      progress: 0,
    });
  }, []);

  return {
    ...state,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * Format milliseconds to human-readable time
 */
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format milliseconds to estimated remaining time
 */
export function formatRemainingTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `~${minutes}m`;
  }
  return `~${seconds}s`;
}
