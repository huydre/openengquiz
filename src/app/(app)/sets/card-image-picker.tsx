"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Search, Upload } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { setCardImage } from "./card-actions";
import type { CardRecord } from "./card-record";

type Found = { thumb: string; url: string; title: string };
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Picks the illustration of a card: search openly licensed photos (prefilled with the term),
 * upload one of your own (stored under your user folder), or remove the image.
 */
export function CardImagePicker({ setId, card, open, onOpenChange }: {
  setId: string;
  card: CardRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(card.term);
  const [kind, setKind] = useState<"gif" | "photo">("gif");
  const [images, setImages] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const searched = useRef(false);

  async function search(value: string, type: "gif" | "photo" = kind) {
    if (!value.trim()) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/media/search?q=${encodeURIComponent(value.trim())}&type=${type}`);
      const body = await response.json().catch(() => ({}));
      // No GIF provider configured: fall back to photos so the picker is still useful.
      if (response.status === 503 && type === "gif") {
        setKind("photo");
        setNotice("Kho GIF chưa được cấu hình, đang hiện ảnh chụp.");
        await search(value, "photo");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Chưa tìm được ảnh.");
      setImages(body.images ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tìm được ảnh.");
    } finally {
      setSearching(false);
    }
  }

  // Search once with the card's term when the dialog first opens (later searches are user-driven).
  useEffect(() => {
    if (open && !searched.current) {
      searched.current = true;
      void search(card.term);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per opening, not on every search change
  }, [open, card.term]);

  async function save(url: string | null) {
    setSaving(true);
    setError("");
    const result = await setCardImage(setId, card.id, url);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onOpenChange(false);
    router.refresh();
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chỉ nhận tệp ảnh."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError("Ảnh tối đa 2 MB."); return; }
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vui lòng đăng nhập lại.");
      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const path = `${user.id}/${card.id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("card-images").upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error("Chưa tải được ảnh lên.");
      const { data } = supabase.storage.from("card-images").getPublicUrl(path);
      await save(data.publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tải được ảnh lên.");
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="bg-card max-h-[88vh] overflow-auto rounded-3xl border-2 sm:max-w-2xl [&>*]:min-w-0">
        <DialogTitle className="pr-8 text-xl font-black">Ảnh cho &ldquo;{card.term}&rdquo;</DialogTitle>

        <div className="bg-muted/60 flex w-fit rounded-2xl p-1" role="tablist" aria-label="Loại ảnh">
          {(["gif", "photo"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              onClick={() => { setKind(value); setImages(null); void search(query, value); }}
              className={cn("rounded-xl px-4 py-1.5 text-sm font-extrabold", kind === value ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {value === "gif" ? "GIF meme" : "Ảnh chụp"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2" role="search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm ảnh"
            placeholder={kind === "gif" ? "Tìm GIF, ví dụ: happy, tired, let\u2019s go" : "Tìm ảnh minh hoạ"}
            className="bg-muted/40 focus-visible:border-primary h-11 min-w-0 flex-1 rounded-2xl border-2 px-4 font-semibold outline-none"
          />
          <Button type="submit" size="lg" disabled={searching}><Search aria-hidden="true" /> Tìm</Button>
        </form>

        {searching ? <LogoLoader size="sm" label="Đang tìm ảnh..." /> : null}
        {notice ? <p role="status" className="text-muted-foreground text-sm font-semibold">{notice}</p> : null}
        {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}

        {images && !searching ? (
          images.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((image) => (
                <li key={image.url}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save(image.url)}
                    aria-label={`Chọn ảnh: ${image.title}`}
                    className={cn(
                      "bg-muted block aspect-square w-full overflow-hidden rounded-2xl border-2 transition-transform hover:scale-[1.03]",
                      card.image_url === image.url ? "border-primary ring-primary/40 ring-2" : "border-transparent",
                    )}
                  >
                    {/* Remote thumbnails from the image provider; next/image would need every host allow-listed. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.thumb} alt={image.title} loading="lazy" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center text-sm font-semibold">Không tìm thấy ảnh. Thử từ khoá khác nhé.</p>
          )
        ) : null}

        <div className="flex flex-wrap gap-2 border-t-2 pt-4">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={saving} onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden="true" /> Tải ảnh của bạn
          </Button>
          {card.image_url ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={saving} onClick={() => void save(null)}>
              <ImageOff aria-hidden="true" /> Bỏ ảnh
            </Button>
          ) : null}
          {saving ? <LogoLoader size="sm" label="Đang lưu..." /> : null}
        </div>
        <p className="text-muted-foreground text-xs">GIF từ Giphy hoặc Tenor, ảnh chụp từ Pixabay hoặc Openverse, đều lọc nội dung an toàn. Ảnh tải lên tối đa 2 MB.</p>
      </DialogContent>
    </Dialog>
  );
}
