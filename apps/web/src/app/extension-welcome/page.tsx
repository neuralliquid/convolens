import Link from "next/link";
import {
  CheckCircle2,
  Chrome,
  ExternalLink,
  FileText,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import PageWrapper from "../page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "Sign in to ConvoLens",
    description: "Connect the extension to your workspace with Mystira Identity.",
  },
  {
    title: "Open a conversation in WhatsApp Web",
    description: "Choose the support conversation you are authorized to import.",
  },
  {
    title: "Send the current chat",
    description:
      "Open the ConvoLens toolbar icon and select Send Current Chat.",
  },
];

export default function ExtensionWelcomePage() {
  return (
    <PageWrapper>
      <main className="py-4 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <section className="max-w-3xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Chrome className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Browser extension
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              ConvoLens is installed.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Send the WhatsApp conversation you choose into your authenticated
              workspace while preserving its messages, participants, and
              timestamps.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary">
                <Link href="/login?redirectTo=/dashboard/import">
                  Sign in and continue
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href="https://web.whatsapp.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WhatsApp Web
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>

          <section className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Send your first conversation</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-6">
                  {steps.map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div>
                        <h2 className="font-semibold text-foreground">
                          {step.title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    You choose what is sent
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  ConvoLens sends a conversation only when you select it and
                  choose <strong>Send Current Chat</strong>. Use conversations
                  you are authorized to import.
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquareText className="h-5 w-5 text-primary" />
                    Two import paths today
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Browser extension for the WhatsApp Web chat you select.
                  </p>
                  <p className="flex gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    WhatsApp text export when file upload is more convenient.
                  </p>
                  <p>
                    Additional import options are planned as the preview
                    expands.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </PageWrapper>
  );
}
