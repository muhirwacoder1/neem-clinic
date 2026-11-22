import { ConvexHttpClient } from "convex/browser";

export function clinicServer() {
  const url = process.env["CONVEX_URL"] || import.meta.env["VITE_CONVEX_URL"];
  if (!url) throw new Error("Set CONVEX_URL or VITE_CONVEX_URL.");
  return new ConvexHttpClient(url);
}

export function bookingSecret() {
  const secret = process.env["CLINIC_SERVER_SECRET"];
  if (!secret) throw new Error("Set CLINIC_SERVER_SECRET.");
  return secret;
}
