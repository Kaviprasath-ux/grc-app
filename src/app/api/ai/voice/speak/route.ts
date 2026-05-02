/**
 * Voice TTS endpoint — accepts text, returns spoken MP3 audio via OpenAI gpt-4o-mini-tts.
 *
 * Request body (JSON):
 *   - text: string (required, truncated to maxTtsChars)
 *   - voice?: OpenAITTSVoice (default: "alloy")
 *   - locale?: Locale (used for telemetry only; OpenAI voices are multilingual)
 *
 * Response: audio/mpeg stream
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuthOnly } from "@/lib/api-auth";
import { VOICE_CONFIG, TTS_VOICES, type OpenAITTSVoice } from "@/lib/voice/config";

const TTS_MODEL = "gpt-4o-mini-tts";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

interface SpeakRequest {
  text?: string;
  voice?: string;
  locale?: string;
}

export const POST = withAuthOnly(async (req) => {
  try {
    const body = (await req.json()) as SpeakRequest;
    const rawText = (body.text || "").trim();

    if (!rawText) {
      return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
    }

    const text =
      rawText.length > VOICE_CONFIG.maxTtsChars
        ? rawText.slice(0, VOICE_CONFIG.maxTtsChars - 1) + "…"
        : rawText;

    const voice: OpenAITTSVoice = TTS_VOICES.includes(
      body.voice as OpenAITTSVoice
    )
      ? (body.voice as OpenAITTSVoice)
      : VOICE_CONFIG.defaultVoice;

    const response = await getOpenAI().audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: text,
    });

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Voice TTS] Error:", error);
    const message = error instanceof Error ? error.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
