// src/routes/api/echo-upload/+server.ts
// PURPOSE: Diagnostic endpoint - returns the uploaded file type and size as JSON.
// USAGE: POST a FormData with `file` field to /api/echo-upload

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const file = data.get("file");

  if (!(file instanceof File)) {
    console.error("[echo-upload] no file uploaded");
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  const type = (file as any).type || "unknown";
  const size = typeof file.size === "number" ? file.size : null;

  console.log("[echo-upload] got file", { type, size });

  return json({ type, size });
};
