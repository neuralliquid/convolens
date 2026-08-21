import { NextResponse } from "next/server";
import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensTranscriptionTokens,
} from "@/lib/convolens-api";

export const maxDuration = 150;
const MAX_VOICE_NOTE_BYTES = 25 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const contentLengthHeader = request.headers.get("content-length") || "";
    if (!/^\d+$/.test(contentLengthHeader)) {
      return NextResponse.json(
        { error: "A bounded upload length is required." },
        { status: 411 },
      );
    }
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (contentLength > MAX_VOICE_NOTE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES) {
      return NextResponse.json(
        { error: "Voice-note file exceeds the 25 MB size limit." },
        { status: 413 },
      );
    }

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
    if (file.size > MAX_VOICE_NOTE_BYTES) {
      return NextResponse.json(
        { error: "Voice-note file exceeds the 25 MB size limit." },
        { status: 413 },
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
        signal: AbortSignal.timeout(140_000),
      },
    );
    const payload = await response.json().catch(() => ({
      error: response.ok
        ? "The transcription service returned an invalid response."
        : "Voice-note transcription is temporarily unavailable.",
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return NextResponse.json(
        { error: "Voice-note transcription timed out. Please try again." },
        { status: 504 },
      );
    }
    return apiAuthErrorResponse(error);
  }
}
