import { parseArgs } from "node:util";
import { createAdminClient } from "../src/lib/supabase/admin";

/**
 * Prints LLM token usage by feature and model for the last N days (default 7), largest first,
 * to show where AI cost goes. Multiply by each provider's per-token price for an estimate.
 *
 *   pnpm ai:usage            last 7 days
 *   pnpm ai:usage --days 30
 */
async function main() {
  const { values } = parseArgs({ options: { days: { type: "string", default: "7" } } });
  const days = Math.max(1, Number(values.days) || 7);
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Configure Supabase (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  type Row = { feature: string; model: string; input_tokens: number; cached_input_tokens: number; output_tokens: number };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await supabase.from("ai_token_usage")
      .select("feature, model, input_tokens, cached_input_tokens, output_tokens")
      .gte("created_at", since).order("id").range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    rows.push(...page.data);
    if (page.data.length < 1000) break;
  }
  if (!rows.length) {
    console.log(`No AI calls recorded in the last ${days} day(s).`);
    return;
  }

  const groups = new Map<string, { feature: string; model: string; calls: number; input: number; cached: number; output: number }>();
  for (const row of rows) {
    const key = `${row.feature}\u0000${row.model}`;
    const group = groups.get(key) ?? { feature: row.feature, model: row.model, calls: 0, input: 0, cached: 0, output: 0 };
    group.calls += 1;
    group.input += row.input_tokens;
    group.cached += row.cached_input_tokens;
    group.output += row.output_tokens;
    groups.set(key, group);
  }
  const total = rows.reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
  const sorted = [...groups.values()].sort((a, b) => (b.input + b.output) - (a.input + a.output));

  console.log(`LLM token usage, last ${days} day(s): ${rows.length} calls, ${total.toLocaleString("en-US")} tokens\n`);
  console.table(sorted.map((g) => ({
    feature: g.feature,
    model: g.model,
    calls: g.calls,
    "input tokens": g.input,
    "cached input": g.cached,
    "output tokens": g.output,
    "avg tokens/call": Math.round((g.input + g.output) / g.calls),
    share: `${(((g.input + g.output) / total) * 100).toFixed(1)}%`,
  })));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
