// src/routes/api/upload-chunk/+server.ts
// PURPOSE:
// - Receive small binary audio chunks and append to a temp file.
// - When the final chunk is received (last=1), assemble and call transcribeAudio(Buffer).
// - Return JSON with transcript or clear error info.
//
// NOTES:
// - Each upload request must include ?key=<string> to identify the file assembly.
// - Each request should include query params: index (0-based) and last (0 or 1).
// - This endpoint expects the request body to be the raw chunk bytes (Content-Type: application/octet-stream).

import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { transcribeAudio } from "$lib/ai";

const ASSEMBLE_DIR = path.join(os.tmpdir(), "relish_audio_assemblies");

async function ensureDir() {
  try {
    await fs.mkdir(ASSEMBLE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export const POST: RequestHandler = async ({ request, url }) => {
  const key = url.searchParams.get("key");
  const indexStr = url.searchParams.get("index") ?? "0";
  const lastStr = url.searchParams.get("last") ?? "0";

  if (!key) {
    return json({ error: "Missing key param" }, { status: 400 });
  }

  const index = parseInt(indexStr, 10);
  const last = lastStr === "1" || lastStr === "true";

  // Read raw request body as ArrayBuffer
  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (err: any) {
    console.error("[upload-chunk] failed to read body", err);
    return json({ error: "Failed to read request body", message: err?.message }, { status: 400 });
  }

  const bytes = Buffer.from(buffer);
  const tmpFilePath = path.join(ASSEMBLE_DIR, `${key}.part`);

  await ensureDir();

  try {
    // Append chunk bytes to the partial file
    await fs.appendFile(tmpFilePath, bytes);
    console.log(`[upload-chunk] appended key=${key} index=${index} bytes=${bytes.length}`);
  } catch (err: any) {
    console.error("[upload-chunk] append failed", err);
    return json({ error: "Failed to append chunk", message: err?.message }, { status: 500 });
  }

  if (!last) {
    // Not the final chunk - return success for this chunk
    return json({ ok: true, appended: bytes.length });
  }

  // Final chunk received - assemble and transcribe
  try {
    // Read full assembled bytes into a Buffer
    const assembled = await fs.readFile(tmpFilePath);
    console.log(`[upload-chunk] final assemble key=${key} totalBytes=${assembled.length}`);

    if (!assembled.length) {
      return json({ error: "Assembled file is empty" }, { status: 400 });
    }

    // IMPORTANT: call transcribeAudio with a Buffer so ai.ts turns it into a Blob
    // and appends a Blob to FormData - this avoids passing Node streams into FormData.
    const transcript = await transcribeAudio(assembled);

    // Clean up assembled temp file
    try {
      await fs.unlink(tmpFilePath).catch(() => {});
    } catch {}

    return json({ transcript });
  } catch (err: any) {
    console.error("[upload-chunk] final assemble/transcribe error", err);
    // Keep the tmp file for debugging - return a clear error payload
    return json({ error: "Failed to assemble/transcribe", message: err?.message }, { status: 500 });
  }
};
