import "server-only";

/**
 * Reads a request body with a hard byte cap, honouring abort. Throws RangeError
 * when the body exceeds `maxBytes`; returns null when there is no body.
 */
export async function readBoundedBody(request: Request, maxBytes: number, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        cancel();
        throw new RangeError("Oversize upload");
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Parses a multipart body read via readBoundedBody into FormData. */
export async function parseMultipart(bytes: Uint8Array, contentType: string): Promise<FormData | null> {
  // Copy into a plain ArrayBuffer-backed view: Uint8Array<ArrayBufferLike> is not BodyInit.
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body, { headers: { "content-type": contentType } }).formData().catch(() => null);
}
