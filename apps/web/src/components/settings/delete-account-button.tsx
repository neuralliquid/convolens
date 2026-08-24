"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@convolens/contexts";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteAccountButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Delete your account? This permanently deletes every conversation, message, and file you've imported. This cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(undefined);

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete account");
      }
      await logout();
      router.push("/");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to delete account",
      );
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        disabled={isDeleting}
        onClick={deleteAccount}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Deleting…" : "Delete account"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
