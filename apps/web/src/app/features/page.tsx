import Link from "next/link";
import {
  Bot,
  Chrome,
  FileText,
  Layers3,
  LogIn,
  MessageSquareText,
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
    title: "Generated summaries and insight",
    description:
      "Turn received conversation context into useful summaries and follow-up views.",
    icon: Bot,
    status: "In development",
  },
  {
    title: "Additional platforms",
    description:
      "Bring more conversation sources into the same intake workspace after the WhatsApp alpha.",
    icon: Layers3,
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
              What ConvoLens does today—and what comes next.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              WhatsApp conversation intake is live now. Summary experiences and
              additional platforms are being built as the alpha develops.
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
