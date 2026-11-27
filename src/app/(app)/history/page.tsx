import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lịch sử học AI" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-black">Lịch sử học AI</h1>
      <Link className="font-bold underline" href="/speaking/history">Lịch sử phát âm</Link>
      <Suspense fallback={<LogoLoader label="Đang tải lịch sử" />}><Recent /></Suspense>
    </div>
  );
}

async function Recent() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=%2Fhistory");
  const [grammar, reading, calls] = await Promise.all([
    db.from("grammar_attempts").select("id,set_id,prompt,answer,score").eq("user_id", user.id).lt("score", 100)
      .order("created_at", { ascending: false }).limit(20),
    db.from("reading_passages").select("id,set_id,level,content").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20),
    db.from("chat_threads").select("id,set_id,scenario,summary,chat_messages(id,role,content,created_at)").eq("user_id", user.id)
      .order("created_at", { ascending: false }).order("created_at", { referencedTable: "chat_messages" }).limit(20),
  ]);
  const panel = "space-y-3 rounded-3xl border-2 bg-card p-5";
  return (
    <>
      <section className={panel}>
        <h2 className="text-xl font-extrabold">Câu ngữ pháp cần ôn</h2>
        {grammar.error ? <p role="alert">Không tải được câu đã luyện.</p> : !grammar.data.length ? <p>Chưa có câu cần ôn.</p> : (
          <ul className="space-y-3">{grammar.data.map((row) => (
            <li key={row.id} className="border-t pt-3">
              <p className="font-bold">{row.prompt} · {row.score}%</p>
              <p lang="en">{row.answer}</p>
              <Link className="underline" href={`/study/${row.set_id}/grammar`}>Ôn câu sai trong bộ</Link>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-extrabold">Bài đọc</h2>
        {reading.error ? <p role="alert">Không tải được bài đọc.</p> : !reading.data.length ? <p>Chưa có bài đọc.</p> : (
          <ul className="space-y-3">{reading.data.map((row) => (
            <li key={row.id} className="border-t pt-3">
              <details><summary className="cursor-pointer font-bold">{row.level} · {row.content.slice(0, 72)}…</summary>
                <p lang="en" className="mt-2 whitespace-pre-wrap">{row.content}</p>
              </details>
              <Link className="underline" href={`/study/${row.set_id}/reading`}>Đọc tiếp với bộ từ</Link>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-extrabold">Hội thoại</h2>
        {calls.error ? <p role="alert">Không tải được hội thoại.</p> : !calls.data.length ? <p>Chưa có hội thoại.</p> : (
          <ul className="space-y-3">{calls.data.map((row) => (
            <li key={row.id} className="border-t pt-3">
              <details>
                <summary className="cursor-pointer font-bold">{row.scenario} · {row.summary ? "Đã tổng kết" : "Chưa tổng kết"}</summary>
                <ol className="my-2 space-y-2">{row.chat_messages.map((message) => (
                  <li key={message.id}><strong>{message.role === "user" ? "Bạn" : "AI"}:</strong> <span lang="en">{message.content}</span></li>
                ))}</ol>
              </details>
              <Link className="underline" href={`/study/${row.set_id}/call`}>Luyện hội thoại với bộ từ</Link>
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
