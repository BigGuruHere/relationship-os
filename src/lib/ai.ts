// src/lib/ai.ts
// PURPOSE: Wrap OpenAI API calls for transcription and summarization.
// SECURITY: Do not log PII. Only send decrypted text/audio blobs you explicitly approve.

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Transcribe audio blob (WebM, Opus)
export async function transcribeAudio(file: File) {
  const resp = await client.audio.transcriptions.create({
    file,
    model: "whisper-1", // OpenAI Whisper
    response_format: "text",
  });
  return resp as unknown as string; // Whisper returns plain text
}

// Summarize + extract tags
export async function summarizeText(raw: string) {
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a CRM assistant. Summarize the user’s note in 3–5 short bullet points. Then extract 3–6 concise tags (topics, roles, industries). Output JSON: {summary: string, tags: string[]}",
      },
      { role: "user", content: raw },
    ],
    response_format: { type: "json_object" },
  });

  const msg = resp.choices[0].message?.content;
  if (!msg) return { summary: "", tags: [] };
  try {
    const parsed = JSON.parse(msg);
    return {
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { summary: msg, tags: [] };
  }
}
