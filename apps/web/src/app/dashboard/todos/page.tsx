"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ListChecks, ShieldCheck } from "lucide-react";
import { useAuth } from "@convolens/contexts";
import PageWrapper from "../../page-wrapper";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { TicketCandidateReview } from "@/components/conversations/ticket-candidate-review";

export default function PersonalTodosPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard/todos");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
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
        title="My conversation todos"
        description="Private, reviewable drafts grounded in explicit actions from your conversations."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        }
      />
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold">Grounded drafts</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Every draft links to its catch-up and exact supporting messages.
            ConvoLens does not infer an owner or due date.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold">You control every write</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Save edits, confirm the draft, then publish in a separate step.
            Dismissed and unpublished drafts remain private to your account.
          </p>
        </div>
      </section>
      <TicketCandidateReview />
    </PageWrapper>
  );
}
