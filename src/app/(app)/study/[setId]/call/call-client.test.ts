import { describe, expect, it } from "vitest";
import { readCallReply, type CallStreamUpdate } from "./call-client";

function reply(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }));
}

describe("readCallReply", () => {
  it("emits split transcript and delta lines, then uses the persisted reply and chips", async () => {
    const updates: CallStreamUpdate[] = [];
    const result = await readCallReply(reply(
      '{"type":"trans',
      'cript","text":"I walk."}\n{"type":"delta","text":"Do you',
      ' walk?"}\n{"type":"done","text":"Do you often walk?","terms":["often"]}\n',
    ), (update) => updates.push(update));

    expect(updates).toEqual([{ type: "transcript", text: "I walk." }, { type: "delta", text: "Do you walk?" }]);
    expect(result).toEqual({ text: "Do you often walk?", terms: ["often"] });
  });

  it("does not confirm the turn on stale or truncated streams", async () => {
    const delta = '{"type":"delta","text":"Do you walk?"}\n';
    await expect(readCallReply(reply(delta, '{"type":"stale"}\n'), () => {})).rejects.toThrow("thay đổi ở nơi khác");
    await expect(readCallReply(reply(delta), () => {})).rejects.toThrow("Chưa xác nhận được lượt nói");
  });
});
