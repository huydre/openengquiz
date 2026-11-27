import { z } from "zod";

export type MediaImage = { thumb: string; url: string; title: string };

const giphySchema = z.object({
  data: z.array(z.object({
    title: z.string().optional(),
    images: z.object({ fixed_width: z.object({ url: z.string() }), downsized_medium: z.object({ url: z.string() }).optional(), original: z.object({ url: z.string() }) }),
  })),
});

/** Thrown when Giphy refuses because the key's hourly quota is used up. */
export class GiphyRateLimitError extends Error {}

/**
 * Family-safe Giphy search (rating pg by default); only https URLs are returned. Stickers are
 * cut-out illustrations, which depict a concrete noun more literally than reaction GIFs do.
 */
export async function searchGiphy(query: string, apiKey: string, options: {
  limit?: number;
  kind?: "gifs" | "stickers";
  rating?: "g" | "pg";
  init?: RequestInit;
} = {}): Promise<MediaImage[]> {
  const search = new URLSearchParams({ api_key: apiKey, q: query, limit: String(options.limit ?? 12), rating: options.rating ?? "pg", lang: "en" });
  const response = await fetch(`https://api.giphy.com/v1/${options.kind ?? "gifs"}/search?${search}`, options.init);
  if (response.status === 429) throw new GiphyRateLimitError("Giphy rate limit reached");
  if (!response.ok) throw new Error(`Giphy ${response.status}`);
  return giphySchema.parse(await response.json()).data
    .map((gif) => ({
      thumb: gif.images.fixed_width.url,
      url: gif.images.downsized_medium?.url ?? gif.images.original.url,
      title: gif.title || query,
    }))
    .filter((image) => image.url.startsWith("https://"));
}
