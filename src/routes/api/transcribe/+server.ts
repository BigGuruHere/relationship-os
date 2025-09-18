// src/routes/api/transcribe/+server.ts
// PURPOSE: Accept a voice recording (webm/mp4/etc) and return transcript.
// ENHANCEMENTS: Log file size/type, return structured JSON errors, check size limits.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { transcribeAudio } from "$lib/ai";

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const file = data.get("file");

  // Validate uploaded shape early and return a JSON error if missing.
  if (!(file instanceof File)) {
    console.error("[transcribe] no file provided in formData");
    return json({ error: "No audio file uploaded" }, { status: 400 });
  }

  // Log type and size for diagnostics.
  const size = typeof file.size === "number" ? file.size : null;
  const type = (file as any).type || "unknown";
  console.log("[transcribe] received file", { type, size });

  // Practical Whisper limit - check early and return 413 to avoid wasted work.
  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
  if (typeof size === "number" && size > MAX_BYTES) {
    console.warn("[transcribe] file too large", { size });
    return json({ error: "Audio too large. Please keep recordings under ~25 MB." }, { status: 413 });
  }

  try {
    // Call into your lib helper that uploads to OpenAI Whisper.
    const transcript = await transcribeAudio(file);

    // Normal success path.
    return json({ transcript });
  } catch (err: any) {
    // Log full error server-side for Railway logs.
    console.error("[transcribe] transcription failed - error:", err);

    // If the helper attached any extra payload (for example response body), include it.
    // Keep payload small but useful for debugging.
    const details = {
      message: err?.message ?? "unknown error",
      // Some libraries attach responseText or body - include if present
      responseText: err?.responseText ? String(err.responseText).slice(0, 2000) : undefined
    };

    // Return a structured JSON error so the client sees why it failed.
    return json({ error: "Failed to transcribe", details }, { status: 500 });
  }
};
