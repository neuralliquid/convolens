import Link from "next/link";
import { Chrome } from "lucide-react";
import PageWrapper from "../page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtensionInstallInstructions } from "@/components/extension/install-instructions";

export default function ExtensionInstallPage() {
  return (
    <PageWrapper>
      <main className="py-4 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Chrome className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Browser extension
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Install ConvoLens for Chrome
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Private-preview operators can load the unpacked Chrome extension and
            send the WhatsApp Web conversation they choose into ConvoLens.
          </p>

          <Card className="mt-10">
            <CardHeader>
              <CardTitle>Download and load unpacked</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ExtensionInstallInstructions heading="Get the current build" />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/login?redirectTo=/dashboard/import">
                    Sign in after installing
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/extension-welcome">Already installed?</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageWrapper>
  );
}
