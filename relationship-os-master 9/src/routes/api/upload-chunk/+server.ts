// src/routes/api/upload-chunk/+server.ts
// PURPOSE:
// - Accept audio chunks (Content-Type: application/octet-stream)
// - Append to a temp .part file identified by ?key=...
// - On the last chunk (?last=1) enqueue an async transcription job and return { jobId } immediately
// - Client polls /api/transcribe-result for completion
//
// LOGGING:
// - All console logs are safe: only print lengths, IDs, and messages (never full objects)
// - Set DEBUG_AUDIO to true to trace the full flow

import type { RequestHandler } from "./$types";
import { json, redirect } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Toggle detailed logs
const DEBUG_AUDIO = true;

// Job store in memory (per instance only)
type Job = {
  status: "queued" | "processing" | "done" | "error";
  transcript?: string;
  error?: string;
};
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

export const POST: RequestHandler = async ({ request, url, locals }) => {
  // Require login for uploads
  if (!locals.user) throw redirect(303, "/auth/login");

  if (DEBUG_AUDIO) console.log("[upload-chunk] handler entered");

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
    const contentType = request.headers.get("content-type") || "unknown";

    // Read raw bytes
    let ab: ArrayBuffer;
    try {
      ab = await request.arrayBuffer();
      if (DEBUG_AUDIO) {
        console.log("[upload-chunk] read body ok", {
          key,
          index,
          last,
          contentType,
          byteLength: ab.byteLength
        });
      }
    } catch (err: any) {
      console.error("[upload-chunk] arrayBuffer failed:", err?.message);
      return json({ error: "Failed to read body", message: err?.message }, { status: 400 });
    }
    const bytes = Buffer.from(ab);

    await ensureDir();
    const tmpFilePath = path.join(ASSEMBLE_DIR, `${key}.part`);

    try {
      await fs.appendFile(tmpFilePath, bytes);
      if (DEBUG_AUDIO) {
        console.log("[upload-chunk] appended chunk", {
          key,
          index,
          last,
          appended: bytes.length,
          file: tmpFilePath
        });
      }
    } catch (err: any) {
      console.error("[upload-chunk] appendFile failed:", err?.message);
      return json({ error: "Failed to append chunk", message: err?.message }, { status: 500 });
    }

    if (!last) {
      if (DEBUG_AUDIO) console.log("[upload-chunk] not last chunk - returning ok", { key, index });
      return json({ ok: true, appended: bytes.length });
    }

    if (DEBUG_AUDIO) console.log("[upload-chunk] last chunk received - enqueue job");

    const jobId = uuidv4();
    jobs.set(jobId, { status: "queued" });

    // Fire-and-forget background worker
    void (async () => {
      try {
        jobs.set(jobId, { status: "processing" });

        const assembled = await fs.readFile(tmpFilePath);
        if (DEBUG_AUDIO) {
          console.log("[upload-chunk] worker assembled file", {
            key,
            jobId,
            length: assembled.length
          });
        }

        // Import your speech to text helper
        const { transcribeAudio } = await import("$lib/ai");

        if (DEBUG_AUDIO) console.log("[upload-chunk] start transcribe", { jobId });

        // Call the transcriber - it should accept a Buffer and return a string
        const text = await transcribeAudio(assembled);

        if (DEBUG_AUDIO) {
          console.log("[upload-chunk] transcribe ok", {
            jobId,
            chars: text?.length ?? 0
          });
        }

        jobs.set(jobId, { status: "done", transcript: text || "" });

        // Clean up the assembled temp file
        await fs.unlink(tmpFilePath).catch(() => {});
      } catch (err: any) {
        console.error("[upload-chunk] worker error:", err?.message || String(err));
        jobs.set(jobId, { status: "error", error: err?.message || "Transcription failed" });
        // Attempt cleanup but do not fail on it
        await fs.unlink(tmpFilePath).catch(() => {});
      }
    })();

    // Return the job id so the client can poll /api/transcribe-result?jobId=...
    return json({ jobId }, { status: 202 });
  } catch (err: any) {
    console.error("[upload-chunk] unhandled error:", err?.message);
    return json({ error: "Internal error", message: err?.message || String(err) }, { status: 500 });
  }
};
