"use client";

import { useCallback, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVoiceRecorder, type RecorderError } from "@/hooks/useVoiceRecorder";

interface UseTranscribeResult {
  isRecording: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  error: string | null;
  /** Start microphone capture. */
  start: () => Promise<void>;
  /**
   * Stop capture, send audio to /api/ai/voice/transcribe, return the text.
   * Returns null if no audio captured or transcription failed.
   */
  stopAndTranscribe: () => Promise<string | null>;
  /** Abort capture without sending anything. */
  cancel: () => void;
}

/**
 * Captures audio with useVoiceRecorder, then POSTs the blob to the
 * Whisper-backed transcription endpoint. Locale is read from the
 * language context — no need to pass it in.
 */
export function useTranscribe(): UseTranscribeResult {
  const { locale } = useLanguage();
  const recorder = useVoiceRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setApiError(null);
    await recorder.start();
  }, [recorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    const blob = await recorder.stop();
    if (!blob) return null;

    setIsTranscribing(true);
    setApiError(null);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      fd.append("locale", locale);

      const res = await fetch("/api/ai/voice/transcribe", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errBody?.error || `Transcribe failed (${res.status})`);
      }

      const data = (await res.json()) as { text: string };
      return data.text?.trim() || null;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Transcription failed");
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder, locale]);

  const recorderErrorToMessage = (e: RecorderError): string => {
    switch (e) {
      case "permission-denied":
        return "Microphone permission denied";
      case "unsupported":
        return "Voice not supported in this browser";
      case "no-device":
        return "No microphone found";
      default:
        return "Microphone error";
    }
  };

  return {
    isRecording: recorder.isRecording,
    isTranscribing,
    isSupported: recorder.isSupported,
    error: apiError ?? (recorder.error ? recorderErrorToMessage(recorder.error) : null),
    start,
    stopAndTranscribe,
    cancel: recorder.cancel,
  };
}
