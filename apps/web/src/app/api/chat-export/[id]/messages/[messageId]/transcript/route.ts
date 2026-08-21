import { NextResponse } from "next/server";
import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensTranscriptionTokens,
} from "@/lib/convolens-api";

export const maxDuration = 150;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const { id, messageId } = await params;
    const { apiToken, mystiraToken } = await getConvolensTranscriptionTokens();
    const incoming = await request.formData();
    const file = incoming.get("file");
    const consent = incoming.get("modelProcessingConsent");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose the exported voice-note file." },
        { status: 400 },
      );
    }
    if (consent !== "true") {
      return NextResponse.json(
        { error: "Confirm model processing before transcribing." },
        { status: 400 },
      );
    }

    const outgoing = new FormData();
    outgoing.append("file", file);
    outgoing.append("modelProcessingConsent", "true");
    const language = incoming.get("language");
    if (typeof language === "string" && language.trim()) {
      outgoing.append("language", language.trim());
    }

    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/chat-export/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/transcript`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "x-xtox-authorization": `Bearer ${mystiraToken}`,
        },
        body: outgoing,
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => ({
      error: response.ok
        ? "The transcription service returned an invalid response."
        : "Voice-note transcription is temporarily unavailable.",
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
