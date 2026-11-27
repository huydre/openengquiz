"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupResultSchema, type LookupResult } from "@/lib/vocab/lookup-term";
import { saveLookupCard, type SaveLookupState } from "./actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SetOption = { id: string; title: string };
const initialSaveState: SaveLookupState = { error: null };

export function LookupForm({ sets }: { sets: SetOption[] }) {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, saveAction, saving] = useActionState(saveLookupCard, initialSaveState);
  const pendingRequest = useRef<AbortController | null>(null);

  async function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch(`/api/lookup?term=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!body || typeof body !== "object") throw new Error("Phản hồi không hợp lệ.");
      const payload = body as { data?: unknown; error?: unknown };
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Chưa tra được từ.");
      }
      const parsed = lookupResultSchema.safeParse(payload.data);
      if (!parsed.success) throw new Error("Phản hồi không hợp lệ.");
      setResult(parsed.data);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Chưa tra được từ.");
    } finally {
      if (pendingRequest.current === controller) setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black">Tra từ</h1>
        <p className="mt-1 text-muted-foreground">Tìm nghĩa, ví dụ và lưu từ vào bộ của bạn.</p>
      </div>

      <form onSubmit={onLookup} className="flex gap-3">
        <label htmlFor="lookup-term" className="sr-only">Từ tiếng Anh</label>
        <Input
          id="lookup-term"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nhập từ tiếng Anh"
          maxLength={100}
          required
          className="h-11 rounded-2xl border-2 px-4"
        />
        <Button type="submit" disabled={loading}>{loading ? "Đang tra..." : "Tra từ"}</Button>
      </form>

      <div aria-live="polite">
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {result && (
          <article className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_var(--border)]">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-3xl font-black">{result.term}</h2>
              {result.ipa && <span className="text-muted-foreground">{result.ipa}</span>}
              {result.part_of_speech && <span className="rounded-full bg-secondary/20 px-3 py-1 text-sm">{result.part_of_speech}</span>}
            </div>
            <dl className="mt-5 space-y-4">
              {result.definition_vi && <div><dt className="font-bold">Nghĩa tiếng Việt</dt><dd>{result.definition_vi}</dd></div>}
              {result.definition_en && <div><dt className="font-bold">Nghĩa tiếng Anh</dt><dd>{result.definition_en}</dd></div>}
              {result.example_en && <div><dt className="font-bold">Ví dụ</dt><dd>{result.example_en}</dd>{result.example_vi && <dd className="text-muted-foreground">{result.example_vi}</dd>}</div>}
              {result.synonyms.length > 0 && <div><dt className="font-bold">Từ đồng nghĩa</dt><dd>{result.synonyms.join(", ")}</dd></div>}
            </dl>

            <div className="mt-6 border-t pt-5">
              {sets.length > 0 ? (
                <form action={saveAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="result" value={JSON.stringify(result)} />
                  <div className="min-w-48 flex-1">
                    <label htmlFor="lookup-set" className="mb-1 block text-sm font-bold">Lưu vào bộ</label>
                    <Select name="setId" required defaultValue={sets[0]?.id}>
                      <SelectTrigger id="lookup-set" className="w-full">
                        <SelectValue placeholder="Chọn bộ từ" />
                      </SelectTrigger>
                      <SelectContent>
                        {sets.map((set) => (
                          <SelectItem key={set.id} value={set.id}>{set.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu vào bộ"}</Button>
                </form>
              ) : (
                <Link href="/sets/new" className="font-bold text-primary underline">Tạo bộ từ để lưu từ này</Link>
              )}
              {saveState.error && <p role="alert" className="mt-3 text-destructive">{saveState.error}</p>}
              {saveState.savedSetId && saveState.savedTerm === result.term && (
                <p className="mt-3 text-primary">Đã lưu! <Link href={`/sets/${saveState.savedSetId}`} className="font-bold underline">Xem bộ từ</Link></p>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
