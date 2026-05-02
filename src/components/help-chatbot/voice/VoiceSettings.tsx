"use client";

import { Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TTS_VOICES,
  type OpenAITTSVoice,
} from "@/lib/voice/config";
import type { ChatbotVoiceSettings } from "@/hooks/useChatbotVoiceSettings";

interface VoiceSettingsProps {
  settings: ChatbotVoiceSettings;
  onAutoSpeakChange: (autoSpeak: boolean) => void;
  onVoiceChange: (voice: OpenAITTSVoice) => void;
}

export function VoiceSettings({
  settings,
  onAutoSpeakChange,
  onVoiceChange,
}: VoiceSettingsProps) {
  const { t } = useLanguage();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
          title={t("Voice settings")}
          aria-label={t("Voice settings")}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 p-3 space-y-3"
      >
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {t("Voice settings")}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="auto-speak-toggle"
            className="text-sm cursor-pointer"
          >
            {t("Auto-speak replies")}
          </Label>
          <Switch
            id="auto-speak-toggle"
            checked={settings.autoSpeak}
            onCheckedChange={onAutoSpeakChange}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">{t("Voice")}</Label>
          <Select
            value={settings.voice}
            onValueChange={(v) => onVoiceChange(v as OpenAITTSVoice)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTS_VOICES.map((v) => (
                <SelectItem key={v} value={v} className="text-sm capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
