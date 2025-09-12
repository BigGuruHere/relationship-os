// src/lib/ai.ts
// PURPOSE: Call OpenAI REST endpoints via fetch to avoid SDK peer-dep issues.
// SECURITY: Do not log PII. Only send data you explicitly approve.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set - AI features will fail until configured.');
}

// Helper to call OpenAI REST with JSON
async function openaiJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${path} failed: ${res.status} ${errText}`);
  }
  return res.json() as Promise<T>;
}

// Transcribe audio blob (WebM Opus) using Whisper
export async function transcribeAudio(file: File) {
  // Basic guard to avoid giant uploads
  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
  if (typeof file.size === 'number' && file.size > MAX_BYTES) {
    throw new Error('Audio file too large. Please keep recordings under ~25 MB.');
  }

  const fd = new FormData();
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');
  // The field must be named "file"
  fd.append('file', file, file.name || 'audio.webm');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
      // Do not set Content-Type here - the browser sets multipart boundary
    },
    body: fd
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI transcription failed: ${res.status} ${errText}`);
  }

  // Whisper returns plain text when response_format is "text"
  const text = await res.text();
  return text;
}

// Summarize and extract tags for a note
export async function summarizeText(raw: string) {
  const text = raw.trim();

  type ChatResp = {
    choices: { message?: { content?: string } }[];
  };

  const resp = await openaiJson<ChatResp>('/chat/completions', {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content:
          'You are a CRM assistant. Summarize the user note in 3-5 short bullet points. ' +
          'Then extract 3-6 concise tags (topics, roles, industries). ' +
          'Return strict JSON with the shape {"summary": string, "tags": string[]}.'
      },
      { role: 'user', content: text }
    ]
  });

  const msg = resp.choices?.[0]?.message?.content ?? '';
  if (!msg) return { summary: '', tags: [] };

  try {
    const parsed = JSON.parse(msg);
    const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : [];
    return { summary, tags };
  } catch {
    return { summary: msg, tags: [] };
  }
}
