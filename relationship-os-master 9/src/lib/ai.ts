// src/lib/ai.ts
// PURPOSE:
// - Provide AI helpers for transcription and summarization.
// - Make transcribeAudio Node-friendly so it accepts a file path or Buffer or browser File/Blob.
// NOTES:
// - This file uses fetch + FormData so it works both in browser and Node 18+/22+ runtimes.
// - Ensure process.env.OPENAI_API_KEY is set in Railway / local env.

import fs from "fs";
import path from "path";

// Keep runtime-safe checks - in Node 18+/22+ fetch and FormData are available globally.
// If you run into environment issues, ensure Node is >=18 and the global fetch/FormData are present.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
if (!OPENAI_API_KEY) {
  // Log a warning but do not throw - calling functions will fail with clearer errors.
  console.warn("OPENAI_API_KEY not set - AI features will fail until configured.");
}

/**
 * Transcribe audio using OpenAI Whisper endpoint.
 * Accepts:
 *  - Browser File or Blob
 *  - Node Buffer
 *  - Node file path (string)
 *
 * Returns the raw transcription text on success, or throws an Error.
 */
export async function transcribeAudio(input: File | Blob | Buffer | string): Promise<string> {
  // Build a FormData body appropriate for the runtime:
  // - In browser: File/Blob can be appended directly.
  // - In Node: append a stream (fs.createReadStream) or a Buffer/Blob.
  const fd = new FormData();

  // Determine how to append the file to FormData.
  if (typeof input === "string") {
    // treat as file path
    const resolved = path.resolve(input);
    // use createReadStream so Node FormData can send it as a file upload
    const stream = fs.createReadStream(resolved);
    // provide a filename so the server (OpenAI) can detect type if needed
    fd.append("file", stream, path.basename(resolved));
  } else if (Buffer.isBuffer(input)) {
    // Node Buffer - wrap in a Blob (Node supports Blob) or pass Buffer directly
    // Using Blob gives a filename and type information to FormData.
    // Default to webm container - caller may tune this if needed.
    const blob = new Blob([input], { type: "audio/webm" });
    // In Node, FormData.append accepts Blob
    fd.append("file", blob, "audio.webm");
  } else {
    // Browser File or Blob - append directly.
    // If input is a File it should already have a name and type.
    // If input is a Blob without a name, give it a default name.
    try {
      // Cast for TypeScript - runtime will be fine.
      const fileLike = input as any;
      const filename = fileLike?.name ?? "audio.webm";
      fd.append("file", input as Blob, filename);
    } catch (err) {
      throw new Error("Unsupported input type for transcription");
    }
  }

  // Add required fields for Whisper
  fd.append("model", "whisper-1");
  // We prefer text output on the route side so we can parse it easily.
  // You may switch to 'srt' or other formats if you need timecodes.
  fd.append("response_format", "text");

  // Build fetch options - do not set Content-Type, let FormData set it
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
      // NOTE: do not set Content-Type here; the runtime FormData sets the multipart boundary.
    },
    body: fd as any
  });

  // Non-2xx handling
  if (!res.ok) {
    // Attempt to extract a useful message from the body
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {}
    const err = new Error(`OpenAI transcription failed: ${res.status} ${res.statusText} - ${bodyText}`);
    // Attach response text for server-side logs
    (err as any).responseText = bodyText;
    console.error("[transcribeAudio] error", res.status, res.statusText, { responseText: bodyText });
    throw err;
  }

  // Whisper / transcriptions endpoint returns the raw text body when response_format=text
  const text = await res.text();
  return text.trim();
}

/**
 * Summarize text and return structured summary + tags.
 * Returns { summary: string, tags: string[] }.
 *
 * The assistant is asked to output strict JSON. We attempt to parse it and fall back to heuristics.
 */
export async function summarizeText(text: string): Promise<{ summary: string; tags: string[] }> {
  if (!text || typeof text !== "string") {
    return { summary: "", tags: [] };
  }

  // Build messages instructing the assistant to return strict JSON.
  const system = [
    {
      role: "system",
      content:
        "You are a CRM assistant. Summarize the user note in 3-5 short bullet points. " +
        "Then extract 3-6 concise tags (topics, roles, industries). " +
        'Return strict JSON with the shape {"summary": string, "tags": string[]}.'
    }
  ];

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      ...system,
      { role: "user", content: text }
    ],
    max_tokens: 500,
    temperature: 0.2
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    let bodyText = "";
    try {
      bodyText = await resp.text();
    } catch {}
    console.error("[summarizeText] OpenAI chat failed", resp.status, resp.statusText, { bodyText });
    throw new Error(`OpenAI chat failed: ${resp.status} ${resp.statusText}`);
  }

  const result = await resp.json().catch(() => ({} as any));
  // The assistant text may be in result.choices[0].message.content
  const assistantText = result?.choices?.[0]?.message?.content ?? "";

  if (!assistantText) return { summary: "", tags: [] };

  // Try parsing JSON strictly. If parsing fails, return the raw assistant text as summary.
  try {
    const parsed = JSON.parse(assistantText);
    const summary = typeof parsed.summary === "string" ? parsed.summary : String(parsed.summary || "");
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string")
      : [];
    return { summary, tags };
  } catch {
    // Fallback: use the assistantText as summary, empty tags
    return { summary: assistantText.trim(), tags: [] };
  }
}
