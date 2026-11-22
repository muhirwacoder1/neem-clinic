import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.ts";

type ReadCtx = QueryCtx | MutationCtx;
export type Role = Doc<"user_roles">["role"];
export type Staff = { id: string; name: string; role: Role; service: string | null };
export const now = () => new Date().toISOString();
export const fail = (message: string): never => {
  throw new ConvexError(message);
};
export function id() {
  // Record IDs are identifiers, never authorization tokens.
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, "0"),
  ).join("");
}

export function row<T extends { _id: unknown; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...data } = doc;
  return data;
}

export async function findStaff(ctx: ReadCtx): Promise<Staff | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_clerkSubject", (q) => q.eq("clerkSubject", identity.subject))
    .unique();
  if (!profile || profile.disabled) return null;
  const roles = await ctx.db
    .query("user_roles")
    .withIndex("by_user_id", (q) => q.eq("user_id", profile.id))
    .take(3);
  const role = roles.find((r) => r.role === "super_admin")?.role ?? roles[0]?.role;
  return role
    ? { id: profile.id, name: profile.full_name || profile.email, role, service: profile.service }
    : null;
}

export async function staff(ctx: ReadCtx): Promise<Staff> {
  return (await findStaff(ctx)) ?? fail("Staff access required.");
}

export async function admin(ctx: ReadCtx): Promise<Staff> {
  const actor = await staff(ctx);
  if (actor.role !== "super_admin") fail("Only the super admin can do this.");
  return actor;
}

export function canAccessService(actor: Staff, service: string) {
  return actor.role !== "provider" || actor.service === null || actor.service === service;
}

export function canBill(actor: Staff, department: string) {
  return (
    actor.role === "super_admin" ||
    (actor.role === "checkin"
      ? department === "reception"
      : department !== "reception" && (!actor.service || actor.service === department))
  );
}

export function audit(
  ctx: MutationCtx,
  actor: Pick<Staff, "id" | "name"> | null,
  category: "billing" | "prices" | "booking",
  action: string,
  details = "",
  appointment_id: string | null = null,
  patientName = "Patient",
) {
  return ctx.db.insert("activity_log", {
    id: id(),
    actor_id: actor?.id ?? null,
    actor_name: actor?.name ?? patientName,
    category,
    action,
    details,
    appointment_id,
    created_at: now(),
  });
}

export function assertSecret(value: string, expected: string | undefined) {
  if (!expected || value.length !== expected.length) fail("Unauthorized.");
  let mismatch = 0;
  for (let index = 0; index < value.length; index++)
    mismatch |= value.charCodeAt(index) ^ expected!.charCodeAt(index);
  if (mismatch) fail("Unauthorized.");
}

export function int(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail("Invalid numeric value.");
  return value;
}

export function text(value: string, max: number, min = 0) {
  const clean = value.trim();
  if (clean.length < min || clean.length > max) fail("Invalid text length.");
  return clean;
}

export async function getService(ctx: ReadCtx, service: string) {
  return ctx.db
    .query("services")
    .withIndex("by_legacy_id", (q) => q.eq("id", service))
    .unique();
}
