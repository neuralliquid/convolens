import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AuthCodeError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="space-y-4 max-w-md w-full">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Authentication Error</h1>
          <p className="text-muted-foreground">
            There was a problem signing in. The authentication code might be invalid or expired.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go back to login</Link>
        </Button>
      </div>
    </div>
  );
}
