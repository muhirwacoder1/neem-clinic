import { useAuth, useClerk, useUser } from "@clerk/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  headers: () => ({ "cache-control": "private, no-store", "referrer-policy": "no-referrer" }),
  component: StaffSession,
});

function StaffSession() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useClerk();
  const { isSignedIn, sessionClaims } = useAuth();
  const { user } = useUser();
  const profile = useQuery(api.staff.me, isAuthenticated ? {} : "skip");
  const claim = useMutation(api.staff.claim);
  const [claimResult, setClaimResult] = useState<"denied" | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isAuthenticated || profile !== null) return;
    let current = true;
    void claim({}).then(
      (allowed) => {
        if (current && !allowed) setClaimResult("denied");
      },
      () => {
        if (current) setClaimResult("error");
      },
    );
    return () => {
      current = false;
    };
  }, [claim, isAuthenticated, profile, attempt]);

  if (isLoading || (isAuthenticated && (profile === undefined || (!profile && !claimResult)))) {
    return <p className="p-8 text-sm">Loading…</p>;
  }
  if (!isAuthenticated && !isSignedIn) return <Navigate to="/provider" replace />;
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-medium">Could not connect your staff session</h1>
        <p className="mt-3 text-sm">
          Try signing in again. Contact your administrator if this keeps happening.
        </p>
        <button
          type="button"
          className="mt-5 underline"
          onClick={() => void signOut({ redirectUrl: "/provider" })}
        >
          Sign out
        </button>
      </main>
    );
  }
  if (profile) return <Outlet />;
  // Display-only diagnostics for the native Clerk integration. The backend
  // independently verifies its token and is the only authority for staff roles.
  // In JWT-template mode the session claims describe a different token.
  const nativeToken = sessionClaims?.["aud"] === "convex";
  const missingClaims =
    nativeToken &&
    (typeof sessionClaims["email"] !== "string" ||
      !sessionClaims["email"].trim() ||
      typeof sessionClaims["email_verified"] !== "boolean");
  const unverified = nativeToken && sessionClaims["email_verified"] === false;
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-medium">
        {missingClaims
          ? "Staff sign-in needs configuration"
          : unverified
            ? "Verify your staff email"
            : claimResult === "error"
              ? "Could not verify staff access"
              : "Waiting for staff access"}
      </h1>
      {user?.primaryEmailAddress?.emailAddress && (
        <p className="mt-3 break-all text-sm">
          Signed in as {user.primaryEmailAddress.emailAddress}
        </p>
      )}
      <p className="mt-3 text-sm">
        {missingClaims
          ? "Your sign-in is missing the email details needed to check staff access. The site administrator needs to update the sign-in configuration, then you can sign in again."
          : unverified
            ? "Verify the email address on your account, then sign in again to check access."
            : "Sign in with your approved staff email and contact your clinic administrator if you need access."}
      </p>
      <div className="mt-5 flex justify-center gap-4">
        <button
          type="button"
          className="underline"
          onClick={() => {
            setClaimResult(null);
            setAttempt((current) => current + 1);
          }}
        >
          Check access again
        </button>
        <button
          type="button"
          className="underline"
          onClick={() => void signOut({ redirectUrl: "/provider" })}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
