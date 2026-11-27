import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MediaImage = { thumb: string; url: string; title: string };

const openverseSchema = z.object({
  results: z.array(z.object({ url: z.string(), thumbnail: z.string().nullable().optional(), title: z.string().nullable().optional() })),
});
const giphySchema = z.object({
  data: z.array(z.object({
    title: z.string().optional(),
    images: z.object({ fixed_width: z.object({ url: z.string() }), downsized_medium: z.object({ url: z.string() }).optional(), original: z.object({ url: z.string() }) }),
  })),
});
const tenorSchema = z.object({
  results: z.array(z.object({
    content_description: z.string().optional(),
    media_formats: z.object({ tinygif: z.object({ url: z.string() }), gif: z.object({ url: z.string() }) }),
  })),
});
const pixabaySchema = z.object({
  hits: z.array(z.object({ tags: z.string().optional(), webformatURL: z.string(), largeImageURL: z.string() })),
});
const pexelsSchema = z.object({
  photos: z.array(z.object({ alt: z.string().nullable().optional(), src: z.object({ medium: z.string(), large: z.string() }) })),
});

/**
 * Illustration search for cards: Pixabay when PIXABAY_API_KEY is set (fast, free key), else Pexels
 * when PEXELS_API_KEY is set, else Openverse (openly licensed images, no key, slower). Mature
 * results are excluded on every provider.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 80);
  if (!query) return Response.json({ error: "Nhập từ cần tìm ảnh." }, { status: 400 });
  const signal = AbortSignal.timeout(12_000);

  // GIF memes: Giphy (GIPHY_API_KEY) or Tenor (TENOR_API_KEY), both limited to family-safe ratings.
  if (params.get("type") === "gif") {
    const giphyKey = process.env.GIPHY_API_KEY;
    const tenorKey = process.env.TENOR_API_KEY;
    if (!giphyKey && !tenorKey) {
      return Response.json({ error: "Chưa cấu hình kho GIF. Thêm GIPHY_API_KEY hoặc TENOR_API_KEY để tìm GIF." }, { status: 503 });
    }
    try {
      let images: MediaImage[];
      if (giphyKey) {
        const search = new URLSearchParams({ api_key: giphyKey, q: query, limit: "12", rating: "pg", lang: "en" });
        const response = await fetch(`https://api.giphy.com/v1/gifs/search?${search}`, { signal, next: { revalidate: 86_400 } });
        if (!response.ok) throw new Error(`Giphy ${response.status}`);
        images = giphySchema.parse(await response.json()).data.map((gif) => ({
          thumb: gif.images.fixed_width.url,
          url: gif.images.downsized_medium?.url ?? gif.images.original.url,
          title: gif.title || query,
        }));
      } else {
        const search = new URLSearchParams({ key: tenorKey!, q: query, limit: "12", contentfilter: "high", media_filter: "tinygif,gif", client_key: "openengquiz" });
        const response = await fetch(`https://tenor.googleapis.com/v2/search?${search}`, { signal, next: { revalidate: 86_400 } });
        if (!response.ok) throw new Error(`Tenor ${response.status}`);
        images = tenorSchema.parse(await response.json()).results.map((gif) => ({
          thumb: gif.media_formats.tinygif.url,
          url: gif.media_formats.gif.url,
          title: gif.content_description || query,
        }));
      }
      return Response.json({ images: images.filter((image) => image.url.startsWith("https://")), provider: giphyKey ? "giphy" : "tenor" });
    } catch (error) {
      console.error("GIF search failed", error instanceof Error ? error.message : error);
      return Response.json({ error: "Chưa tìm được GIF lúc này. Thử lại sau nhé." }, { status: 502 });
    }
  }

  try {
    const pixabayKey = process.env.PIXABAY_API_KEY;
    const pexelsKey = process.env.PEXELS_API_KEY;
    let images: MediaImage[];
    if (pixabayKey) {
      const params = new URLSearchParams({ key: pixabayKey, q: query, image_type: "photo", safesearch: "true", per_page: "12" });
      const response = await fetch(`https://pixabay.com/api/?${params}`, { signal, next: { revalidate: 86_400 } });
      if (!response.ok) throw new Error(`Pixabay ${response.status}`);
      images = pixabaySchema.parse(await response.json()).hits.map((hit) => ({ thumb: hit.webformatURL, url: hit.largeImageURL, title: hit.tags || query }));
    } else if (pexelsKey) {
      const response = await fetch(`https://api.pexels.com/v1/search?per_page=12&query=${encodeURIComponent(query)}`, {
        headers: { authorization: pexelsKey }, signal, next: { revalidate: 86_400 },
      });
      if (!response.ok) throw new Error(`Pexels ${response.status}`);
      images = pexelsSchema.parse(await response.json()).photos.map((photo) => ({ thumb: photo.src.medium, url: photo.src.large, title: photo.alt ?? query }));
    } else {
      const response = await fetch(`https://api.openverse.org/v1/images/?mature=false&page_size=12&q=${encodeURIComponent(query)}`, {
        headers: { "user-agent": "OpenEngQuiz image search" }, signal, next: { revalidate: 86_400 },
      });
      if (!response.ok) throw new Error(`Openverse ${response.status}`);
      images = openverseSchema.parse(await response.json()).results
        .filter((item) => item.url.startsWith("https://"))
        .map((item) => ({ thumb: item.thumbnail ?? item.url, url: item.url, title: item.title ?? query }));
    }
    return Response.json({ images });
  } catch (error) {
    console.error("Image search failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Chưa tìm được ảnh lúc này. Thử lại sau nhé." }, { status: 502 });
  }
}
