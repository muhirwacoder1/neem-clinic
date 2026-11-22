import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server.ts";
import { internal } from "./_generated/api.ts";
import { nullableString, staffRole } from "./schema.ts";
import { admin, audit, fail, findStaff, getService, id, now, text } from "./lib.ts";

const staffSummary = v.object({
  id: v.string(),
  name: v.string(),
  role: staffRole,
  service: nullableString,
});
export const me = query({ args: {}, returns: v.union(staffSummary, v.null()), handler: findStaff });

export const claim = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    if (await findStaff(ctx)) return true;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email || identity.emailVerified !== true) return false;
    const email = identity.email.trim().toLowerCase();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (profile) {
      if (profile.disabled || (profile.clerkSubject && profile.clerkSubject !== identity.subject))
        return false;
      const role = await ctx.db
        .query("user_roles")
        .withIndex("by_user_id", (q) => q.eq("user_id", profile.id))
        .first();
      if (!role) return false;
      await ctx.db.patch(profile._id, { clerkSubject: identity.subject });
      return true;
    }
    if (email !== process.env["BOOTSTRAP_ADMIN_EMAIL"]?.trim().toLowerCase()) return false;
    const existing = await ctx.db
      .query("user_roles")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .first();
    if (existing) return false;
    const user_id = id();
    await ctx.db.insert("profiles", {
      id: user_id,
      clerkSubject: identity.subject,
      email,
      full_name: identity.name ?? email,
      service: null,
      created_at: now(),
    });
    await ctx.db.insert("user_roles", { id: id(), user_id, role: "super_admin" });
    return true;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      full_name: v.string(),
      email: v.string(),
      service: nullableString,
      role: v.union(staffRole, v.null()),
      invited: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await admin(ctx);
    const profiles = await ctx.db.query("profiles").take(300);
    return Promise.all(
      profiles
        .filter((p) => !p.disabled)
        .map(async ({ id, full_name, email, service, clerkSubject }) => {
          const roles = await ctx.db
            .query("user_roles")
            .withIndex("by_user_id", (q) => q.eq("user_id", id))
            .take(3);
          return {
            id,
            full_name,
            email,
            service,
            role: roles.find((r) => r.role === "super_admin")?.role ?? roles[0]?.role ?? null,
            invited: !clerkSubject,
          };
        }),
    );
  },
});

const inviteArgs = {
  fullName: v.string(),
  email: v.string(),
  role: staffRole,
  service: nullableString,
};
export const authorizeInvite = internalMutation({
  args: inviteArgs,
  returns: v.string(),
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    const email = text(args.email, 255, 3).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.");
    if (args.service && !(await getService(ctx, args.service))) fail("Unknown department.");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing && !existing.disabled) {
      if (existing.clerkSubject) fail("That staff member already has access.");
      const pending = await ctx.db
        .query("user_roles")
        .withIndex("by_user_id", (q) => q.eq("user_id", existing.id))
        .first();
      if (
        pending?.role !== args.role ||
        existing.service !== (args.role === "provider" ? args.service : null)
      )
        fail("Update the existing staff role before resending.");
      return email;
    }
    const user_id = existing?.id ?? id();
    const profile = {
      full_name: text(args.fullName, 100, 2),
      service: args.role === "provider" ? args.service : null,
      disabled: false,
    };
    if (existing) await ctx.db.patch(existing._id, profile);
    else await ctx.db.insert("profiles", { ...profile, id: user_id, email, created_at: now() });
    await ctx.db.insert("user_roles", { id: id(), user_id, role: args.role });
    await audit(ctx, actor, "booking", "staff_invited", email);
    return email;
  },
});

export const invite = action({
  args: inviteArgs,
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const secret = process.env["CLERK_SECRET_KEY"];
    const origin = process.env["APP_ORIGIN"];
    if (!secret || !origin) return fail("Staff invitations are not configured.");
    const email: string = await ctx.runMutation(internal.staff.authorizeInvite, args);
    const response = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email_address: email,
        redirect_url: new URL("/provider", origin).href,
        ignore_existing: true,
      }),
    });
    return response.ok;
  },
});

export const update = mutation({
  args: { userId: v.string(), role: staffRole, service: nullableString },
  returns: v.null(),
  handler: async (ctx, { userId, role, service }) => {
    const actor = await admin(ctx);
    if (actor.id === userId) fail("You cannot change your own access.");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
    if (!profile || profile.disabled) return fail("Staff account not found.");
    if (service && !(await getService(ctx, service))) fail("Unknown department.");
    const roles = await ctx.db
      .query("user_roles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(3);
    for (const entry of roles) await ctx.db.delete(entry._id);
    await ctx.db.insert("user_roles", { id: id(), user_id: userId, role });
    await ctx.db.patch(profile._id, { service: role === "provider" ? service : null });
    await audit(ctx, actor, "booking", "staff_access_updated", profile.email);
    return null;
  },
});

export const remove = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const actor = await admin(ctx);
    if (actor.id === userId) fail("You cannot remove your own access.");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
    if (!profile) return null;
    const roles = await ctx.db
      .query("user_roles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(3);
    for (const role of roles) await ctx.db.delete(role._id);
    await ctx.db.patch(profile._id, { disabled: true });
    await audit(ctx, actor, "booking", "staff_access_removed", profile.email);
    return null;
  },
});
