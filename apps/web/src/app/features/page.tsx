import Link from "next/link";
import { FileText, History, LogIn, MessageSquareText } from "lucide-react";
import PageWrapper from "../page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Two import paths",
    description:
      "Upload a WhatsApp .txt export or send a selected chat with the private-preview browser extension.",
    icon: FileText,
  },
  {
    title: "Mystira sign-in",
    description:
      "Use your Mystira Identity account to access your ConvoLens private preview workspace.",
    icon: LogIn,
  },
  {
    title: "Structured conversation record",
    description:
      "Keep messages connected to their participants, timestamps, and source context.",
    icon: MessageSquareText,
  },
  {
    title: "Conversation history",
    description:
      "Open received conversations from the dashboard and review their stored messages.",
    icon: History,
  },
];

export default function FeaturesPage() {
  return (
    <PageWrapper>
      <section className="container py-12">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Private preview
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Preserve a WhatsApp support conversation and its context.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              ConvoLens provides two authenticated WhatsApp import paths today,
              with additional sources planned as validated workflows are added.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary">
                <Link href="/login?redirectTo=/dashboard/import">
                  Sign in to import
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Private preview
                      </span>
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
