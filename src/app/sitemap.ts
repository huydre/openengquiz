import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";

/** Public sets for search engines, read without cookies and cached for a few hours. */
async function publicSets() {
  "use cache";
  cacheLife("hours");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.from("study_sets").select("id, updated_at").eq("visibility", "public")
    .order("updated_at", { ascending: false }).limit(5000);
  return data ?? [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const sets = await publicSets();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...sets.map((set) => ({ url: `${base}/shared/${set.id}`, lastModified: set.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
