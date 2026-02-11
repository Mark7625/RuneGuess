"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AuthProvider>{children}</AuthProvider>
    </TooltipProvider>
  );
}
