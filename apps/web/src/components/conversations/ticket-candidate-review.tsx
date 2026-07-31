"use client";

import { useEffect, useState } from "react";
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
  evidence: Array<{ position: number; senderName: string; sentAt: string }>;
  publishAttempts?: Array<{
    attemptNumber: number;
    status: string;
    errorCode?: string;
  }>;
}

export function TicketCandidateReview({ intakeId }: { intakeId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = async () => {
    const response = await fetch(
      `/api/ticket-candidates/conversations/${encodeURIComponent(intakeId)}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Unable to load ticket candidates");
    setCandidates(payload.data?.candidates || []);
  };

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [intakeId]);

  const request = async (key: string, url: string, init: RequestInit) => {
    setBusy(key);
    setError(undefined);
    try {
      const response = await fetch(url, init);
      const payload = await response.json();
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
        candidate.id === id ? { ...candidate, ...patch } : candidate,
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
            Ticket candidates
          </h2>
          <p className="text-sm text-muted-foreground">
            Deterministic suggestions only. Nothing reaches Baton until you
            accept and publish it.
          </p>
        </div>
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
          {busy === "generate" ? "Checking…" : "Find action items"}
        </Button>
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
          No candidates generated yet.
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
          <Input
            aria-label="Candidate title"
            value={candidate.title}
            disabled={
              candidate.status === "published" ||
              candidate.status === "rejected"
            }
            onChange={(event) =>
              patchLocal(candidate.id, { title: event.target.value })
            }
          />
          <textarea
            aria-label="Candidate description"
            className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
            value={candidate.description || ""}
            disabled={
              candidate.status === "published" ||
              candidate.status === "rejected"
            }
            onChange={(event) =>
              patchLocal(candidate.id, { description: event.target.value })
            }
          />
          <Input
            aria-label="Baton project ID"
            placeholder="Baton project ID"
            value={candidate.projectId || ""}
            disabled={
              candidate.status === "published" ||
              candidate.status === "rejected"
            }
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
                  disabled={Boolean(busy) || !candidate.projectId}
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
                  Accept
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
                  Reject
                </Button>
              </>
            ) : null}
            {candidate.status === "accepted" ||
            candidate.publishStatus === "failed" ? (
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
                  : "Publish to Baton"}
              </Button>
            ) : null}
            {candidate.batonTaskUrl ? (
              <a
                className="inline-flex items-center text-sm font-semibold text-primary underline"
                href={candidate.batonTaskUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Baton task
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
