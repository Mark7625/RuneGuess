"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleLater}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md rounded-lg border border-amber-500/50 bg-zinc-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-username-title"
      >
        <h2 id="set-username-title" className="mb-2 text-lg font-semibold text-amber-200">
          You haven&apos;t set a username
        </h2>
        <p className="mb-4 text-sm text-zinc-300">
          Would you like to choose one now? You can also do this later in Settings.
        </p>
        <form onSubmit={handleSubmit} className="mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Username (3–30 characters)"
            className="mb-2 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-amber-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            maxLength={30}
            autoFocus
            disabled={loading}
          />
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Setting…" : "Set username"}
            </Button>
            <Button type="button" variant="outline" onClick={handleLater}>
              Later
            </Button>
          </div>
        </form>
        <p className="text-xs text-zinc-500">
          You can change this anytime in Settings.
        </p>
      </div>
    </div>
  );
}
