"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  Filter,
  Link2,
  ListChecks,
  Mail,
  MessageCircle,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import type { CatchUpSummary } from "./catch-up-summary";

export interface AnnotatedSourceMessage {
  id: string;
  position: number;
  senderName: string;
  content: string;
  sentAt: string;
  isMedia?: boolean;
  mediaLabel?: string;
  sourcePlatform: "whatsapp" | "email" | "discord" | string;
  sourceLabel?: string;
}

interface Annotation {
  kind: "overview" | "topic" | "decision" | "action" | "question" | "link";
  label: string;
  href: string;
}

interface SourceStyle {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge: string;
  rail: string;
}

const SOURCE_STYLES: Record<string, SourceStyle> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    rail: "bg-emerald-500",
  },
  email: {
    label: "Email",
    icon: Mail,
    badge:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    rail: "bg-sky-500",
  },
  discord: {
    label: "Discord",
    icon: MessagesSquare,
    badge:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200",
    rail: "bg-indigo-500",
  },
};

const ANNOTATION_STYLES: Record<Annotation["kind"], string> = {
  overview:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  topic:
    "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  decision:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  action:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  question:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  link: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
};

const ANNOTATION_ICONS: Record<
  Annotation["kind"],
  ComponentType<{ className?: string }>
> = {
  overview: Sparkles,
  topic: MessageCircle,
  decision: CheckCircle2,
  action: ListChecks,
  question: CircleHelp,
  link: Link2,
};

function sourceStyle(platform: string): SourceStyle {
  return (
    SOURCE_STYLES[platform.toLowerCase()] || {
      label: platform,
      icon: MessageCircle,
      badge: "border-border bg-muted text-muted-foreground",
      rail: "bg-muted-foreground",
    }
  );
}

function buildAnnotationMap(summary?: CatchUpSummary) {
  const annotations = new Map<string, Annotation[]>();
  const add = (messageId: string, annotation: Annotation) => {
    const current = annotations.get(messageId) || [];
    if (!current.some((item) => item.kind === annotation.kind)) {
      current.push(annotation);
      annotations.set(messageId, current);
    }
  };

  summary?.overviewEvidence.forEach((evidence) =>
    add(evidence.messageId, {
      kind: "overview",
      label: "Supports the short version",
      href: "#catch-up-heading",
    }),
  );
  const groups: Array<{
    items: Array<{ evidence: Array<{ messageId: string }> }>;
    kind: Annotation["kind"];
    label: string;
    href: string;
  }> = [
    {
      items: summary?.keyTopics || [],
      kind: "topic",
      label: "Key topic",
      href: "#summary-topics",
    },
    {
      items: summary?.decisions || [],
      kind: "decision",
      label: "Decision evidence",
      href: "#summary-decisions",
    },
    {
      items: summary?.actionItems || [],
      kind: "action",
      label: "Action evidence",
      href: "#summary-actions",
    },
    {
      items: summary?.openQuestions || [],
      kind: "question",
      label: "Open question",
      href: "#summary-questions",
    },
    {
      items: summary?.importantLinks || [],
      kind: "link",
      label: "Shared link",
      href: "#summary-links",
    },
  ];
  groups.forEach((group) =>
    group.items.forEach((item) =>
      item.evidence.forEach((evidence) =>
        add(evidence.messageId, {
          kind: group.kind,
          label: group.label,
          href: group.href,
        }),
      ),
    ),
  );
  return annotations;
}

