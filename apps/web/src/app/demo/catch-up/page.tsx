import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CatchUpSummaryPanel,
  type CatchUpSummary,
  type EvidenceReference,
} from "@/components/conversations/catch-up-summary";
import {
  AnnotatedSourceConversation,
  type AnnotatedSourceMessage,
} from "@/components/conversations/annotated-source-conversation";

const messages: AnnotatedSourceMessage[] = [
  {
    id: "demo-wa-13",
    position: 12,
    senderName: "Maya",
    content:
      "Morning! We crossed 300 RSVPs overnight. Can we lock Saturday at 10:00 and open doors at 09:30?",
    sentAt: "2026-08-01T07:18:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
  {
    id: "demo-wa-19",
    position: 18,
    senderName: "Daniel",
    content:
      "Saturday works. I'll confirm the volunteer check-in flow after the venue call.",
    sentAt: "2026-08-01T07:34:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
  {
    id: "demo-email-42",
    position: 41,
    senderName: "Priya",
    content:
      "Subject: Venue confirmed\n\nThe Watershed team confirmed Hall B for Saturday. Capacity is 350 and doors can open at 09:30. The signed venue note is attached.",
    sentAt: "2026-08-01T09:12:00.000Z",
    sourcePlatform: "email",
    sourceLabel: "Re: Community launch",
  },
  {
    id: "demo-wa-67",
    position: 66,
    senderName: "Maya",
    content:
      "Great — Hall B and 09:30 doors are locked. Let's keep the public start at 10:00.",
    sentAt: "2026-08-01T09:26:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
  {
    id: "demo-discord-88",
    position: 87,
    senderName: "Daniel",
    content:
      "Posted the revised volunteer rota in #launch-ops. We still need two people on accessibility check-in; I can own filling those spots by Thursday.",
    sentAt: "2026-08-01T11:03:00.000Z",
    sourcePlatform: "discord",
    sourceLabel: "#launch-ops",
  },
  {
    id: "demo-wa-104",
    position: 103,
    senderName: "Jonah",
    content:
      "Do we have a final call on the livestream? The AV quote expires tomorrow.",
    sentAt: "2026-08-01T12:41:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
  {
    id: "demo-wa-121",
    position: 120,
    senderName: "Maya",
    content:
      "Let's approve the basic livestream package. Jonah, please reply to AV before 15:00 tomorrow.",
    sentAt: "2026-08-01T13:08:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
  {
    id: "demo-email-139",
    position: 138,
    senderName: "Priya",
    content:
      "Subject: Catering numbers\n\nI need dietary totals by Thursday noon to confirm the food order. Who has the latest registration export?",
    sentAt: "2026-08-01T14:22:00.000Z",
    sourcePlatform: "email",
    sourceLabel: "Community launch catering",
  },
  {
    id: "demo-discord-161",
    position: 160,
    senderName: "Daniel",
    content:
      "Latest run-of-show is here: https://example.com/run-of-show — added the 09:15 volunteer briefing and accessibility desk.",
    sentAt: "2026-08-01T16:05:00.000Z",
    sourcePlatform: "discord",
    sourceLabel: "#launch-ops",
  },
  {
    id: "demo-wa-184",
    position: 183,
    senderName: "Jonah",
    content:
      "AV booked. I'll share the technician's arrival time once they reply.",
    sentAt: "2026-08-01T17:37:00.000Z",
    sourcePlatform: "whatsapp",
    sourceLabel: "Launch crew",
  },
];

function evidence(id: string): EvidenceReference {
  const message = messages.find((item) => item.id === id)!;
  return {
    messageId: message.id,
    position: message.position,
    senderName: message.senderName,
    sentAt: message.sentAt,
  };
}

const summary: CatchUpSummary = {
  id: "synthetic-cross-channel-demo",
  overview:
    "The launch is confirmed for Saturday in Hall B, with doors at 09:30 and a 10:00 start. The team approved a basic livestream, while volunteer accessibility coverage and final dietary totals still need attention.",
  overviewEvidence: [
    evidence("demo-email-42"),
    evidence("demo-wa-67"),
    evidence("demo-wa-121"),
    evidence("demo-discord-88"),
  ],
  keyTopics: [
    {
      text: "Venue timing and capacity were finalised after the RSVP count passed 300.",
      evidence: [evidence("demo-wa-13"), evidence("demo-email-42")],
    },
    {
      text: "Operations focused on volunteer coverage, accessibility check-in, catering, and AV.",
      evidence: [
        evidence("demo-discord-88"),
        evidence("demo-email-139"),
        evidence("demo-wa-104"),
      ],
    },
  ],
  decisions: [
    {
      text: "Use Hall B, open doors at 09:30, and keep the public start at 10:00.",
      evidence: [evidence("demo-email-42"), evidence("demo-wa-67")],
    },
    {
      text: "Proceed with the basic livestream package.",
      evidence: [evidence("demo-wa-121")],
    },
  ],
  actionItems: [
    {
      text: "Fill the two remaining accessibility check-in volunteer spots.",
      owner: "Daniel",
      due: "Thursday",
      evidence: [evidence("demo-discord-88")],
    },
    {
      text: "Send final dietary totals so the catering order can be confirmed.",
      due: "Thursday at 12:00",
      evidence: [evidence("demo-email-139")],
    },
    {
      text: "Confirm the AV technician's arrival time with the group.",
      owner: "Jonah",
      evidence: [evidence("demo-wa-184")],
    },
  ],
  openQuestions: [
    {
      text: "Who owns the latest registration export for dietary totals?",
      evidence: [evidence("demo-email-139")],
    },
  ],
  importantLinks: [
    {
      url: "https://example.com/run-of-show",
      label: "Synthetic launch run-of-show",
      evidence: [evidence("demo-discord-161")],
    },
  ],
  scope: {
    messageCount: 184,
    periodStart: "2026-08-01T07:18:00.000Z",
    periodEnd: "2026-08-01T17:37:00.000Z",
  },
  generatedAt: "2026-08-01T17:40:00.000Z",
};

export default function CatchUpDemoPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_28%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Interactive synthetic demo ·
            no personal data
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Ten hours of group chat.
            <span className="block bg-gradient-to-r from-emerald-600 to-indigo-600 bg-clip-text text-transparent">
              Clear in 90 seconds.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            ConvoLens turns a busy conversation into a grounded brief, then
            keeps every conclusion connected to the exact WhatsApp, email, or
            Discord evidence behind it.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium shadow-sm">
              <Clock3 className="h-4 w-4 text-emerald-600" /> 184 messages
              reviewed
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium shadow-sm">
              <Layers3 className="h-4 w-4 text-indigo-600" /> 3 contextual
              sources
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium shadow-sm">
              <Sparkles className="h-4 w-4 text-violet-600" /> 3 next actions
              found
            </span>
          </div>
          <a
            href="#catch-up-heading"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Explore the catch-up <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <CatchUpSummaryPanel
          conversationId="synthetic-cross-channel-demo"
          messageCount={184}
          participantCount={4}
          initialSummary={summary}
          readOnly
        />
        <AnnotatedSourceConversation
          messages={messages}
          summary={summary}
          demoContext
        />

        <section className="mt-10 rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:flex sm:items-center sm:justify-between sm:px-9">
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              Ready for your own conversation?
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Import once. Catch up with receipts.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              The signed-in workspace keeps imported conversations private and
              makes every important summary claim verifiable.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="mt-5 shrink-0 bg-white text-slate-950 hover:bg-slate-100 sm:ml-6 sm:mt-0"
          >
            <Link href="/login">
              Open ConvoLens <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
