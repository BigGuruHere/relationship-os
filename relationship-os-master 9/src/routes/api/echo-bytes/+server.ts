// src/routes/api/echo-bytes/+server.ts
// PURPOSE: Accept a raw POST body and echo its size - used by the recorder probe.
// SECURITY: Requires login so randoms cannot spam your server.

import type { RequestHandler } from './$types';
import { json, redirect } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
  // require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // read raw bytes - recorder sends application/octet-stream
  const buf = Buffer.from(await request.arrayBuffer());

  // return minimal metadata - do not echo content
  return json({ ok: true, bytes: buf.length });
};
