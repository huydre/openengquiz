export async function postCallJson<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Yêu cầu chưa thành công. Hãy thử lại.");
  return data;
}

export function cleanCallText(text: string) {
  return text.replace(/\s*\u2014\s*|\s+\u2013\s+/g, ", ");
}

export async function lookupCallMeaning(term: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`/api/lookup?term=${encodeURIComponent(term)}`, { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.error ?? "Chưa tra được nghĩa.");
  return payload.data?.definition_vi ?? payload.data?.definition_en ?? "Chưa có nghĩa cho từ này.";
}

export type CallStreamUpdate = { type: "transcript" | "delta"; text: string };
export async function readCallReply(response: Response, onEvent: (event: CallStreamUpdate) => void) {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Chưa gửi được lượt nói.");
  }
  if (!response.body) throw new Error("Không đọc được phản hồi.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line) as { type: string; text?: string; terms?: string[]; error?: string };
        if (event.type === "done" && event.text) return { text: event.text, terms: event.terms ?? [] };
        if (event.type === "stale") throw new Error("Cuộc gọi đã thay đổi ở nơi khác. Hãy tải lại trang.");
        if (event.type === "error") throw new Error(event.error ?? "Chưa tạo được câu trả lời.");
        if ((event.type === "transcript" || event.type === "delta") && event.text) onEvent({ type: event.type, text: event.text });
      }
    }
    throw new Error("Chưa xác nhận được lượt nói. Hãy tải lại trang để tiếp tục.");
  } finally {
    void reader.cancel().catch(() => {});
  }
}
