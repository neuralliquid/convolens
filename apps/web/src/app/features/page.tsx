import Link from 'next/link';
import { BarChart3, Bot, Chrome, GitBranch, MessageSquareText, ShieldCheck } from 'lucide-react';
import PageWrapper from '../page-wrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    title: 'WhatsApp import',
    description: 'Bring in exported chat files today, or use the Chrome extension flow for WhatsApp Web extraction.',
    icon: MessageSquareText,
    href: '/dashboard/import',
  },
  {
    title: 'Conversation analysis',
    description: 'Summarize long threads, surface key topics, and turn message history into structured insight.',
    icon: Bot,
    href: '/dashboard',
  },
  {
    title: 'Visual analytics',
    description: 'Scan message activity, participation, and trend patterns without reading every message manually.',
    icon: BarChart3,
    href: '/dashboard',
  },
  {
    title: 'Cross-platform groups',
    description: 'Connect related conversations and compare behavior across channels and group contexts.',
    icon: GitBranch,
    href: '/cross-platform-groups',
  },
  {
    title: 'Browser connector',
    description: 'Install the ConvoLens Chrome extension from this repo and point it at the production API.',
    icon: Chrome,
    href: '/dashboard/import',
  },
  {
    title: 'Privacy controls',
    description: 'Keep imports explicit, authenticated, and traceable through the ConvoLens account boundary.',
    icon: ShieldCheck,
    href: '/settings',
  },
];

export default function FeaturesPage() {
  return (
    <PageWrapper>
      <main className="container py-12">
        <section className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">ConvoLens features</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Analyze WhatsApp conversations without losing context.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Import chats, extract messages from WhatsApp Web, summarize conversations, and organize the resulting
              insight into dashboards and groups.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/import">Import a chat</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full">
                  <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    <Link className="text-sm font-medium text-primary hover:underline" href={feature.href}>
                      Open
                    </Link>
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
