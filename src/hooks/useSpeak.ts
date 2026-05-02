"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { VOICE_CONFIG, type OpenAITTSVoice } from "@/lib/voice/config";

interface UseSpeakResult {
  /** Currently speaking any text (loading or playing). */
  isSpeaking: boolean;
  /** Fetching audio from server (before playback starts). */
  isLoading: boolean;
  /** Identifier of the message currently being spoken (for per-message UI). */
  speakingId: string | null;
  error: string | null;
  /**
   * Speak the given text. Cancels any in-flight playback.
   * @param text  Text to read aloud.
   * @param id    Optional caller-supplied id used to highlight the right message in UI.
   */
  speak: (text: string, id?: string) => Promise<void>;
  stop: () => void;
}

/**
 * Calls /api/ai/voice/speak, plays returned MP3 via a single Audio element.
 * Only one utterance at a time — calling speak() while playing replaces the previous.
 */
export function useSpeak(): UseSpeakResult {
  const { locale } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setIsLoading(false);
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [cleanup]);

  const speak = useCallback(
    async (text: string, id?: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;

      // Cancel any current playback / inflight request first.
      cleanup();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setIsSpeaking(true);
      setSpeakingId(id ?? "default");
      setError(null);

      try {
        const voice = readStoredVoice();
        const res = await fetch("/api/ai/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, voice, locale }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errBody?.error || `TTS failed (${res.status})`);
        }

        const blob = await res.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          stop();
        };
        audio.onerror = () => {
          setError("Audio playback failed");
          stop();
        };

        setIsLoading(false);
        await audio.play();
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // Cancelled — silent.
          return;
        }
        setError(err instanceof Error ? err.message : "TTS failed");
        stop();
      }
    },
    [cleanup, locale, stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { isSpeaking, isLoading, speakingId, error, speak, stop };
}

const VOICE_STORAGE_KEY = "chatbot-voice-settings";

function readStoredVoice(): OpenAITTSVoice {
  if (typeof window === "undefined") return VOICE_CONFIG.defaultVoice;
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY);
    if (!raw) return VOICE_CONFIG.defaultVoice;
    const parsed = JSON.parse(raw) as { voice?: string };
    if (parsed.voice && typeof parsed.voice === "string") {
      return parsed.voice as OpenAITTSVoice;
    }
  } catch {
    /* ignore */
  }
  return VOICE_CONFIG.defaultVoice;
}
