import type { Adapter } from "@auth/core/adapters";

const DEPRECATION_MESSAGE =
  "Auth.js + Convex adapter is deprecated in this project. Use Supabase auth flows instead.";

async function deprecatedAdapterMethod(): Promise<never> {
  throw new Error(DEPRECATION_MESSAGE);
}

/**
 * Legacy compatibility export.
 *
 * This project has migrated from Convex-backed Auth.js to Supabase auth,
 * but the symbol is kept to avoid import crashes in stale local setups.
 */
export const ConvexAdapter = new Proxy(
  {},
  {
    get() {
      return deprecatedAdapterMethod;
    },
  }
) as Adapter;
