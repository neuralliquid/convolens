"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@convolens/contexts";
import {
  ArrowRight,
  Chrome,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import PageWrapper from "../page-wrapper";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StyledCard } from "@/components/ui/styled-card";

const onboardingSteps = [
  {
    icon: MessageSquare,
    title: "Choose one conversation",
    description:
      "Start with a WhatsApp chat that you have permission to bring into the alpha.",
  },
  {
    icon: Chrome,
    title: "Pick an intake method",
    description:
      "Use the browser extension on WhatsApp Web or upload a WhatsApp .txt export.",
  },
  {
    icon: Sparkles,
    title: "Confirm it was received",
    description:
      "ConvoLens validates the message context and confirms the intake result before you continue.",
  },
];

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

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
        title={
          firstName ? `Welcome, ${firstName}` : "Welcome to ConvoLens Alpha"
        }
        description="Your first step is to bring in one conversation. WhatsApp is the live connector during this alpha."
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
                First-time setup
              </p>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                Send your first conversation in three steps
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This is an alpha workspace. We will show confirmed intake
                results and avoid presenting sample activity as if it were
                yours.
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

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <StyledCard
          title="No conversations yet"
          icon={<FileText className="h-6 w-6" />}
        >
          <p className="text-muted-foreground">
            Your real conversation activity will appear here after a successful
            intake. ConvoLens does not seed this dashboard with demo records.
          </p>
        </StyledCard>
        <StyledCard
          title="Ready when you are"
          icon={<MessageSquare className="h-6 w-6" />}
        >
          <p className="mb-4 text-muted-foreground">
            Choose the browser extension or a WhatsApp export file on the next
            screen.
          </p>
          <Button
            className="w-full"
            variant="primary"
            onClick={() => router.push("/dashboard/import")}
          >
            Choose an intake method
          </Button>
        </StyledCard>
      </section>
    </PageWrapper>
  );
}
