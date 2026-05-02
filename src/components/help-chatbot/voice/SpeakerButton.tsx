"use client";

import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface SpeakerButtonProps {
  text: string;
  /** Unique id for this message — used to highlight only the active speaker. */
  messageId: string;
  /** id currently being spoken by the shared useSpeak instance, if any. */
  speakingId: string | null;
  isSpeaking: boolean;
  isLoading: boolean;
  onSpeak: (text: string, id: string) => void;
  onStop: () => void;
}

/**
 * Small "read aloud" toggle on bot messages.
 * Clicking while speaking stops; clicking otherwise plays.
 */
export function SpeakerButton({
  text,
  messageId,
  speakingId,
  isSpeaking,
  isLoading,
  onSpeak,
  onStop,
}: SpeakerButtonProps) {
  const { t } = useLanguage();
  const isActive = isSpeaking && speakingId === messageId;
  const isThisLoading = isLoading && speakingId === messageId;

  const handleClick = () => {
    if (isActive) onStop();
    else onSpeak(text, messageId);
  };

  const title = isActive
    ? t("Stop reading")
    : isThisLoading
      ? t("Loading...")
      : t("Read aloud");

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full",
        "transition-colors text-slate-400 hover:text-primary-600 hover:bg-slate-100",
        isActive && "text-primary-600 bg-primary-50"
      )}
    >
      {isThisLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isActive ? (
        <VolumeX className="w-3 h-3" />
      ) : (
        <Volume2 className="w-3 h-3" />
      )}
    </button>
  );
}
