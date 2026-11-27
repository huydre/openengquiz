"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Languages, Map, Search, Users, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Response of GET /api/search. */
type SearchResponse = {
  sets: { id: string; title: string; cardCount: number }[];
  publicSets: { id: string; title: string; cardCount: number; ownerName: string }[];
  paths: { slug: string; title: string; level: string; setCount: number }[];
  lessons: { href: string; title: string; levelTitle: string }[];
};

type Item = { key: string; href: string; icon: LucideIcon; title: string; detail: string; group: string };

const EMPTY: SearchResponse = { sets: [], publicSets: [], paths: [], lessons: [] };

function toItems(query: string, data: SearchResponse): Item[] {
  const items: Item[] = [];
  if (query.trim().length >= 2) {
    items.push({ key: "lookup", href: `/lookup?q=${encodeURIComponent(query.trim())}`, icon: Languages, title: `Tra từ "${query.trim()}"`, detail: "Nghĩa, ví dụ, phát âm", group: "Tra từ" });
  }
  data.sets.forEach((set) => items.push({ key: `set-${set.id}`, href: `/sets/${set.id}`, icon: BookOpen, title: set.title, detail: `${set.cardCount} thẻ`, group: "Bộ từ của tôi" }));
  data.paths.forEach((path) => items.push({ key: `path-${path.slug}`, href: `/paths/${path.slug}`, icon: Map, title: path.title, detail: `${path.level} · ${path.setCount} bộ từ`, group: "Lộ trình" }));
  data.lessons.forEach((lesson) => items.push({ key: `lesson-${lesson.href}`, href: lesson.href, icon: GraduationCap, title: lesson.title, detail: lesson.levelTitle, group: "Bài học" }));
  data.publicSets.forEach((set) => items.push({ key: `public-${set.id}`, href: `/shared/${set.id}`, icon: Users, title: set.title, detail: `${set.cardCount} thẻ · ${set.ownerName}`, group: "Bộ từ cộng đồng" }));
  return items;
}

/**
 * Global search: a header button (and ⌘K / Ctrl+K) opening a palette that searches the learner's
 * sets, learning paths, course lessons and public sets, with a shortcut to look the text up.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search; stale responses are dropped through the abort signal.
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (response.ok) setData({ ...EMPTY, ...(await response.json()) });
      } catch {
        // Aborted or offline: keep the previous results.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  const items = useMemo(() => (query.trim().length >= 2 ? toItems(query, data) : []), [query, data]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    setQuery("");
    setData(EMPTY);
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, items.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); go(items[active]); }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-muted flex h-9 w-full max-w-md items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition-colors"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Tìm bộ từ, lộ trình, bài học, từ vựng...</span>
        <kbd className="bg-muted hidden rounded-md px-1.5 py-0.5 text-[11px] font-black sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setActive(0); }}>
        <DialogContent aria-describedby={undefined} className="bg-card top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden rounded-3xl border-2 p-0 sm:max-w-xl [&>*]:min-w-0">
          <DialogTitle className="sr-only">Tìm kiếm</DialogTitle>
          <div className="flex items-center gap-3 border-b-2 px-4">
            <Search className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Tìm bộ từ, lộ trình, bài học, từ vựng..."
              aria-label="Tìm kiếm"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls="global-search-results"
              aria-activedescendant={items[active] ? `search-item-${active}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
            />
            {loading ? <span className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" aria-hidden="true" /> : null}
          </div>

          <div className="max-h-[calc(76vh-3.5rem)] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm font-semibold">Gõ ít nhất 2 ký tự. Di chuyển bằng ↑ ↓, Enter để mở.</p>
            ) : (
              <ul id="global-search-results" ref={listRef} role="listbox" aria-label="Kết quả">
                {items.map((item, index) => {
                  const header = item.group !== items[index - 1]?.group ? item.group : null;
                  return (
                    <li key={item.key} role="presentation">
                      {header ? <p className="text-muted-foreground px-3 pt-3 pb-1 text-xs font-extrabold tracking-wide uppercase">{header}</p> : null}
                      <button
                        type="button"
                        id={`search-item-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left", index === active ? "bg-primary/10" : "hover:bg-muted")}
                      >
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", index === active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <item.icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{item.title}</span>
                          <span className="text-muted-foreground block truncate text-xs font-bold">{item.detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!loading && items.length <= 1 ? (
                  <li role="presentation" className="text-muted-foreground px-3 py-4 text-center text-sm font-semibold">Không thấy bộ từ hay bài học nào khớp.</li>
                ) : null}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
