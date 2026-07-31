"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@convolens/contexts";
import {
  ArrowRight,
  Chrome,
  FileText,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import PageWrapper from "../page-wrapper";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StyledCard } from "@/components/ui/styled-card";
import { DeleteConversationButton } from "@/components/conversations/delete-conversation-button";

const onboardingSteps = [
  {
    icon: MessageSquare,
    title: "Choose one conversation",
    description:
      "Start with a WhatsApp chat that you are authorized to upload.",
  },
  {
    icon: Chrome,
    title: "Pick an intake method",
    description:
      "Upload a WhatsApp .txt export or use the browser extension. Additional import paths are planned.",
  },
  {
    icon: Sparkles,
    title: "Confirm it was received",
    description:
      "ConvoLens validates the message context and confirms the intake result before you continue.",
  },
];

interface ConversationSummary {
  id: string;
  sourcePlatform: string;
  sourceKind: "extension" | "upload";
  displayName: string;
  isGroup: boolean;
  participants: string[];
  status: string;
  rawArtifactStatus:
    | "pending"
    | "stored"
    | "failed"
    | "not-recorded"
    | "deleting";
  messageCount: number;
  receivedAt: string;
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState<string>();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    fetch("/api/chat-export", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load conversations");
        }
        return payload as { data?: { conversations?: ConversationSummary[] } };
      })
      .then((payload) => {
        if (!cancelled) {
          setConversations(payload.data?.conversations || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setConversationError(
            error instanceof Error
              ? error.message
              : "Failed to load conversations",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConversations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <PageWrapper>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome to ConvoLens"}
        description="Import a WhatsApp conversation to review it in your workspace."
        actions={
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/import")}
          >
            Import a conversation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />

      <section className="mt-8">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-700 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-green-800 dark:text-green-300">
                {conversations.length > 0
                  ? "Conversation workspace"
                  : "Getting started"}
              </p>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} received`
                  : "Import your first conversation"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Imported conversations appear here after ConvoLens confirms
                receipt.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {onboardingSteps.map(({ icon: Icon, title, description }, index) => (
            <StyledCard
              key={title}
              title={`${index + 1}. ${title}`}
              icon={<Icon className="h-6 w-6" />}
            >
              <p className="leading-6 text-muted-foreground">{description}</p>
            </StyledCard>
          ))}
        </div>
      </section>

      {conversationError ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
          <p className="font-semibold">Conversations could not be loaded</p>
          <p className="mt-1">{conversationError}</p>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        {isLoadingConversations ? (
          <StyledCard
            title="Loading your conversations"
            icon={<MessageSquare className="h-6 w-6" />}
          >
            <p className="text-muted-foreground">
              Loading your conversation workspace…
            </p>
          </StyledCard>
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => (
            <StyledCard
              key={conversation.id}
              title={conversation.displayName}
              icon={
                conversation.isGroup ? (
                  <Users className="h-6 w-6" />
                ) : (
                  <MessageSquare className="h-6 w-6" />
                )
              }
              footer={
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/conversations/${conversation.id}`}>
                      View conversation
                    </Link>
                  </Button>
                  <DeleteConversationButton
                    conversationId={conversation.id}
                    onDeleted={() =>
                      setConversations((current) =>
                        current.filter((item) => item.id !== conversation.id),
                      )
                    }
                  />
                </div>
              }
            >
              <p className="text-sm text-muted-foreground">
                {conversation.messageCount} messages ·{" "}
                {conversation.participants.length} participants ·{" "}
                {conversation.sourceKind === "extension"
                  ? "Browser extension"
                  : "Chat export"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Received {new Date(conversation.receivedAt).toLocaleString()}
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {conversation.rawArtifactStatus === "stored"
                  ? "Raw source stored"
                  : conversation.rawArtifactStatus === "deleting"
                    ? "Deletion in progress"
                    : conversation.rawArtifactStatus === "not-recorded"
                      ? "Legacy intake · raw source not recorded"
                      : conversation.rawArtifactStatus === "failed"
                        ? "Raw source storage failed"
                        : "Raw source storage pending"}
              </p>
            </StyledCard>
          ))
        ) : (
          <>
            <StyledCard
              title="No conversations yet"
              icon={<FileText className="h-6 w-6" />}
            >
              <p className="text-muted-foreground">
                Imported conversations will appear here after ConvoLens confirms
                receipt.
              </p>
            </StyledCard>
            <StyledCard
              title="Ready when you are"
              icon={<MessageSquare className="h-6 w-6" />}
            >
              <p className="mb-4 text-muted-foreground">
                Choose the browser extension or a WhatsApp export file on the
                next screen.
              </p>
              <Button
                className="w-full"
                variant="primary"
                onClick={() => router.push("/dashboard/import")}
              >
                Choose an intake method
              </Button>
            </StyledCard>
          </>
        )}
      </section>
    </PageWrapper>
  );
}
