import { transcriptionCorrelationId, transcriptionEvent } from '$lib/server/transcriptionDiagnostics';
// src/routes/api/transcribe/+server.ts
// PURPOSE: Accept a voice recording (webm/mp4/etc) and return transcript.
// ENHANCEMENTS: Log file size/type, return structured JSON errors, check size limits.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { transcribeAudio } from "$lib/ai";

export const POST: RequestHandler = async ({ request }) => {
  const correlationId = transcriptionCorrelationId(request.headers.get('x-transcription-id'));
  const data = await request.formData();
  const file = data.get("file");

  // Validate uploaded shape early and return a JSON error if missing.
  if (!(file instanceof File)) {
    transcriptionEvent('upload.rejected', correlationId, { errorCategory: 'input' }, true);
    return json({ error: "No audio file uploaded" }, { status: 400 });
  }

  // Log type and size for diagnostics.
  const size = typeof file.size === "number" ? file.size : null;
  const type = (file as any).type || "unknown";
  transcriptionEvent('upload.received', correlationId, { audioBytes: size, mimeType: type });

  // Practical Whisper limit - check early and return 413 to avoid wasted work.
  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
  if (typeof size === "number" && size > MAX_BYTES) {
    transcriptionEvent('upload.rejected', correlationId, { errorCategory: 'input' }, true);
    return json({ error: "Audio too large. Please keep recordings under ~25 MB." }, { status: 413 });
  }

  try {
    // Call into your lib helper that uploads to OpenAI Whisper.
    const transcript = await transcribeAudio(file, undefined, { correlationId });

    // Normal success path.
    transcriptionEvent('direct.result', correlationId, { characterCount: transcript.length, emptyContent: !transcript.length });
    return json({ transcript, correlationId });
  } catch (err: any) {
    // Keep the legacy failure response, but never expose/log provider bodies.
    transcriptionEvent('job.error', correlationId, { errorCategory: 'processing' }, true);

    return json({ error: "Failed to transcribe", correlationId }, { status: 500 });
  }
};
