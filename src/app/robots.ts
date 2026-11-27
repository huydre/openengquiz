import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Only the landing page and shared public sets are for search engines; the app itself is private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/shared/"], disallow: ["/api/", "/auth/", "/home", "/sets", "/review", "/courses", "/study", "/lookup", "/stats", "/history", "/onboarding", "/speaking", "/pronunciation", "/account"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
