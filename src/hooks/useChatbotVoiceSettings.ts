"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TTS_VOICES,
  VOICE_CONFIG,
  type OpenAITTSVoice,
} from "@/lib/voice/config";

const STORAGE_KEY = "chatbot-voice-settings";

export interface ChatbotVoiceSettings {
  autoSpeak: boolean;
  voice: OpenAITTSVoice;
}

const DEFAULTS: ChatbotVoiceSettings = {
  autoSpeak: VOICE_CONFIG.autoSpeakDefault,
  voice: VOICE_CONFIG.defaultVoice,
};

function readSettings(): ChatbotVoiceSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ChatbotVoiceSettings>;
    return {
      autoSpeak:
        typeof parsed.autoSpeak === "boolean"
          ? parsed.autoSpeak
          : DEFAULTS.autoSpeak,
      voice: TTS_VOICES.includes(parsed.voice as OpenAITTSVoice)
        ? (parsed.voice as OpenAITTSVoice)
        : DEFAULTS.voice,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Persists voice preferences (auto-speak, selected voice) to localStorage.
 * Defaults: autoSpeak OFF, voice = "alloy".
 */
export function useChatbotVoiceSettings() {
  const [settings, setSettings] = useState<ChatbotVoiceSettings>(DEFAULTS);

  // Load on mount (client-only).
  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const update = useCallback((patch: Partial<ChatbotVoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  const setAutoSpeak = useCallback(
    (autoSpeak: boolean) => update({ autoSpeak }),
    [update]
  );
  const setVoice = useCallback(
    (voice: OpenAITTSVoice) => update({ voice }),
    [update]
  );

  return { settings, setAutoSpeak, setVoice };
}
