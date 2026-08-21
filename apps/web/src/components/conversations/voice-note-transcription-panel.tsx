"use client";

import { useId, useState } from "react";
import { AudioLines, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StyledCard } from "@/components/ui/styled-card";

export interface VoiceNoteTranscript {
  id: string;
  text: string;
  language?: string;
  durationMs?: number;
  generatedAt: string;
}

export interface VoiceNoteMessage {
  id: string;
  senderName: string;
  content: string;
  sentAt: string;
  transcript?: VoiceNoteTranscript | null;
}

interface VoiceNoteTranscriptionPanelProps {
  conversationId: string;
  messages: VoiceNoteMessage[];
  onTranscribed: (messageId: string, transcript: VoiceNoteTranscript) => void;
}

function VoiceNoteItem({
  conversationId,
  message,
  disclosureId,
  onTranscribed,
}: {
  conversationId: string;
  message: VoiceNoteMessage;
  disclosureId: string;
  onTranscribed: VoiceNoteTranscriptionPanelProps["onTranscribed"];
}) {
  const [file, setFile] = useState<File>();
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const transcribe = async () => {
    if (!file || !consented || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("modelProcessingConsent", "true");
      const response = await fetch(
        `/api/chat-export/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}/transcript`,
        { method: "POST", body },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { transcript?: VoiceNoteTranscript };
      };
      if (!response.ok || !payload.data?.transcript) {
        throw new Error(payload.error || "Voice-note transcription failed.");
      }
      onTranscribed(message.id, payload.data.transcript);
      setFile(undefined);
      setConsented(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Voice-note transcription failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-border/80 bg-background/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{message.senderName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(message.sentAt).toLocaleString()} · {message.content}
          </p>
        </div>
        {message.transcript ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" /> Transcribed
          </span>
        ) : null}
      </div>

      {message.transcript ? (
        <div className="mt-4 border-l-2 border-primary/60 pl-4">
          <p className="text-sm leading-6 text-foreground">
            {message.transcript.text}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Kept with this conversation until you delete it.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Exported voice-note file
              <input
                className="mt-2 block w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="file"
                accept=".opus,.ogg,.mp3,.wav,.m4a,.aac,.flac,audio/*"
                aria-describedby={disclosureId}
                onChange={(event) => setFile(event.target.files?.[0])}
                disabled={busy}
              />
            </label>
            <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
              <Checkbox
                checked={consented}
                onCheckedChange={(checked) => setConsented(checked === true)}
                disabled={busy}
                aria-describedby={disclosureId}
              />
              <span>
                I consent to sending this audio to xtox, Sluice, and Azure AI
                Foundry to create a transcript.
              </span>
            </label>
          </div>
          <Button onClick={transcribe} disabled={!file || !consented || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? "Transcribing…" : "Transcribe voice note"}
          </Button>
        </div>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function VoiceNoteTranscriptionPanel({
  conversationId,
  messages,
  onTranscribed,
}: VoiceNoteTranscriptionPanelProps) {
  const disclosureId = useId();
  if (messages.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Voice-note transcription">
      <StyledCard
        title="Voice notes"
        description="Attach the matching audio file from your WhatsApp export."
        icon={<AudioLines className="h-6 w-6" />}
      >
        <div
          id={disclosureId}
          className="mb-5 rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100"
        >
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Audio processing path</p>
              <p className="mt-1 leading-6">
                ConvoLens → xtox → Sluice → Azure AI Foundry. ConvoLens does not
                store the raw audio. Processing is enabled only when xtox is
                verified not to retain its copy; the returned transcript stays
                with this conversation until you delete it.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {messages.map((message) => (
            <VoiceNoteItem
              key={message.id}
              conversationId={conversationId}
              message={message}
              disclosureId={disclosureId}
              onTranscribed={onTranscribed}
            />
          ))}
        </div>
      </StyledCard>
    </section>
  );
}
