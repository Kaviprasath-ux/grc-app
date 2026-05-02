/**
 * Voice feature configuration.
 *
 * To switch from push-to-talk to toggle: change `inputMode` below.
 * MicButton reads this once at module load to decide which event handlers to bind.
 */

import type { Locale } from "@/i18n/config";

export type VoiceInputMode = "push-to-talk" | "toggle";

export type OpenAITTSVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

export const VOICE_CONFIG = {
  inputMode: "push-to-talk" as VoiceInputMode,
  defaultVoice: "alloy" as OpenAITTSVoice,
  autoSpeakDefault: false,
  maxRecordingMs: 60_000,
  maxTtsChars: 4000,
  audioMimeType: "audio/webm",
  // OpenAI Whisper file size limit
  maxAudioBytes: 25 * 1024 * 1024,
} as const;

export const TTS_VOICES: OpenAITTSVoice[] = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
];

/**
 * Map app locale → ISO-639-1 code accepted by Whisper.
 * Whisper takes 2-letter codes (en, ar, lv) — same as our locale enum.
 */
export function localeToWhisperLang(locale: Locale): string {
  return locale;
}
