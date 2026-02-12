import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: {
    default: "RuneGuess - RuneScape Guessing Games",
    template: "%s | RuneGuess"
  },
  description: "Test your knowledge of Old School RuneScape! Play multiple guessing games including examine text challenges. Compete on leaderboards, track your stats, and improve your RuneScape knowledge.",
  keywords: [
    "RuneScape",
    "OSRS",
    "Old School RuneScape",
    "guessing game",
    "trivia",
    "leaderboard",
    "RuneGuess",
    "RuneScape games",
    "RS trivia",
    "RS quiz",
    "examine text",
    "RS items",
    "RS NPCs",
    "RS objects"
  ],
  authors: [{ name: "RuneGuess" }],
  creator: "RuneGuess",
  publisher: "RuneGuess",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://runeguess.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "RuneGuess",
    title: "RuneGuess - RuneScape Guessing Games",
    description: "Test your knowledge of Old School RuneScape! Play multiple guessing games and compete on leaderboards.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RuneGuess - RuneScape Guessing Games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RuneGuess - RuneScape Guessing Games",
    description: "Test your knowledge of Old School RuneScape! Play multiple guessing games and compete on leaderboards.",
    images: ["/twitter-image.png"],
    creator: "@runeguess",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#f59e0b" },
    ],
  },
  manifest: "/site.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1c1917" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
  category: "games",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://runeguess.com";
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "RuneGuess",
    applicationCategory: "Game",
    operatingSystem: "Web Browser",
    description: "Test your knowledge of Old School RuneScape! Play multiple guessing games including examine text challenges. Compete on leaderboards and track your stats.",
    url: siteUrl,
    author: {
      "@type": "Organization",
      name: "RuneGuess",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

