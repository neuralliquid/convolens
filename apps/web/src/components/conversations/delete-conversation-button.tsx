"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteConversationButtonProps {
  conversationId: string;
  onDeleted: () => void;
  className?: string;
}

export function DeleteConversationButton({
  conversationId,
  onDeleted,
  className = "",
}: DeleteConversationButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function deleteConversation() {
    const confirmed = window.confirm(
      "Delete this conversation and all of its stored messages? This cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `/api/chat-export/${encodeURIComponent(conversationId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete conversation");
      }
      onDeleted();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Failed to delete conversation",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        className="w-full"
        variant="destructive"
        disabled={isDeleting}
        onClick={deleteConversation}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Deleting…" : "Delete conversation"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