export function AnnotatedSourceConversation({
  messages,
  summary,
  demoContext = false,
}: {
  messages: AnnotatedSourceMessage[];
  summary?: CatchUpSummary;
  demoContext?: boolean;
}) {
  const annotations = useMemo(() => buildAnnotationMap(summary), [summary]);
  const sources = useMemo(
    () =>
      Array.from(new Set(messages.map((message) => message.sourcePlatform))),
    [messages],
  );
  const [activeSource, setActiveSource] = useState("all");
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  const referencedCount = annotations.size;
  const visibleMessages = messages.filter(
    (message) =>
      (activeSource === "all" || message.sourcePlatform === activeSource) &&
      (!evidenceOnly || annotations.has(message.id)),
  );

  return (
    <section
      id="source-messages"
      className="mt-10 scroll-mt-20"
      aria-labelledby="source-heading"
    >
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-slate-50 via-white to-emerald-50/50 p-5 dark:from-slate-950 dark:via-card dark:to-emerald-950/30 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" /> Annotated source conversation
              </div>
              <h2
                id="source-heading"
                className="mt-2 text-2xl font-bold tracking-tight"
              >
                See exactly where the catch-up came from
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every annotation links back to the part of the summary it
                supports. Filter the timeline by source or show only cited
                evidence.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:flex">
              <div className="rounded-xl border bg-background px-4 py-3">
                <div className="text-xl font-bold tabular-nums">
                  {referencedCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  messages cited
                </div>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3">
                <div className="text-xl font-bold tabular-nums">
                  {sources.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  sources in view
                </div>
              </div>
            </div>
          </div>
          {demoContext ? (
            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-xs leading-5 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
              Demo context: these synthetic Email and Discord messages show how
              related evidence can sit beside an imported group chat. They do
              not imply live connector access.
            </div>
          ) : null}
        </div>

        <div className="sticky top-16 z-10 flex flex-col gap-3 border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Filter messages by source"
          >
            <button
              type="button"
              onClick={() => setActiveSource("all")}
              aria-pressed={activeSource === "all"}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeSource === "all" ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              All sources · {messages.length}
            </button>
            {sources.map((source) => {
              const style = sourceStyle(source);
              const Icon = style.icon;
              const count = messages.filter(
                (message) => message.sourcePlatform === source,
              ).length;
              return (
                <button
                  type="button"
                  key={source}
                  onClick={() => setActiveSource(source)}
                  aria-pressed={activeSource === source}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeSource === source ? style.badge : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {style.label} · {count}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setEvidenceOnly((current) => !current)}
            aria-pressed={evidenceOnly}
            disabled={!summary}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${evidenceOnly ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <Filter className="h-3.5 w-3.5" /> Evidence only
          </button>
        </div>

        <div className="space-y-3 bg-muted/20 p-4 sm:p-7">
          {visibleMessages.map((message) => {
            const messageAnnotations = annotations.get(message.id) || [];
            const style = sourceStyle(message.sourcePlatform);
            const SourceIcon = style.icon;
            return (
              <article
                key={message.id}
                id={`message-${message.id}`}
                className="relative scroll-mt-40 overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition target:border-emerald-400 target:bg-emerald-50 target:ring-4 target:ring-emerald-100 dark:target:border-emerald-700 dark:target:bg-emerald-950/40 dark:target:ring-emerald-950 sm:p-5"
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1 ${style.rail}`}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        #{message.position + 1}
                      </span>
                      <p className="font-semibold">{message.senderName}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}
                      >
                        <SourceIcon className="h-3 w-3" /> {style.label}
                      </span>
                      {message.sourceLabel ? (
                        <span className="text-xs text-muted-foreground">
                          {message.sourceLabel}
                        </span>
                      ) : null}
                    </div>
                    {message.isMedia ? (
                      <span className="mt-3 inline-flex rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {message.mediaLabel || "Media"}
                      </span>
                    ) : null}
                    {message.content ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </p>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(message.sentAt))}
                  </time>
                </div>
                {messageAnnotations.length > 0 ? (
                  <div
                    className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3"
                    aria-label="Summary annotations"
                  >
                    {messageAnnotations.map((annotation) => {
                      const AnnotationIcon = ANNOTATION_ICONS[annotation.kind];
                      return (
                        <a
                          key={annotation.kind}
                          href={annotation.href}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${ANNOTATION_STYLES[annotation.kind]}`}
                        >
                          <AnnotationIcon className="h-3.5 w-3.5" />{" "}
                          {annotation.label} <ArrowUp className="h-3 w-3" />
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
          {visibleMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              No messages match these filters.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
