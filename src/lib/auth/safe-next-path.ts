const DEFAULT_PATH = "/home";

/**
 * Returns a same-origin relative path to redirect to after login.
 * Rejects absolute and protocol-relative URLs ("//evil.com") to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_PATH;
  }
  return next;
}
