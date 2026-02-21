import { Id } from "./_generated/dataModel";
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;
type DbAuthCtx = QueryCtx | MutationCtx;

function hasDb(ctx: AuthCtx): ctx is DbAuthCtx {
  return "db" in ctx;
}

async function getUserById(ctx: DbAuthCtx, maybeUserId: string) {
  try {
    return await ctx.db.get(maybeUserId as Id<"users">);
  } catch {
    return null;
  }
}

function canPatchUsers(ctx: DbAuthCtx): ctx is MutationCtx {
  return "patch" in ctx.db;
}

async function getViewerId(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return null;
  }

  if (!hasDb(ctx)) {
    return identity.subject as Id<"users">;
  }

  const legacyUser = await getUserById(ctx, identity.subject);
  if (legacyUser !== null) {
    return legacyUser._id;
  }

  const mappedUser = await ctx.db
    .query("users")
    .withIndex("supabaseUserId", (q) =>
      q.eq("supabaseUserId", identity.subject)
    )
    .unique();

  if (mappedUser !== null) {
    return mappedUser._id;
  }

  const identityEmail = identity.email ?? null;
  if (identityEmail !== null) {
    const userByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identityEmail))
      .unique();

    if (userByEmail !== null) {
      if (
        userByEmail.supabaseUserId !== identity.subject &&
        canPatchUsers(ctx)
      ) {
        await ctx.db.patch(userByEmail._id, {
          supabaseUserId: identity.subject,
        });
      }
      return userByEmail._id;
    }
  }

  return null;
}

export async function handleUserId(ctx: AuthCtx) {
  const viewerId = await getViewerId(ctx);

  if (viewerId === null) {
    console.error("user is not authenticated or not mapped to a Convex user");
  }

  return viewerId;
}
