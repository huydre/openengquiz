import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { WorksheetDocument } from "@/lib/study/worksheet-document";
import type { StudyCard } from "@/lib/study/study-types";

export async function GET(_request: Request, { params }: RouteContext<"/api/worksheet/[setId]">) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { data: set } = await supabase.from("study_sets")
    .select("id, title").eq("id", setId).maybeSingle();
  if (!set) return Response.json({ error: "Không tìm thấy bộ từ." }, { status: 404 });
  const { data: cards, error } = await supabase.from("cards")
    .select("id, term, definition_vi, definition_en, example_en")
    .eq("set_id", setId).order("position").order("created_at").order("id");
  if (error || !cards?.length) {
    return Response.json({ error: "Bộ từ chưa có thẻ." }, { status: 400 });
  }
  try {
    const buffer = await renderToBuffer(
      createElement(WorksheetDocument, { title: set.title, cards: cards as StudyCard[] }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="openengquiz-${set.id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Không tạo được PDF." }, { status: 500 });
  }
}
