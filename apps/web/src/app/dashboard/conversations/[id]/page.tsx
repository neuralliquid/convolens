"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Users } from "lucide-react";
import { useAuth } from "@convolens/contexts";
import PageWrapper from "../../../page-wrapper";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StyledCard } from "@/components/ui/styled-card";
import { DeleteConversationButton } from "@/components/conversations/delete-conversation-button";
import { TicketCandidateReview } from "@/components/conversations/ticket-candidate-review";
import { CatchUpSummaryPanel } from "@/components/conversations/catch-up-summary";

interface ConversationMessage {
  id: string;
  position: number;
  senderName: string;
  senderRef?: string;
  content: string;
  sentAt: string;
  isOutgoing: boolean;
  isMedia: boolean;
  mediaType?: string;
}

interface ParticipantEvidence {
  ref: string;
  rawDisplayName?: string;
  preferredDisplayName?: string;
  normalizedPhone?: string;
}

interface Conversation {
  id: string;
  displayName: string;
  sourcePlatform: string;
  sourceKind: "extension" | "upload";
  participants?: string[];
  participantEvidence?: ParticipantEvidence[];
  reconciliationStatus?: "none" | "required";
  reconciliationCandidateIds?: string[];
  status: string;
  rawArtifact?: {
    status: "pending" | "stored" | "failed" | "not-recorded" | "deleting";
    sha256?: string;
    size?: number;
  };
  receivedAt: string;
  messages: ConversationMessage[];
}

const MEDIA_LABELS: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  sticker: "Sticker",
};

function mediaLabel(message: ConversationMessage): string {
  return MEDIA_LABELS[message.mediaType?.toLowerCase() || ""] || "Media";
}

function isLegacyMediaPlaceholder(content: string, label: string): boolean {
  const normalized = content.trim().toLowerCase();
  return (
    normalized === `[${label.toLowerCase()}]` ||
    /^\[(?:image|video|audio|document|sticker|media)\]$/.test(normalized)
  );
}

function senderLabel(
  conversation: Conversation,
  message: ConversationMessage,
): string {
  const evidence = conversation.participantEvidence?.find(
    (participant) => participant.ref === message.senderRef,
  );
  const name = evidence?.preferredDisplayName || evidence?.rawDisplayName;
  if (!name) return evidence?.normalizedPhone || message.senderName;
  if (!evidence?.normalizedPhone || name.includes(evidence.normalizedPhone))
    return name;
  return `${name} · ${evidence.normalizedPhone}`;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [conversation, setConversation] = useState<Conversation>();
  const [error, setError] = useState<string>();
  const [loadingConversation, setLoadingConversation] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(
        `/login?redirectTo=${encodeURIComponent(`/dashboard/conversations/${id}`)}`,
      );
    }
  }, [id, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;

    let cancelled = false;
    fetch(`/api/chat-export/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load conversation");
        }
        return payload as { data?: { conversation?: Conversation } };
      })
      .then((payload) => {
        if (!cancelled) setConversation(payload.data?.conversation);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Failed to load conversation",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConversation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  if (isLoading || loadingConversation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <PageWrapper>
      <PageHeader
        title={conversation?.displayName || "Conversation"}
        description={
          conversation
            ? `${conversation.messages.length} stored messages · received ${new Date(conversation.receivedAt).toLocaleString()}`
            : "Durable conversation intake"
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
            {conversation ? (
              <DeleteConversationButton
                conversationId={conversation.id}
                onDeleted={() => router.push("/dashboard")}
              />
            ) : null}
          </>
        }
      />

      {error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </div>
      ) : conversation ? (
        <>
          {conversation.reconciliationStatus === "required" ? (
            <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              This capture was stored separately because it may match an older
              intake without enough stable identity evidence. Review is
              required; ConvoLens did not merge or discard either conversation.
            </div>
          ) : null}
          <CatchUpSummaryPanel
            conversationId={conversation.id}
            messageCount={conversation.messages.length}
            participantCount={conversation.participants?.length || 0}
            periodStart={conversation.messages[0]?.sentAt}
            periodEnd={
              conversation.messages[conversation.messages.length - 1]?.sentAt
            }
          />
          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <StyledCard
              title="Intake status"
              icon={<MessageSquare className="h-6 w-6" />}
            >
              <p className="capitalize text-muted-foreground">
                {conversation.status} via{" "}
                {conversation.sourceKind === "extension"
                  ? "browser extension"
                  : "chat export"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {conversation.rawArtifact?.status === "stored"
                  ? "Raw source stored with integrity metadata"
                  : conversation.rawArtifact?.status === "deleting"
                    ? "Deletion in progress"
                    : conversation.rawArtifact?.status === "not-recorded"
                      ? "Legacy intake · raw source was not recorded"
                      : conversation.rawArtifact?.status === "failed"
                        ? "Raw source storage failed"
                        : "Raw source storage pending"}
              </p>
            </StyledCard>
            <StyledCard
              title="Participants"
              icon={<Users className="h-6 w-6" />}
            >
              <p className="text-muted-foreground">
                {conversation.participants?.join(", ") ||
                  "No participant names were provided"}
              </p>
            </StyledCard>
          </section>

          <section
            id="source-messages"
            className="mt-10 scroll-mt-20 space-y-3"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Source conversation
              </p>
              <h2 className="mt-1 text-xl font-bold">Imported messages</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use these messages to verify any important detail in the
                catch-up.
              </p>
            </div>
            {conversation.messages.map((message) => (
              <article
                key={message.id}
                id={`message-${message.id}`}
                className="scroll-mt-24 rounded-xl border bg-card p-4 text-card-foreground transition target:border-emerald-400 target:bg-emerald-50 target:ring-4 target:ring-emerald-100 dark:target:border-emerald-700 dark:target:bg-emerald-950/40 dark:target:ring-emerald-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      #{message.position + 1}
                    </span>
                    <p className="font-semibold">
                      {senderLabel(conversation, message)}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(message.sentAt).toLocaleString()}
                  </time>
                </div>
                {message.isMedia ? (
                  <span className="mt-3 inline-flex rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {mediaLabel(message)}
                  </span>
                ) : null}
                {message.content &&
                (!message.isMedia ||
                  !isLegacyMediaPlaceholder(
                    message.content,
                    mediaLabel(message),
                  )) ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>
                ) : null}
              </article>
            ))}
          </section>
          <TicketCandidateReview intakeId={conversation.id} />
        </>
      ) : null}
    </PageWrapper>
  );
}
