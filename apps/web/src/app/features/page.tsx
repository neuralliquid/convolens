import Link from "next/link";
import {
  Chrome,
  FileText,
  ListChecks,
  LogIn,
  MessageSquareText,
  Network,
  Send,
} from "lucide-react";
import PageWrapper from "../page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "WhatsApp text import",
    description:
      "Upload a WhatsApp .txt export without media through the authenticated web workspace.",
    icon: FileText,
    status: "Live in alpha",
    href: "/dashboard/import",
  },
  {
    title: "WhatsApp Web connector",
    description:
      "Choose an open WhatsApp Web chat and send it through the ConvoLens browser extension.",
    icon: Chrome,
    status: "Live for invited testers",
    href: "/dashboard/import",
  },
  {
    title: "Shared sign-in",
    description:
      "Use one Mystira Identity session across the ConvoLens web workspace and extension.",
    icon: LogIn,
    status: "Live in alpha",
    href: "/login",
  },
  {
    title: "Structured conversation intake",
    description:
      "Validate message text, senders, timestamps, and conversation context at the intake boundary.",
    icon: MessageSquareText,
    status: "Live in alpha",
    href: "/dashboard",
  },
  {
    title: "AI-assisted ticket drafting",
    description:
      "Extract requests, evidence, ownership, and commitments into reviewable work without publishing automatically.",
    icon: ListChecks,
    status: "In development",
  },
  {
    title: "Codeflow and Cognitive Mesh resolution",
    description:
      "Carry approved work into the execution stack while retaining links to the source conversation and human decisions.",
    icon: Network,
    status: "Planned",
  },
  {
    title: "OmniPost response loop",
    description:
      "Turn resolved work into governed customer and stakeholder responses through the OmniPost stack.",
    icon: Send,
    status: "Planned",
  },
];

export default function FeaturesPage() {
  return (
    <PageWrapper>
      <main className="container py-12">
        <section className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Alpha scope
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              From support signal to accountable resolution.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              WhatsApp intake and durable context are live now. AI-assisted
              ticket creation, Codeflow/Cognitive Mesh resolution, and OmniPost
              response delivery define the next layers of the operating loop.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary">
                <Link href="/login?redirectTo=/dashboard">Join the alpha</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/import">Choose an intake method</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                        {feature.status}
                      </span>
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                    {feature.href ? (
                      <Link
                        className="text-sm font-medium text-primary hover:underline"
                        href={feature.href}
                      >
                        Open
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not available yet
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </PageWrapper>
  );
}
