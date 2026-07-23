"use client";

import { signIn } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import PageWrapper from '../page-wrapper';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const authError = searchParams.get('error');

  const authErrorMessage =
    authError === 'mystira' || authError === 'OAuthSignin' || authError === 'OAuthCallback'
      ? 'Mystira Identity could not start. This production environment is missing or rejecting its OAuth client configuration.'
      : authError
        ? 'Sign in failed. Please try again or contact support if this keeps happening.'
        : null;

  const handleMystiraSignIn = async () => {
    setIsSigningIn(true);
    const callbackUrl = searchParams.get('redirectTo') || '/dashboard';
    try {
      await signIn('mystira', { callbackUrl });
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
            <div className="h-8 w-8 text-primary font-bold flex items-center justify-center text-xl">CL</div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome back
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with Mystira Identity to continue
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
            disabled={isSigningIn}
          >
            {isSigningIn ? 'Redirecting...' : 'Continue with Mystira Identity'}
          </Button>
        </CardContent>
      </Card>
      </div>
    </PageWrapper>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </PageWrapper>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
