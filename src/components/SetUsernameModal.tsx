"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "runeguess_username_modal_dismissed";

export function getUsernameModalDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DISMISSED_KEY) === "1";
}

export function setUsernameModalDismissed(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISMISSED_KEY, "1");
}

type SetUsernameModalProps = {
  open: boolean;
  onClose: () => void;
  onSetUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
};

export function SetUsernameModal({ open, onClose, onSetUsername }: SetUsernameModalProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (value.length < 3 || value.length > 30) {
      setError("Username must be 3–30 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError("Only letters, numbers, and underscore");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await onSetUsername(value);
    setLoading(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? "Failed to set username");
    }
  };

  const handleLater = () => {
    setUsernameModalDismissed();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Treat any external close (overlay click / ESC) as "Later"
        if (!isOpen && open) {
          handleLater();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You haven&apos;t set a username</DialogTitle>
          <DialogDescription>
            Would you like to choose one now? You can also do this later in Settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mb-4 space-y-3">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Username (3–30 characters)"
            className="w-full rounded border border-input bg-muted px-3 py-2 text-sm text-amber-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            maxLength={30}
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Setting…" : "Set username"}
            </Button>
            <Button type="button" variant="outline" onClick={handleLater}>
              Later
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          You can change this anytime in Settings.
        </p>
      </DialogContent>
    </Dialog>
  );
}

