import { SignIn, SignUp, useAuth } from "@clerk/react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/provider")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Provider Sign In | ${BRAND_NAME}` },
      {
        name: "description",
        content: "Staff sign-in to manage appointments and patient check-ins.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProviderSignIn,
});

function ProviderSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const [signUp, setSignUp] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("__clerk_ticket"),
  );
  if (isSignedIn) return <Navigate to="/dashboard" replace />;
  return (
    <main className="flex min-h-screen flex-col bg-navy text-navy-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/">
          <BrandLogo onNavy className="h-auto w-24 sm:w-[126px]" />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/30 px-4 py-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
        {!isLoaded ? (
          <p>Loading…</p>
        ) : signUp ? (
          <SignUp routing="hash" fallbackRedirectUrl="/dashboard" />
        ) : (
          <SignIn routing="hash" fallbackRedirectUrl="/dashboard" />
        )}
        {isLoaded && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setSignUp((current) => !current)}
          >
            {signUp ? "Back to staff sign-in" : "Set up an approved staff account"}
          </button>
        )}
      </section>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-navy-foreground/60">
        © 2026 {BRAND_NAME}
      </footer>
    </main>
  );
}
