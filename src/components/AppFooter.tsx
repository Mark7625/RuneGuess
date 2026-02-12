"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Coffee, Github, MessageCircle, Trophy } from "lucide-react";

export function AppFooter({ onLeaderboardClick }: { onLeaderboardClick?: () => void } = {}) {
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
        <Dialog>
          <DialogTrigger asChild>
            <button className="underline-offset-2 hover:underline text-amber-200/90">
              Terms of Service
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Terms of Service</DialogTitle>
              <DialogDescription asChild>
                <div className="mt-2 space-y-3 text-xs leading-relaxed">
                  <p>
                    By using RuneGuess you agree to these basic terms. If you do not
                    agree, please do not use the site.
                  </p>
                  <p>
                    RuneGuess is a fan-made project and is not affiliated with Jagex or
                    RuneScape. Game assets and references belong to their respective
                    owners.
                  </p>
                  <p>
                    We may update the game or these terms from time to time. Continued
                    use after changes means you accept the updated terms.
                  </p>
                  <p>
                    The service is provided &quot;as is&quot; without any guarantees. Use it at
                    your own risk.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <span className="text-border">·</span>

        <Dialog>
          <DialogTrigger asChild>
            <button className="underline-offset-2 hover:underline text-amber-200/90">
              Cookie Policy
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cookie Policy</DialogTitle>
              <DialogDescription asChild>
                <div className="mt-2 space-y-3 text-xs leading-relaxed">
                  <p>
                    RuneGuess uses browser storage (like cookies or localStorage) to keep
                    you logged in and remember simple preferences such as your selected
                    game mode.
                  </p>
                  <p>
                    We do not use this data for advertising. Any third-party services
                    we rely on (for example, Google sign-in) may set their own cookies
                    according to their policies.
                  </p>
                  <p>
                    You can clear or block cookies in your browser settings, but some
                    features of RuneGuess may stop working correctly if you do.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  );
}
