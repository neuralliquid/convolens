"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Link2,
  MessageSquareText,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Candidate {
  id: string;
  title: string;
  description?: string;
  confidence: "high" | "medium";
  projectId?: string;
  status: "pending" | "accepted" | "rejected" | "published";
  revision: number;
  publishStatus: "not_requested" | "pending" | "failed" | "succeeded";
  batonTaskUrl?: string;
  lastPublishErrorCode?: string;
  dirty?: boolean;
  evidence: Array<{
    messageId: string;
    position: number;
    senderName: string;
    sentAt: string;
  }>;
  sourceContext?: {
    conversationId: string;
    conversationName: string;
    catchUpHref: string;
    evidenceLinks: Array<{ messageId: string; href: string }>;
  };
  publishAttempts?: Array<{
    attemptNumber: number;
    status: string;
    errorCode?: string;
  }>;
}

export function TicketCandidateReview({ intakeId }: { intakeId?: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const response = await fetch(
      intakeId
        ? `/api/ticket-candidates/conversations/${encodeURIComponent(intakeId)}`
        : "/api/ticket-candidates",
      { cache: "no-store" },
    );
    const payload = response.status === 204 ? {} : await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Unable to load ticket candidates");
    setCandidates(payload.data?.candidates || []);
  }, [intakeId]);

  useEffect(() => {
    // The state update occurs after the external request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((reason) => setError(reason.message));
  }, [load]);

  const request = async (key: string, url: string, init: RequestInit) => {
    setBusy(key);
    setError(undefined);
    try {
      const response = await fetch(url, init);
      const payload = response.status === 204 ? {} : await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Candidate action failed");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Candidate action failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const patchLocal = (id: string, patch: Partial<Candidate>) =>
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, ...patch, dirty: true }
          : candidate,
      ),
    );

  return (
    <section
      className="mt-8 space-y-4"
      aria-labelledby="ticket-candidates-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="ticket-candidates-title" className="text-xl font-bold">
            {intakeId ? "Todo drafts" : "My conversation todos"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Grounded in explicit conversation actions. Review and confirm each
            draft before a separate Baton publish.
          </p>
        </div>
        {intakeId ? (
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() =>
              request(
                "generate",
                `/api/ticket-candidates/conversations/${encodeURIComponent(intakeId)}`,
                { method: "POST" },
              )
            }
          >
            {busy === "generate" ? "Checking…" : "Find explicit actions"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}
      {candidates.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {intakeId
            ? "No todo drafts yet. Find explicit actions to create reviewable drafts."
            : "No personal todo drafts yet. Open a conversation and find explicit actions first."}
        </p>
      ) : null}
      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <div className="flex justify-between gap-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {candidate.confidence} confidence · {candidate.status}
            </span>
            <span className="text-xs text-muted-foreground">
              Evidence: message {candidate.evidence[0]?.position + 1}
            </span>
          </div>
          {candidate.sourceContext ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                href={candidate.sourceContext.catchUpHref}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-primary hover:bg-muted"
              >
                <Link2 className="h-3.5 w-3.5" />
                Catch-up: {candidate.sourceContext.conversationName}
              </Link>
              {candidate.evidence.map((evidence, index) => (
                <Link
                  key={evidence.messageId}
                  href={
                    candidate.sourceContext!.evidenceLinks[index]?.href ||
                    candidate.sourceContext!.catchUpHref
                  }
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-primary hover:bg-muted"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Message {evidence.position + 1}
                </Link>
              ))}
            </div>
          ) : null}
          <Input
            aria-label="Candidate title"
            value={candidate.title}
            disabled={candidate.status !== "pending"}
            onChange={(event) =>
              patchLocal(candidate.id, { title: event.target.value })
            }
          />
          <textarea
            aria-label="Candidate description"
            className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
            value={candidate.description || ""}
            disabled={candidate.status !== "pending"}
            onChange={(event) =>
              patchLocal(candidate.id, { description: event.target.value })
            }
          />
          <Input
            aria-label="Baton project ID"
            placeholder="Baton project ID"
            value={candidate.projectId || ""}
            disabled={candidate.status !== "pending"}
            onChange={(event) =>
              patchLocal(candidate.id, { projectId: event.target.value })
            }
          />
          <div className="flex flex-wrap gap-2">
            {candidate.status === "pending" ? (
              <>
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    request(
                      candidate.id,
                      `/api/ticket-candidates/${candidate.id}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          expectedRevision: candidate.revision,
                          title: candidate.title,
                          description: candidate.description,
                          projectId: candidate.projectId,
                        }),
                      },
                    )
                  }
                >
                  Save edits
                </Button>
                <Button
                  disabled={
                    Boolean(busy) || !candidate.projectId || candidate.dirty
                  }
                  onClick={() =>
                    request(
                      candidate.id,
                      `/api/ticket-candidates/${candidate.id}/decision`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          expectedRevision: candidate.revision,
                          decision: "accepted",
                          projectId: candidate.projectId,
                        }),
                      },
                    )
                  }
                >
                  Confirm for Baton
                </Button>
                <Button
                  variant="destructive"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    request(
                      candidate.id,
                      `/api/ticket-candidates/${candidate.id}/decision`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          expectedRevision: candidate.revision,
                          decision: "rejected",
                        }),
                      },
                    )
                  }
                >
                  Dismiss
                </Button>
              </>
            ) : null}
            {candidate.status === "pending" && candidate.dirty ? (
              <span className="self-center text-xs text-amber-700">
                Save edits before accepting.
              </span>
            ) : null}
            {candidate.status === "accepted" ||
            candidate.publishStatus === "failed" ? (
              <>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    request(
                      candidate.id,
                      `/api/ticket-candidates/${candidate.id}/publish`,
                      { method: "POST" },
                    )
                  }
                >
                  {candidate.publishStatus === "failed"
                    ? "Retry Baton publish"
                    : "Publish confirmed draft to Baton"}
                </Button>
                {candidate.publishStatus === "not_requested" ? (
                  <Button
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      request(
                        candidate.id,
                        `/api/ticket-candidates/${candidate.id}/revoke`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            expectedRevision: candidate.revision,
                          }),
                        },
                      )
                    }
                  >
                    <Undo2 className="mr-2 h-4 w-4" /> Return to review
                  </Button>
                ) : null}
              </>
            ) : null}
            {candidate.status !== "published" &&
            candidate.publishStatus === "not_requested" ? (
              <Button
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() =>
                  request(
                    candidate.id,
                    `/api/ticket-candidates/${candidate.id}`,
                    {
                      method: "DELETE",
                    },
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete draft
              </Button>
            ) : null}
            {candidate.batonTaskUrl ? (
              <a
                className="inline-flex items-center text-sm font-semibold text-primary underline"
                href={candidate.batonTaskUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Baton task <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
          {candidate.lastPublishErrorCode ? (
            <p className="text-sm text-amber-700">
              Retryable publish error: {candidate.lastPublishErrorCode}
            </p>
          ) : null}
          {candidate.publishAttempts?.length ? (
            <p className="text-xs text-muted-foreground">
              Publish audit:{" "}
              {candidate.publishAttempts
                .map((attempt) => `#${attempt.attemptNumber} ${attempt.status}`)
                .join(" · ")}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
