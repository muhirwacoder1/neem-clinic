import type { Doc } from "./_generated/dataModel.ts";
import type { MutationCtx } from "./_generated/server.ts";

export async function enqueue(
  ctx: MutationCtx,
  key: string,
  payload: Doc<"email_outbox">["payload"],
) {
  const exists = await ctx.db
    .query("email_outbox")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!exists)
    await ctx.db.insert("email_outbox", {
      key,
      payload,
      status: "pending",
      attempts: 0,
      dueAt: Date.now(),
    });
}
