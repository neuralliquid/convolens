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
  return content.trim().toLowerCase() === `[${label.toLowerCase()}]`;
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

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Stored messages</h2>
            {conversation.messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border bg-card p-4 text-card-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {senderLabel(conversation, message)}
                  </p>
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
                !isLegacyMediaPlaceholder(
                  message.content,
                  mediaLabel(message),
                ) ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>
                ) : null}
              </article>
            ))}
          </section>
        </>
      ) : null}
    </PageWrapper>
  );
}
