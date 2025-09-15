// src/routes/api/transcribe/+server.ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { transcribeAudio } from "$lib/ai";

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File)) {
    return json({ error: "No audio file uploaded" }, { status: 400 });
  }

  // Basic guard and visibility during dev
  const size = typeof file.size === "number" ? file.size : -1;
  const type = (file as any).type || "unknown";
  console.log("[transcribe] received file", { type, size });

  // 25 MB is the practical Whisper limit
  const MAX_BYTES = 25 * 1024 * 1024;
  if (size > MAX_BYTES) {
    return json({ error: "Audio too large - keep under ~25 MB" }, { status: 413 });
  }

  try {
    const transcript = await transcribeAudio(file);
    return json({ transcript });
  } catch (err: any) {
    console.error("Transcription failed:", err);
    return json({ error: "Failed to transcribe" }, { status: 500 });
  }
};
