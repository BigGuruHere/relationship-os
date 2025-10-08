// src/routes/api/transcribe-result/+server.ts
// PURPOSE:
// - Return the status of a transcription job created by /api/upload-chunk.
// - Client polls this until status === "done" or "error".

import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getJob } from "../upload-chunk/+server";

export const GET: RequestHandler = async ({ url }) => {
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return json({ error: "Missing jobId" }, { status: 400 });

  const job = getJob(jobId);
  if (!job) return json({ status: "unknown" });

  if (job.status === "done") return json({ status: "done", transcript: job.transcript || "" });
  if (job.status === "error") return json({ status: "error", error: job.error || "Unknown error" });

  return json({ status: job.status });
};
