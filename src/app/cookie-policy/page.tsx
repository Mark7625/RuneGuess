import Link from "next/link";

export const metadata = {
  title: "Cookie Policy | RuneGuess",
  description: "Cookie Policy for RuneGuess",
};

export default function CookiePolicyPage() {
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
        <h1 className="text-2xl font-bold text-amber-200">Cookie Policy</h1>
        <p className="text-sm text-zinc-400">Last updated: {new Date().toLocaleDateString("en-US")}</p>

        <section className="space-y-4 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-amber-100">1. What Are Cookies</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience.
          </p>

          <h2 className="text-base font-semibold text-amber-100">2. How We Use Cookies</h2>
          <p>
            RuneGuess may use cookies and similar storage (e.g. localStorage) to keep you signed in, remember your game mode (OSRS/RS3), and store other preferences. This data stays on your device or is used only to provide the service.
          </p>

          <h2 className="text-base font-semibold text-amber-100">3. Types of Data We Store</h2>
          <p>
            We may store: authentication tokens (so you stay logged in), game settings, and session data. We do not use cookies for third-party advertising.
          </p>

          <h2 className="text-base font-semibold text-amber-100">4. Third-Party Services</h2>
          <p>
            If we use third-party services (e.g. Google for sign-in or analytics), those services may set their own cookies. Please check their privacy and cookie policies for more information.
          </p>

          <h2 className="text-base font-semibold text-amber-100">5. Your Choices</h2>
          <p>
            You can disable or clear cookies in your browser settings. Note that doing so may affect sign-in and some features of RuneGuess.
          </p>

          <h2 className="text-base font-semibold text-amber-100">6. Updates</h2>
          <p>
            We may update this Cookie Policy from time to time. The &quot;Last updated&quot; date at the top will reflect any changes.
          </p>

          <h2 className="text-base font-semibold text-amber-100">7. Contact</h2>
          <p>
            For questions about cookies or privacy, contact us via Discord or GitHub as linked on the main page.
          </p>
        </section>
      </div>
    </main>
  );
}
