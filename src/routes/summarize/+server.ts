// src/routes/api/summarize/+server.ts
// PURPOSE: Accept text and return summary + tag suggestions.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { summarizeText } from "$lib/ai";

export const POST: RequestHandler = async ({ request }) => {
  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return json({ error: "Missing text" }, { status: 400 });
  }

  try {
    const { summary, tags } = await summarizeText(text);
    return json({ summary, tags });
  } catch (err: any) {
    console.error("Summarization failed:", err);
    return json({ error: "Failed to summarize" }, { status: 500 });
  }
};
