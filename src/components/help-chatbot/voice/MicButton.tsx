"use client";

import { useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { VOICE_CONFIG } from "@/lib/voice/config";
import { useTranscribe } from "@/hooks/useTranscribe";

interface MicButtonProps {
  /** Called with the transcribed text. Empty/null returns are skipped. */
  onTranscript: (text: string) => void;
  /** Called as soon as recording starts (e.g., to stop bot TTS). */
  onRecordingStart?: () => void;
  /** Disable the button (e.g., while bot is responding). */
  disabled?: boolean;
}

/**
 * Mic button with two interaction modes selected by VOICE_CONFIG.inputMode:
 *   - "push-to-talk": hold to record, release to transcribe.
 *   - "toggle": click to start, click again to stop.
 *
 * Switching modes only requires changing the config flag — no UI rewrite.
 *
 * NOTE (Agent Mode): voice transcripts feed the same /api/ai/chat call as typed
 * input. The chat API still returns a confirmation card for agent updates, and
 * the user must click Yes/No to execute. Voice never bypasses confirmation.
 */
export function MicButton({
  onTranscript,
  onRecordingStart,
  disabled,
}: MicButtonProps) {
  const { t } = useLanguage();
  const {
    isRecording,
    isTranscribing,
    isSupported,
    error,
    start,
    stopAndTranscribe,
    cancel,
  } = useTranscribe();

  const startedRef = useRef(false);

  const beginRecording = useCallback(async () => {
    if (startedRef.current || disabled) return;
    startedRef.current = true;
    onRecordingStart?.();
    await start();
  }, [disabled, onRecordingStart, start]);

  const endRecording = useCallback(async () => {
    if (!startedRef.current) return;
    startedRef.current = false;
    const text = await stopAndTranscribe();
    if (text) onTranscript(text);
  }, [onTranscript, stopAndTranscribe]);

  const cancelRecording = useCallback(() => {
    if (!startedRef.current) return;
    startedRef.current = false;
    cancel();
  }, [cancel]);

  // Push-to-talk handlers: pointer events cover both mouse and touch.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      void beginRecording();
    },
    [beginRecording]
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      void endRecording();
    },
    [endRecording]
  );
  const onPointerLeave = useCallback(
    () => {
      // Release outside the button still ends the recording (don't lose audio).
      if (startedRef.current) void endRecording();
    },
    [endRecording]
  );

  // Toggle mode handler.
  const onClickToggle = useCallback(() => {
    if (isRecording) {
      void endRecording();
    } else {
      void beginRecording();
    }
  }, [isRecording, beginRecording, endRecording]);

  // Safety: cancel any in-flight recording if the button unmounts.
  useEffect(() => {
    return () => cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupported) return null;

  const isBusy = isRecording || isTranscribing;
  const isPushToTalk = VOICE_CONFIG.inputMode === "push-to-talk";

  const title = error
    ? error
    : isRecording
      ? t("Listening...")
      : isTranscribing
        ? t("Transcribing...")
        : isPushToTalk
          ? t("Hold to speak")
          : t("Click to speak");

  const handlers = isPushToTalk
    ? { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel: onPointerLeave }
    : { onClick: onClickToggle };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled || isTranscribing}
      title={title}
      aria-label={title}
      aria-pressed={isRecording}
      className={cn(
        "h-9 w-9 rounded-full flex-shrink-0 transition-colors select-none",
        isRecording
          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
          : "text-slate-500 hover:text-primary-600 hover:bg-slate-100",
        error && !isRecording && "text-red-500"
      )}
      {...handlers}
    >
      {isTranscribing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : error && !isRecording ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className={cn("w-4 h-4", isBusy && "scale-110")} />
      )}
    </Button>
  );
}
