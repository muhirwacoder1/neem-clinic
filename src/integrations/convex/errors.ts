import { ConvexError } from "convex/values";

export function clinicError(
  error: unknown,
  fallback = "The clinic request could not be completed.",
) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
