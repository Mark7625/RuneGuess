import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "RuneGuess",
  description: "OSRS examine guessing game"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

