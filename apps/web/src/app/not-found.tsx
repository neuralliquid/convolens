import Link from 'next/link';
import { Compass, Home, Upload } from 'lucide-react';
import PageWrapper from './page-wrapper';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PageWrapper>
      <main className="container flex min-h-[70vh] items-center py-16">
        <section className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">404</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">That page is not available.</h1>
          <p className="mt-4 text-muted-foreground">
            The route may have moved, or the link may be pointing at a feature that has not been published yet.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="primary">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/import">
                <Upload className="mr-2 h-4 w-4" />
                Import chat
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </PageWrapper>
  );
}
