import { safeNextPath } from "./safe-next-path";

/**
 * Who may open which page. Everything is private unless listed here, so new app pages are
 * protected by default.
 */
const PUBLIC_EXACT = new Set(["/", "/login", "/privacy", "/terms"]);
// /api routes check the session themselves and answer JSON (a redirect would break fetch callers).
const PUBLIC_PREFIXES = ["/auth", "/shared", "/api"];
/** Pages that make no sense once signed in. */
const GUEST_ONLY = new Set(["/login"]);

function isPublic(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  // Files from /public (fonts, robots.txt, licence texts...) have an extension in the last segment.
  return /\.[a-z0-9]+$/i.test(pathname.split("/").pop() ?? "");
}

/**
 * Returns where to redirect, or null to let the request through.
 * `search` is the raw query string (with or without "?"), used to keep `?next=` and filters.
 */
export function routeRedirect(pathname: string, search: string, signedIn: boolean): string | null {
  const params = new URLSearchParams(search);

  if (signedIn && GUEST_ONLY.has(pathname)) {
    const next = safeNextPath(params.get("next"));
    // Never bounce back to a guest-only page (would loop).
    return GUEST_ONLY.has(next.split("?")[0]) ? "/home" : next;
  }

  if (!signedIn && !isPublic(pathname)) {
    const query = params.toString();
    return `/login?next=${encodeURIComponent(query ? `${pathname}?${query}` : pathname)}`;
  }

  return null;
}
