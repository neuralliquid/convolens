"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Link2,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button, LoadingButton } from "@/components/ui/button";

export interface EvidenceReference {
  messageId: string;
  position: number;
  senderName: string;
  sentAt: string;
}

export interface EvidenceItem {
  text: string;
  evidence: EvidenceReference[];
}

export interface ActionItem extends EvidenceItem {
  owner?: string;
  due?: string;
}

export interface CatchUpSummary {
  id: string;
  overview: string;
  overviewEvidence: EvidenceReference[];
  keyTopics: EvidenceItem[];
  decisions: EvidenceItem[];
  actionItems: ActionItem[];
  openQuestions: EvidenceItem[];
  importantLinks: Array<{
    url: string;
    label?: string;
    evidence: EvidenceReference[];
  }>;
  scope: { messageCount: number; periodStart: string; periodEnd: string };
  generatedAt: string;
}

interface CatchUpSummaryProps {
  conversationId: string;
  messageCount: number;
  participantCount: number;
  periodStart?: string;
  periodEnd?: string;
  initialSummary?: CatchUpSummary;
  readOnly?: boolean;
  onSummaryChange?: (summary: CatchUpSummary | undefined) => void;
}

function formatDate(value?: string) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRange(start?: string, end?: string) {
  if (!start || !end) return "Imported message range";
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

function EvidenceLinks({ evidence }: { evidence: EvidenceReference[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Supporting messages">
      {evidence.map((reference) => (
        <a
          key={reference.messageId}
          href={`#message-${reference.messageId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          title={`${reference.senderName} · ${new Date(reference.sentAt).toLocaleString()}`}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Message {reference.position + 1}
        </a>
      ))}
    </div>
  );
}

function SummarySection({
  id,
  title,
  description,
  icon,
  items,
  emptyMessage,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: EvidenceItem[];
  emptyMessage: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {items.map((item, index) => (
            <li
              key={`${item.text}-${index}`}
              className="border-t border-border/60 pt-4 first:border-0 first:pt-0"
            >
              <p className="text-sm leading-6 text-foreground">{item.text}</p>
              <EvidenceLinks evidence={item.evidence} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export function CatchUpSummaryPanel({
  conversationId,
  messageCount,
  participantCount,
  periodStart,
  periodEnd,
  initialSummary,
  readOnly = false,
  onSummaryChange,
}: CatchUpSummaryProps) {
  const [summary, setSummary] = useState<CatchUpSummary | undefined>(
    initialSummary,
  );
  const [isLoading, setIsLoading] = useState(!initialSummary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (initialSummary) return;
    let cancelled = false;
    fetch(`/api/chat-export/${encodeURIComponent(conversationId)}/summary`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Could not load the catch-up");
        return payload as { data?: { summary?: CatchUpSummary } };
      })
      .then((payload) => {
        if (!cancelled) setSummary(payload.data?.summary || undefined);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load the catch-up",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, initialSummary]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  const displayedRange = useMemo(
    () =>
      summary
        ? formatRange(summary.scope.periodStart, summary.scope.periodEnd)
        : formatRange(periodStart, periodEnd),
    [periodEnd, periodStart, summary],
  );

  async function generate(regenerate = false) {
    setError(undefined);
    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/chat-export/${encodeURIComponent(conversationId)}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "The catch-up could not be generated");
      setSummary(payload.data?.summary);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The catch-up could not be generated",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <section
        className="mt-8 overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl sm:p-8"
        aria-label="Loading catch-up"
      >
        <div className="h-5 w-32 animate-pulse rounded bg-white/15" />
        <div className="mt-5 h-10 max-w-xl animate-pulse rounded bg-white/15" />
        <div className="mt-4 h-5 max-w-2xl animate-pulse rounded bg-white/10" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="relative mt-8 overflow-hidden rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-[#052e2b] via-[#064e3b] to-[#0f766e] p-6 text-white shadow-[0_24px_70px_-30px_rgba(5,150,105,0.7)] sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            <Sparkles className="h-3.5 w-3.5" /> AI catch-up
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Skip the scroll. Catch up in minutes.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-emerald-50/85">
            See the important topics, decisions, follow-ups, and unanswered
            questions—with links back to the messages that support them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-emerald-50">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-2">
              <MessageSquareText className="h-4 w-4" />
              {messageCount} imported messages
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-2">
              <Users className="h-4 w-4" />
              {participantCount} participants
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-2">
              <CalendarClock className="h-4 w-4" />
              {displayedRange}
            </span>
          </div>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <LoadingButton
              variant="secondary"
              size="lg"
              isLoading={isGenerating}
              loadingText={`Reading ${messageCount} messages…`}
              onClick={() => generate(false)}
              className="bg-white px-6 text-emerald-950 shadow-lg hover:bg-emerald-50"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Catch me up
            </LoadingButton>
            <p className="max-w-md text-xs leading-5 text-emerald-100/75">
              Only the imported messages shown on this page will be sent to your
              administrator&apos;s configured AI provider. AI can make mistakes;
              use the evidence links to verify important details.
            </p>
          </div>
          {error ? (
            <div
              className="mt-5 rounded-xl border border-red-200/30 bg-red-950/35 px-4 py-3 text-sm text-red-50"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="catch-up-heading">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-[0_24px_70px_-38px_rgba(5,150,105,0.55)] dark:border-emerald-900 dark:from-emerald-950/80 dark:via-card dark:to-teal-950/60 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Your catch-up
            </div>
            <h2
              id="catch-up-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              The short version
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/85 sm:text-lg">
              {summary.overview}
            </p>
            <EvidenceLinks evidence={summary.overviewEvidence} />
          </div>
          {readOnly ? null : (
            <Button
              variant="outline"
              size="sm"
              disabled={isGenerating}
              onClick={() => generate(true)}
              className="shrink-0 bg-background/70"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`}
              />
              {isGenerating ? "Refreshing…" : "Refresh catch-up"}
            </Button>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-emerald-200/70 pt-5 text-xs text-muted-foreground dark:border-emerald-900">
          <span>{summary.scope.messageCount} messages reviewed</span>
          <span>{displayedRange}</span>
          <span>
            Generated {new Date(summary.generatedAt).toLocaleString()}
          </span>
          <a
            href="#source-messages"
            className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Review source <ArrowDown className="h-3.5 w-3.5" />
          </a>
        </div>
        {error ? (
          <div
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SummarySection
          id="summary-topics"
          title="What everyone talked about"
          description="The themes worth knowing"
          icon={<MessageSquareText className="h-5 w-5" />}
          items={summary.keyTopics}
          emptyMessage="No clear themes were identified in this imported range."
        />
        <SummarySection
          id="summary-decisions"
          title="Decisions made"
          description="Outcomes the group explicitly agreed on"
          icon={<CheckCircle2 className="h-5 w-5" />}
          items={summary.decisions}
          emptyMessage="No explicit decisions were found—which is useful to know too."
        />
        <section
          id="summary-actions"
          className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Action items</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Who needs to do what next
              </p>
            </div>
          </div>
          {summary.actionItems.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {summary.actionItems.map((item, index) => (
                <li
                  key={`${item.text}-${index}`}
                  className="border-t border-border/60 pt-4 first:border-0 first:pt-0"
                >
                  <p className="text-sm leading-6 text-foreground">
                    {item.text}
                  </p>
                  {item.owner || item.due ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      {item.owner ? (
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                          Owner: {item.owner}
                        </span>
                      ) : null}
                      {item.due ? (
                        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                          Due: {item.due}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <EvidenceLinks evidence={item.evidence} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              No explicit action items or owners were found.
            </div>
          )}
        </section>
        <SummarySection
          id="summary-questions"
          title="Still open"
          description="Questions the conversation did not resolve"
          icon={<CircleHelp className="h-5 w-5" />}
          items={summary.openQuestions}
          emptyMessage="No clearly unresolved questions were found."
        />
      </div>

      {summary.importantLinks.length > 0 ? (
        <section
          id="summary-links"
          className="mt-5 scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Links shared</h3>
              <p className="text-sm text-muted-foreground">
                Collected directly from the imported messages
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {summary.importantLinks.map((link) => (
              <div
                key={link.url}
                className="rounded-xl border border-border bg-muted/20 p-4"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  <span className="min-w-0 truncate">
                    {link.label || link.url}
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
                <EvidenceLinks evidence={link.evidence} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
