/**
 * Public origin of the site for absolute URLs (sitemap, robots, Open Graph). Set
 * NEXT_PUBLIC_SITE_URL in production; Vercel's production domain and localhost are fallbacks.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (configured || "http://localhost:3100").replace(/\/$/, "");
}
