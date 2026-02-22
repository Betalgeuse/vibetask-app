/**
 * Legacy Auth.js compatibility shim.
 *
 * This project now authenticates users with Supabase auth actions/routes.
 * The exports below stay in place only to avoid import crashes in stale setups.
 */
const DEPRECATION_MESSAGE =
  "Auth.js integration has been removed. Use Supabase auth actions instead.";

async function deprecatedAuthMethod(..._args: unknown[]): Promise<never> {
  throw new Error(DEPRECATION_MESSAGE);
}

export const handlers = {
  GET: deprecatedAuthMethod,
  POST: deprecatedAuthMethod,
};

export const signIn = deprecatedAuthMethod;
export const signOut = deprecatedAuthMethod;
export const auth = deprecatedAuthMethod;
