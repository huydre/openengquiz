import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MediaImage = { thumb: string; url: string; title: string };

const openverseSchema = z.object({
  results: z.array(z.object({ url: z.string(), thumbnail: z.string().nullable().optional(), title: z.string().nullable().optional() })),
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

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80);
  if (!query) return Response.json({ error: "Nhập từ cần tìm ảnh." }, { status: 400 });
  const signal = AbortSignal.timeout(12_000);

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
