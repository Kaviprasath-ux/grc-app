/**
 * Voice STT endpoint — accepts an audio blob, returns transcribed text via OpenAI Whisper.
 *
 * Request: multipart/form-data with fields:
 *   - audio: audio file (webm/ogg/mp3/wav, ≤25 MB)
 *   - locale: app locale ("en" | "ar" | "lv")
 *
 * Response: { text: string }
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuthOnly } from "@/lib/api-auth";
import { VOICE_CONFIG, localeToWhisperLang } from "@/lib/voice/config";
import { isValidLocale } from "@/i18n/config";

const STT_MODEL = "whisper-1";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export const POST = withAuthOnly(async (req) => {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");
    const localeRaw = (formData.get("locale") as string | null) || "en";

    // FormData.get() returns Blob | string | null. File extends Blob in browsers
    // but the global File type isn't always in our TS lib, so we check Blob.
    if (!(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing 'audio' file in form data" },
        { status: 400 }
      );
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
    }

    if (audio.size > VOICE_CONFIG.maxAudioBytes) {
      return NextResponse.json(
        { error: "Audio file too large (max 25 MB)" },
        { status: 413 }
      );
    }

    const locale = isValidLocale(localeRaw) ? localeRaw : "en";
    const language = localeToWhisperLang(locale);

    // OpenAI SDK accepts a File-like object; wrap the Blob so it has a name.
    const filename =
      "name" in audio && typeof (audio as { name: unknown }).name === "string"
        ? (audio as { name: string }).name
        : "audio.webm";
    const file = new File([audio], filename, {
      type: audio.type || "audio/webm",
    });

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: STT_MODEL,
      language,
    });

    return NextResponse.json({ text: transcription.text || "" });
  } catch (error) {
    console.error("[Voice STT] Error:", error);
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
