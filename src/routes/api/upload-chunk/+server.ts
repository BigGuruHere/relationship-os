// src/routes/api/upload-chunk/+server.ts
// PURPOSE:
// - Accept audio chunks (Content-Type: application/octet-stream)
// - Append to a temp .part file identified by ?key=...
// - On the last chunk (?last=1) enqueue an async transcription job and return { jobId } immediately
// - Client polls /api/transcribe-result for completion
//
// LOGGING:
// - All console logs are safe: only print lengths, IDs, and messages (never full objects)

import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Job store in memory (per instance only)
type Job = { status: "queued" | "processing" | "done" | "error"; transcript?: string; error?: string };
const jobs = new Map<string, Job>();

// Exported so /api/transcribe-result can read job state
export function _getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

// Minimal uuid v4
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Temp dir for chunk assembly
const ASSEMBLE_DIR = path.join(os.tmpdir(), "relish_audio_assemblies");
async function ensureDir() {
  await fs.mkdir(ASSEMBLE_DIR, { recursive: true }).catch(() => {});
}

export const POST: RequestHandler = async ({ request, url }) => {
  console.log("[upload-chunk] handler entered");

  try {
    const key = url.searchParams.get("key");
    const indexStr = url.searchParams.get("index") ?? "0";
    const lastStr = url.searchParams.get("last") ?? "0";

    if (!key) {
      console.error("[upload-chunk] missing key");
      return json({ error: "Missing key param" }, { status: 400 });
    }

    const index = Number.parseInt(indexStr, 10) || 0;
    const last = lastStr === "1" || lastStr === "true";

    // Read raw bytes
    let ab: ArrayBuffer;
    try {
      ab = await request.arrayBuffer();
      console.log(`[upload-chunk] got arrayBuffer length=${ab.byteLength}`);
    } catch (err: any) {
      console.error("[upload-chunk] arrayBuffer failed:", err?.message);
      return json({ error: "Failed to read body", message: err?.message }, { status: 400 });
    }
    const bytes = Buffer.from(ab);

    await ensureDir();
    const tmpFilePath = path.join(ASSEMBLE_DIR, `${key}.part`);

    try {
      await fs.appendFile(tmpFilePath, bytes);
      console.log(`[upload-chunk] appended ${bytes.length} bytes to ${tmpFilePath}`);
    } catch (err: any) {
      console.error("[upload-chunk] appendFile failed:", err?.message);
      return json({ error: "Failed to append chunk", message: err?.message }, { status: 500 });
    }

    if (!last) {
      console.log(`[upload-chunk] chunk index=${index} complete (not last)`);
      return json({ ok: true, appended: bytes.length });
    }

    console.log("[upload-chunk] last chunk received, enqueueing job");

    const jobId = uuidv4();
    jobs.set(jobId, { status: "queued" });

    // Fire-and-forget background worker
    void (async () => {
      try {
        jobs.set(jobId, { status: "processing" });
        const assembled = await fs.readFile(tmpFilePath);
        console.log(`[upload-chunk] worker assembled file length=${assembled.length}`);

        const { transcribeAudio } = await import("$lib/ai");
        const text = await transcribeAudio(assembled);
        console.log(`[upload-chunk] transcription done, chars=${text.length}`);

        jobs.set(jobId, { status: "done", transcript: text });
        await fs.unlink(tmpFilePath).catch(() => {});
      } catch (err: any) {
        console.error("[upload-chunk] worker error:", err?.message);
        jobs.set(jobId, { status: "error", error: err?.message || "Transcription failed" });
      }
    })();

    return json({ jobId }, { status: 202 });
  } catch (err: any) {
    console.error("[upload-chunk] unhandled error:", err?.message);
    return json({ error: "Internal error", message: err?.message || String(err) }, { status: 500 });
  }
};
