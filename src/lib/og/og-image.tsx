import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/site-url";

/** Social preview size used by Facebook, Zalo, Messenger and X. */
export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#26303d";
const MUTED = "#5d6878";
const LIME = "#72c700";
const LIME_EDGE = "#5a9e00";
const SKY = "#3d9be0";

async function fonts() {
  const dir = path.join(process.cwd(), "public/fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "BeVietnamPro-Regular.ttf")),
    readFile(path.join(dir, "BeVietnamPro-Bold.ttf")),
  ]);
  return [
    { name: "Be Vietnam Pro", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Be Vietnam Pro", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

const GLYPH = (
  <>
    <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
  </>
);

/** The app mark: white translate glyph on the lime tile with its darker bottom edge. */
function Mark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size * 0.26, background: LIME_EDGE }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size * 0.9, borderRadius: size * 0.26, background: LIME }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{GLYPH}</svg>
      </div>
    </div>
  );
}

/** A vocabulary card like the app's: part of speech, the word, its meaning and a speaker button. */
function WordCard({ term, meaning, label, badge = false }: { term: string; meaning?: string; label: string; badge?: boolean }) {
  const long = term.length > 14;
  return (
    <div style={{ display: "flex", position: "relative", width: 400, height: 430 }}>
      <div style={{ position: "absolute", top: 34, left: 34, width: 360, height: 380, borderRadius: 40, background: "#d8ecfb", border: "4px solid #b8dcf6", transform: "rotate(8deg)", display: "flex" }} />
      <div style={{ position: "absolute", top: 26, left: 6, width: 360, height: 380, borderRadius: 40, background: "#fdecd5", border: "4px solid #f7d5a8", transform: "rotate(-6deg)", display: "flex" }} />
      <div style={{ position: "absolute", top: 10, left: 20, width: 360, height: 392, borderRadius: 40, background: "#e1e6ec", display: "flex" }} />
      <div style={{ position: "absolute", top: 0, left: 20, width: 360, height: 384, borderRadius: 40, background: "#ffffff", border: "4px solid #e1e6ec", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: SKY, background: "#e4f2fc", borderRadius: 999, padding: "6px 18px" }}>{label}</div>
        <div style={{ display: "flex", fontSize: long ? 40 : 56, fontWeight: 700, color: INK, marginTop: 26, textAlign: "center", lineHeight: 1.1 }}>{term}</div>
        {meaning ? <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 16, textAlign: "center", lineHeight: 1.3 }}>{meaning}</div> : null}
        <div style={{ display: "flex", width: 84, height: 84, borderRadius: 999, background: "#2f7fc0", marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 84, height: 78, borderRadius: 999, background: SKY }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z" />
              <path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.4 18.4a9 9 0 0 0 0-12.8" />
            </svg>
          </div>
        </div>
      </div>
      {badge ? <div style={{ position: "absolute", top: 300, left: -70, display: "flex", alignItems: "center", gap: 14, background: "#ffffff", border: "4px solid #e1e6ec", borderRadius: 26, padding: "14px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 50, height: 50, borderRadius: 16, background: "#e8f6d2" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={LIME_EDGE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: MUTED }}>Phát âm</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: INK }}>92/100</div>
        </div>
      </div> : null}
    </div>
  );
}

/** Chips that fit beside the card stack: stop once their combined length would overflow. */
function fittingChips(chips: string[], budget = 34) {
  const kept: string[] = [];
  let used = 0;
  for (const chip of chips) {
    if (used + chip.length > budget) break;
    kept.push(chip);
    used += chip.length + 4;
  }
  return kept;
}

/**
 * 1200x630 link preview: brand bar, a large title with subtitle and chips on the left, and a
 * vocabulary card stack on the right, on a soft lime and sky backdrop.
 */
export async function renderOgImage({ eyebrow, title, highlight, subtitle, chips = [], card }: {
  eyebrow: string;
  title: string;
  /** A word of the title drawn in the brand green. */
  highlight?: string;
  subtitle: string;
  chips?: string[];
  card: { term: string; meaning?: string; label: string; badge?: boolean };
}) {
  const words = title.split(" ");
  const host = new URL(siteUrl()).host;
  return new ImageResponse(
    (
      <div style={{
        display: "flex", width: "100%", height: "100%", fontFamily: "Be Vietnam Pro", padding: "56px 64px",
        backgroundColor: "#fbfdf6",
        backgroundImage: "radial-gradient(circle at 88% 12%, #dff3bd 0%, rgba(223,243,189,0) 42%), radial-gradient(circle at 6% 100%, #d9ecfb 0%, rgba(217,236,251,0) 40%)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark size={68} />
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: LIME_EDGE }}>OpenEngQuiz</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignSelf: "flex-start", fontSize: 24, fontWeight: 700, color: LIME_EDGE, background: "#e8f6d2", borderRadius: 999, padding: "8px 22px" }}>{eyebrow}</div>
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: title.length > 26 ? 58 : 76, fontWeight: 700, color: INK, lineHeight: 1.08, marginTop: 22, letterSpacing: -1.5 }}>
              {words.map((word, index) => (
                <span key={index} style={{ color: highlight && word.replace(/[^\p{L}]/gu, "") === highlight ? LIME : INK, marginRight: index < words.length - 1 ? 18 : 0 }}>{word}</span>
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 20, lineHeight: 1.4 }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              {fittingChips(chips).map((chip) => (
                <div key={chip} style={{ display: "flex", fontSize: 22, fontWeight: 700, color: INK, background: "#ffffff", border: "3px solid #e1e6ec", borderRadius: 18, padding: "9px 18px" }}>{chip}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", width: 420 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: MUTED }}>{host}</div>
          <WordCard {...card} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
