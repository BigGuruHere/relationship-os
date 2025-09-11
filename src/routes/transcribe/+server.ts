// src/routes/api/transcribe/+server.ts
// PURPOSE: Accept a voice recording (webm) and return transcript.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { transcribeAudio } from "$lib/ai";

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File)) {
    return json({ error: "No audio file uploaded" }, { status: 400 });
  }

  try {
    const transcript = await transcribeAudio(file);
    return json({ transcript });
  } catch (err: any) {
    console.error("Transcription failed:", err);
    return json({ error: "Failed to transcribe" }, { status: 500 });
  }
};
