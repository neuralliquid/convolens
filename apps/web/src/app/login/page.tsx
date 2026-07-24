"use client";

import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PageWrapper from "../page-wrapper";

function safeRedirectPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mystiraConfigured, setMystiraConfigured] = useState<boolean | null>(
    null,
  );
  const authError = searchParams.get("error");
  const redirectPath = safeRedirectPath(
    searchParams.get("redirectTo") || searchParams.get("callbackUrl"),
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch("/api/runtime/auth-status", { cache: "no-store" }).then(
        (response) => (response.ok ? response.json() : null),
      ),
      fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      }).then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([runtimeStatus, session]) => {
        if (!mounted) return;

        setMystiraConfigured(Boolean(runtimeStatus?.mystiraConfigured));
        if (session?.user) {
          router.replace(redirectPath);
        }
      })
      .catch(() => {
        if (mounted) setMystiraConfigured(null);
      });

    return () => {
      mounted = false;
    };
  }, [redirectPath, router]);

  let authErrorMessage: string | null = null;

  if (mystiraConfigured === false) {
    authErrorMessage =
      "Sign in is temporarily unavailable. The alpha team has been notified.";
  } else if (
    authError === "mystira" ||
    authError === "OAuthSignin" ||
    authError === "OAuthCallback"
  ) {
    authErrorMessage =
      "Mystira Identity could not complete sign in. Please try again.";
  } else if (authError) {
    authErrorMessage =
      "Sign in failed. Please try again or contact support if this keeps happening.";
  }

  const handleMystiraSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn("mystira", { callbackUrl: redirectPath });
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <PageWrapper>
      <div className="flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md shadow-lg overflow-hidden card-border-animation relative">
          {/* Animated gradient border effect */}
          <div className="h-1.5 bg-gradient-to-r from-[#25D366] via-[#34E89E] to-[#128C7E] animate-gradient-x"></div>

          <CardHeader className="text-center space-y-1">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <div className="h-8 w-8 text-primary font-bold flex items-center justify-center text-xl">
                CL
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Sign in to ConvoLens Alpha
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              One Mystira Identity sign-in connects the web workspace and
              browser extension.
            </p>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-6">
            {authErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>Sign in is not available</AlertTitle>
                <AlertDescription>{authErrorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={handleMystiraSignIn}
              disabled={isSigningIn || mystiraConfigured === false}
            >
              {isSigningIn
                ? "Opening Mystira Identity…"
                : "Sign in with Mystira Identity"}
            </Button>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">New to the alpha?</p>
              <p className="mt-1">
                Use your Mystira account. After sign-in, we will take you
                directly to the first conversation-intake step.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper>
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </PageWrapper>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
