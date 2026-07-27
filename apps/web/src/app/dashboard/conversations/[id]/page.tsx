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
  content: string;
  sentAt: string;
  isOutgoing: boolean;
  isMedia: boolean;
  mediaType?: string;
}

interface Conversation {
  id: string;
  displayName: string;
  sourcePlatform: string;
  sourceKind: "extension" | "upload";
  participants?: string[];
  status: string;
  receivedAt: string;
  messages: ConversationMessage[];
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
                  <p className="font-semibold">{message.senderName}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(message.sentAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </PageWrapper>
  );
}
