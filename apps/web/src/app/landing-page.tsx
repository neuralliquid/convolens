"use client";

import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  MessageSquare,
  Network,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import styles from "./landing-page.module.css";
import "./enhanced-styles.css";

const availableNow = [
  "Sign in with Mystira Identity",
  "Choose one WhatsApp conversation",
  "Store its messages and provenance",
];

const operatingLoop = [
  {
    icon: MessageSquare,
    eyebrow: "Live now",
    title: "Capture the support signal",
    description:
      "Bring in the customer conversation you choose without opening the rest of the account.",
  },
  {
    icon: ListChecks,
    eyebrow: "Next layer",
    title: "Draft accountable work",
    description:
      "AI-assisted extraction turns requests, evidence, and commitments into tickets for human review.",
  },
  {
    icon: Network,
    eyebrow: "Planned stack",
    title: "Coordinate resolution",
    description:
      "Approved work can move through Codeflow and Cognitive Mesh while keeping the source conversation attached.",
  },
  {
    icon: Send,
    eyebrow: "Planned stack",
    title: "Close the response loop",
    description:
      "Resolution context can flow into OmniPost for governed customer and stakeholder responses.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className={`${styles.vectorShapes} vector-shapes`}
        aria-hidden="true"
      >
        <div className="vector-circle"></div>
        <div className="vector-square"></div>
        <div className="vector-hexagon"></div>
        <div className="vector-diamond"></div>
      </div>

      <section
        className={`relative overflow-hidden bg-gradient pb-28 pt-24 ${styles.heroGradient}`}
      >
        <div
          className="absolute inset-0 z-0 opacity-30 dark:opacity-20"
          aria-hidden="true"
        >
          <div className="absolute right-0 top-0 h-80 w-80 -translate-y-1/2 translate-x-1/4 rounded-full bg-green-300 blur-3xl dark:bg-green-700"></div>
          <div className="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/4 translate-y-1/2 rounded-full bg-green-200 blur-3xl dark:bg-green-800"></div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-4 py-2 text-sm font-semibold text-green-800 shadow-sm backdrop-blur dark:border-green-800 dark:bg-gray-900/75 dark:text-green-300">
              <Sparkles className="h-4 w-4" />
              Consent-first support intake
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              Turn support conversations into work that gets resolved.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-gray-600 dark:text-gray-300">
              ConvoLens preserves the customer signal at intake, then builds
              toward AI-assisted ticket creation, coordinated resolution, and an
              accountable response loop across the NeuralLiquid stack.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login?redirectTo=/dashboard"
                className="btn-glow rounded-lg bg-green-700 px-8 py-3 text-center font-semibold text-white shadow-md transition hover:bg-green-800 hover:shadow-lg"
              >
                Start an intake
              </Link>
              <Link
                href="/features"
                className="glassmorphism flex items-center justify-center rounded-lg px-8 py-3 text-center font-semibold text-gray-900 shadow-md transition hover:shadow-lg dark:text-white"
              >
                Explore the operating loop
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-7 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700 dark:text-green-300">
                  Available now
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  From conversation to accountable work
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                <MessageSquare className="h-6 w-6" />
              </div>
            </div>
            <ol className="mt-7 space-y-4">
              {availableNow.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-gray-800 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Conversation capture and durable storage are live. Ticket
              drafting, resolution orchestration, and response delivery are the
              product direction—not claims of current automation.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-gray-50 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700 dark:text-green-300">
              The operating loop
            </p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Intake is the start, not the destination
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-400">
              Preserve the original support context, convert it into reviewed
              work, carry it through resolution, and return a governed response.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {operatingLoop.map(
              ({ icon: Icon, eyebrow, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                    <Icon className="h-6 w-6 text-green-700 dark:text-green-300" />
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-300">
                    {eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-3 leading-7 text-gray-600 dark:text-gray-400">
                    {description}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-white py-20 dark:bg-gray-800">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-green-100 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950/30">
            <ShieldCheck className="h-8 w-8 text-green-700 dark:text-green-300" />
            <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
              Consent and provenance stay attached
            </h2>
            <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
              You choose the conversation. ConvoLens preserves senders,
              timestamps, and source context so later tickets and decisions can
              be traced back to the customer signal.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 dark:border-amber-900 dark:bg-amber-950/25">
            <Sparkles className="h-8 w-8 text-amber-700 dark:text-amber-300" />
            <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
              The moat compounds through outcomes
            </h2>
            <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
              The defensible asset is not a message count or a generic summary.
              It is the growing link between support evidence, reviewed work,
              resolution decisions, corrections, and the response that closed
              the loop.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`relative z-10 bg-gradient py-20 ${styles.ctaGradient}`}
      >
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Start with the support conversation in front of you.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-green-100">
            Preserve the source now. Build the reviewed ticket, resolution, and
            response trail from there.
          </p>
          <Link
            href="/login?redirectTo=/dashboard"
            className="mt-9 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-green-800 shadow-md transition hover:bg-gray-100"
          >
            Start an intake
          </Link>
        </div>
      </section>
    </div>
  );
}
