// CSRF protection for state-changing POST endpoints (checkout, etc.).
//
// Session cookies are sent on any cross-origin POST by default. We rely on
// SameSite=lax to block top-level cross-site form submissions, BUT a malicious
// site can still trigger fetch() with credentials from a same-site-cookie-set
// browser, OR an attacker can iframe + auto-submit. The cheap belt-and-braces
// fix is to validate the Origin header against an allowlist on routes that
// move money or grant entitlement.
//
// Better-auth has its own trustedOrigins for /api/auth/*; this helper mirrors
// that list for our payment routes. Keep them in sync.

const TRUSTED_ORIGINS: ReadonlyArray<string> = [
  process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000",
  "https://truedrafts.com",
  "https://admin.truedrafts.com",
];

/**
 * Returns true if the request's Origin (or Referer if Origin missing) is in
 * the trusted list. Same-origin fetches always pass.
 *
 * Use on POST/PATCH/DELETE handlers that act on the authenticated user's
 * behalf — call before performing any side effect.
 */
export function isTrustedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    return TRUSTED_ORIGINS.includes(origin);
  }
  // Some non-browser clients omit Origin. Fall back to Referer.
  const referer = req.headers.get("referer");
  if (!referer) {
    // No Origin and no Referer is suspicious for a browser POST. Block.
    return false;
  }
  try {
    const refOrigin = new URL(referer).origin;
    return TRUSTED_ORIGINS.includes(refOrigin);
  } catch {
    return false;
  }
}
