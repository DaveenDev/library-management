/**
 * Narrow an unknown thrown value to a displayable message.
 *
 * `catch` binds `unknown`, and anything can be thrown — so this avoids
 * `catch (e: any)` while still surfacing the API's error text, which
 * `api.ts` packages into a real Error.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
