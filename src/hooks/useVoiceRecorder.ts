"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_CONFIG } from "@/lib/voice/config";

export type RecorderError =
  | "permission-denied"
  | "unsupported"
  | "no-device"
  | "unknown";

interface UseVoiceRecorderResult {
  isRecording: boolean;
  isSupported: boolean;
  error: RecorderError | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

/**
 * Wraps MediaRecorder + getUserMedia.
 * Auto-stops at VOICE_CONFIG.maxRecordingMs.
 */
export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<RecorderError | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("unsupported");
      return;
    }
    if (mediaRecorderRef.current) return; // already recording

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick a supported mime type — webm/opus first, then fall back.
      const candidates = [
        VOICE_CONFIG.audioMimeType,
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const resolver = stopResolverRef.current;
        stopResolverRef.current = null;
        cleanup();
        setIsRecording(false);
        resolver?.(blob.size > 0 ? blob : null);
      };

      recorder.start();
      setIsRecording(true);

      autoStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, VOICE_CONFIG.maxRecordingMs);
    } catch (err) {
      cleanup();
      setIsRecording(false);
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("permission-denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("no-device");
      } else {
        setError("unknown");
      }
    }
  }, [cleanup, isSupported]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setIsRecording(false);
      return null;
    }
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Replace ondata/onstop so we don't resolve with a blob the caller will use.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    if (stopResolverRef.current) {
      stopResolverRef.current(null);
      stopResolverRef.current = null;
    }
    cleanup();
    setIsRecording(false);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isRecording, isSupported, error, start, stop, cancel };
}
