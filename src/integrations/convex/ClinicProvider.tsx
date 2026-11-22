import { ClerkProvider, useAuth } from "@clerk/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState, type ReactNode } from "react";

export function ClinicProvider({ children, staff }: { children: ReactNode; staff: boolean }) {
  const url = import.meta.env["VITE_CONVEX_URL"];
  const publishableKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"];
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));
  if (!client || (staff && !publishableKey)) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-medium">Clinic setup in progress</h1>
        <p className="mt-3 text-sm">The clinic connection needs to be configured.</p>
      </main>
    );
  }
  if (!staff) return <ConvexProvider client={client}>{children}</ConvexProvider>;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/provider"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
