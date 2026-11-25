import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads a JSON body, refusing anything that isn't JSON or is larger than `maximum` bytes. */
export async function readJson(request: Request, maximum = 32_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Send JSON.");
  if (Number(request.headers.get("content-length")) > maximum) throw new HttpError(413, "The body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "The request is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new HttpError(413, "The body is too large.");
    }
    chunks.push(next.value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new HttpError(400, "The JSON is not valid.");
  }
}

/** A JSON error for the caller; unexpected errors are logged by name only. */
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "The request does not match the contract.",
        issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      },
      { status: 400 },
    );
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The request could not be completed. Try again shortly." }, { status: 503 });
}
