import Link from "next/link";

export const metadata = {
  title: "Terms of Service | RuneGuess",
  description: "Terms of Service for RuneGuess",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-900 via-stone-900 to-black px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/"
            className="text-sm text-amber-200/90 underline-offset-2 hover:underline"
          >
            ← Back to RuneGuess
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-amber-200">Terms of Service</h1>
        <p className="text-sm text-zinc-400">Last updated: {new Date().toLocaleDateString("en-US")}</p>

        <section className="space-y-4 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-amber-100">1. Acceptance of Terms</h2>
          <p>
            By using RuneGuess, you agree to these Terms of Service. If you do not agree, please do not use the service.
          </p>

          <h2 className="text-base font-semibold text-amber-100">2. Use of the Service</h2>
          <p>
            RuneGuess is a fan-made game for entertainment. You may use the service for personal, non-commercial use in accordance with these terms and any applicable game-related guidelines.
          </p>

          <h2 className="text-base font-semibold text-amber-100">3. Account and Conduct</h2>
          <p>
            If you create an account (e.g. via Google sign-in), you are responsible for keeping your account secure and for activity under your account. You agree not to misuse the service, harass others, or violate any applicable laws.
          </p>

          <h2 className="text-base font-semibold text-amber-100">4. Intellectual Property</h2>
          <p>
            RuneGuess is not affiliated with Jagex or RuneScape. Game-related assets and references are used for fan and educational purposes. Trademarks and content belong to their respective owners.
          </p>

          <h2 className="text-base font-semibold text-amber-100">5. Changes and Termination</h2>
          <p>
            We may update these terms or the service at any time. Continued use after changes constitutes acceptance. We may suspend or terminate access for violation of these terms or for other reasons.
          </p>

          <h2 className="text-base font-semibold text-amber-100">6. Disclaimer</h2>
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of RuneGuess.
          </p>

          <h2 className="text-base font-semibold text-amber-100">7. Contact</h2>
          <p>
            For questions about these terms, you can reach out via our Discord or GitHub linked on the main page.
          </p>
        </section>
      </div>
    </main>
  );
}
