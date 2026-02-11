"use client";

import { Button } from "@/components/ui/button";
import { Coffee, Github, MessageCircle } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 py-6 text-muted-foreground">
      <div className="flex items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium text-amber-200"
        >
          <a
            href="https://buymeacoffee.com/openrune"
            target="_blank"
            rel="noreferrer"
          >
            <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Donate
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium text-amber-200"
        >
          <a
            href="https://github.com/Mark7625"
            target="_blank"
            rel="noreferrer"
          >
            <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
            GitHub
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium text-amber-200"
        >
          <a
            href="https://discord.gg/fSm2kkaD"
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Discord
          </a>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>© {new Date().getFullYear()} RuneGuess. All rights reserved.</span>
        <span className="text-border">·</span>
        <a href="/terms" className="underline-offset-2 hover:underline text-amber-200/90">
          Terms of Service
        </a>
        <span className="text-border">·</span>
        <a href="/cookie-policy" className="underline-offset-2 hover:underline text-amber-200/90">
          Cookie Policy
        </a>
      </div>
    </footer>
  );
}
