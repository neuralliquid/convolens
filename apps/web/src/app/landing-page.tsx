"use client";

import Link from "next/link";
import { ArrowRight, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import styles from "./landing-page.module.css";
import "./enhanced-styles.css";

const availableNow = [
  "Sign in with Mystira Identity",
  "Choose a text export or browser extension",
  "Review the saved messages and context",
];

const importSteps = [
  {
    icon: MessageSquare,
    title: "Choose the conversation",
    description:
      "Export the WhatsApp chat you are permitted to bring into your workspace.",
  },
  {
    icon: FileText,
    title: "Choose an import path",
    description:
      "Upload a WhatsApp text export or send the selected chat with the browser extension.",
  },
  {
    icon: ShieldCheck,
    title: "Review the saved record",
    description:
      "Open the conversation in your private preview workspace and confirm the source context is intact.",
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
            <Badge
              variant="preview"
              className="mb-6 gap-2 px-4 py-2 text-sm shadow-sm backdrop-blur dark:bg-gray-900/75"
            >
              <ShieldCheck className="h-4 w-4" />
              Private preview
            </Badge>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              Keep an important WhatsApp conversation in one place.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-gray-600 dark:text-gray-300">
              Whether it&apos;s a conversation you need to keep for yourself
              or one your team needs on record, import a WhatsApp chat by
              text export or browser extension and preserve its messages,
              participants, and timestamps in a focused workspace.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login?redirectTo=/dashboard/import"
                className="btn-glow rounded-lg bg-green-700 px-8 py-3 text-center font-semibold text-white shadow-md transition hover:bg-green-800 hover:shadow-lg"
              >
                Sign in to import a conversation
              </Link>
              <Link
                href="/extension"
                className="glassmorphism flex items-center justify-center rounded-lg px-8 py-3 text-center font-semibold text-gray-900 shadow-md transition hover:shadow-lg dark:text-white"
              >
                Install the browser extension
              </Link>
              <Link
                href="/features"
                className="glassmorphism flex items-center justify-center rounded-lg px-8 py-3 text-center font-semibold text-gray-900 shadow-md transition hover:shadow-lg dark:text-white"
              >
                See how it works
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-7 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700 dark:text-green-300">
                  Available in private preview
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  A focused WhatsApp import
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
              Start with a WhatsApp text export or the private-preview browser
              extension. Additional import paths are planned as the preview
              expands.
            </p>
            <Badge variant="planned" className="mt-3">
              More import paths — planned
            </Badge>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-gray-50 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-700 dark:text-green-300">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Bring in one conversation. Keep its context intact.
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {importSteps.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <Icon className="h-6 w-6 text-green-700 dark:text-green-300" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
                <p className="mt-3 leading-7 text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-white py-20 dark:bg-gray-800">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-green-100 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950/30">
            <ShieldCheck className="h-8 w-8 text-green-700 dark:text-green-300" />
            <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
              You decide what to import
            </h2>
            <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
              ConvoLens receives the export you select. It does not open or sync
              the rest of your WhatsApp account.
            </p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950/30">
            <MessageSquare className="h-8 w-8 text-green-700 dark:text-green-300" />
            <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
              The source context stays attached
            </h2>
            <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
              Messages remain connected to their senders and timestamps so you
              can review the conversation as it was received.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`relative z-10 bg-gradient py-20 ${styles.ctaGradient}`}
      >
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Preserve the conversation you need to act on.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-green-100">
            Start with one WhatsApp text export in the private preview.
          </p>
          <Link
            href="/login?redirectTo=/dashboard/import"
            className="mt-9 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-green-800 shadow-md transition hover:bg-gray-100"
          >
            Sign in to import
          </Link>
        </div>
      </section>
    </div>
  );
}
