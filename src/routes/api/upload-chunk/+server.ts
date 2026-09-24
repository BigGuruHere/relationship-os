// src/routes/api/upload-chunk/+server.ts
// PURPOSE:
// - Accept audio chunks (Content-Type: application/octet-stream)
// - Append to a temp .part file identified by ?key=...
// - On the last chunk (?last=1) enqueue an async transcription job and return { jobId } immediately
// - Client polls /api/transcribe-result for completion
//
// LOGGING:
// - All console logs are safe: only print lengths, IDs, and messages (never full objects)
// - Set DEBUG_AUDIO to true to trace the full flow

import type { RequestHandler } from './$types';
import { json, redirect } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'node:crypto';

// Toggle detailed logs
const DEBUG_AUDIO = process.env.DEBUG_AUDIO === 'true';

// Job store in memory (per instance only)
type Job = {
	status: 'queued' | 'processing' | 'done' | 'error';
	userId: string;
	contextSpaceId: string;
	transcript?: string;
	error?: string;
};
const jobs = new Map<string, Job>();
const assemblies = new Map<
	string,
	{ userId: string; contextSpaceId: string; nextIndex: number; totalBytes: number }
>();
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const STALE_AUDIO_MS = 60 * 60 * 1000;

// Exported so /api/transcribe-result can read job state
export function _getJob(jobId: string, userId: string, contextSpaceId: string): Job | undefined {
	const job = jobs.get(jobId);
	// SECURITY: A transcript job belongs to the exact user and ContextSpace that uploaded it.
	if (!job || job.userId !== userId || job.contextSpaceId !== contextSpaceId) return undefined;
	// IT: Completed transcript text is returned once and then removed from process memory.
	if (job.status === 'done' || job.status === 'error') jobs.delete(jobId);
	return job;
}

// Temp dir for chunk assembly
const ASSEMBLE_DIR = path.join(os.tmpdir(), 'relish_audio_assemblies');
async function ensureDir() {
	await fs.mkdir(ASSEMBLE_DIR, { recursive: true }).catch(() => {});
}

async function cleanupStaleAudio() {
	// SECURITY: Best-effort cleanup prevents abandoned raw audio assemblies from being retained indefinitely.
	const names = await fs.readdir(ASSEMBLE_DIR).catch(() => [] as string[]);
	const cutoff = Date.now() - STALE_AUDIO_MS;
	await Promise.all(
		names
			.filter((name) => name.endsWith('.part'))
			.map(async (name) => {
				const target = path.join(ASSEMBLE_DIR, name);
				const stat = await fs.stat(target).catch(() => null);
				if (stat && stat.mtimeMs < cutoff) await fs.unlink(target).catch(() => {});
			})
	);
}

export const POST: RequestHandler = async ({ request, url, locals }) => {
	// Require login for uploads
	if (!locals.user) throw redirect(303, '/auth/login');
	if (!locals.contextSpaceId) return json({ error: 'ContextSpace required' }, { status: 400 });

	if (DEBUG_AUDIO) console.log('[upload-chunk] handler entered');

	try {
		const key = url.searchParams.get('key');
		const indexStr = url.searchParams.get('index') ?? '0';
		const lastStr = url.searchParams.get('last') ?? '0';

		if (!key) {
			console.error('[upload-chunk] missing key');
			return json({ error: 'Missing key param' }, { status: 400 });
		}
		// SECURITY: Only browser-generated UUID upload keys are accepted as temporary filenames.
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
			return json({ error: 'Invalid upload key' }, { status: 400 });
		}

		const existingAssembly = assemblies.get(key);
		if (
			existingAssembly &&
			(existingAssembly.userId !== locals.user.id ||
				existingAssembly.contextSpaceId !== locals.contextSpaceId)
		) {
			return json({ error: 'Upload key is not available' }, { status: 409 });
		}
		if (!existingAssembly) {
			assemblies.set(key, {
				userId: locals.user.id,
				contextSpaceId: locals.contextSpaceId,
				nextIndex: 0,
				totalBytes: 0
			});
		}

		const index = Number.parseInt(indexStr, 10) || 0;
		const assembly = assemblies.get(key)!;
		if (index !== assembly.nextIndex) {
			return json({ error: 'Audio chunks must arrive in order' }, { status: 409 });
		}
		const last = lastStr === '1' || lastStr === 'true';
		const contentType = request.headers.get('content-type') || 'unknown';

		// Read raw bytes
		let ab: ArrayBuffer;
		try {
			ab = await request.arrayBuffer();
			if (DEBUG_AUDIO) {
				console.log('[upload-chunk] read body ok', {
					key,
					index,
					last,
					contentType,
					byteLength: ab.byteLength
				});
			}
		} catch (err: any) {
			console.error('[upload-chunk] arrayBuffer failed:', err?.message);
			return json({ error: 'Failed to read body', message: err?.message }, { status: 400 });
		}
		const bytes = Buffer.from(ab);

		await ensureDir();
		await cleanupStaleAudio();
		const tmpFilePath = path.join(ASSEMBLE_DIR, `${key}.part`);
		if (assembly.totalBytes + bytes.length > MAX_AUDIO_BYTES) {
			assemblies.delete(key);
			await fs.unlink(tmpFilePath).catch(() => {});
			return json({ error: 'Audio too large' }, { status: 413 });
		}

		try {
			await fs.appendFile(tmpFilePath, bytes);
			assembly.nextIndex += 1;
			assembly.totalBytes += bytes.length;
			if (DEBUG_AUDIO) {
				console.log('[upload-chunk] appended chunk', {
					key,
					index,
					last,
					appended: bytes.length,
					file: tmpFilePath
				});
			}
		} catch (err: any) {
			console.error('[upload-chunk] appendFile failed:', err?.message);
			return json({ error: 'Failed to append chunk', message: err?.message }, { status: 500 });
		}

		if (!last) {
			if (DEBUG_AUDIO) console.log('[upload-chunk] not last chunk - returning ok', { key, index });
			return json({ ok: true, appended: bytes.length });
		}

		if (DEBUG_AUDIO) console.log('[upload-chunk] last chunk received - enqueue job');

		const jobId = randomUUID();
		const jobOwner = { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
		jobs.set(jobId, { status: 'queued', ...jobOwner });

		// Fire-and-forget background worker
		void (async () => {
			try {
				jobs.set(jobId, { status: 'processing', ...jobOwner });

				const assembled = await fs.readFile(tmpFilePath);
				if (DEBUG_AUDIO) {
					console.log('[upload-chunk] worker assembled file', {
						key,
						jobId,
						length: assembled.length
					});
				}

				// Import your speech to text helper
				const { transcribeAudio } = await import('$lib/ai');

				if (DEBUG_AUDIO) console.log('[upload-chunk] start transcribe', { jobId });

				// Call the transcriber - it should accept a Buffer and return a string
				const text = await transcribeAudio(assembled);

				if (DEBUG_AUDIO) {
					console.log('[upload-chunk] transcribe ok', {
						jobId,
						chars: text?.length ?? 0
					});
				}

				jobs.set(jobId, { status: 'done', transcript: text || '', ...jobOwner });

				// Clean up the assembled temp file
				await fs.unlink(tmpFilePath).catch(() => {});
				assemblies.delete(key);
			} catch (err: any) {
				console.error('[upload-chunk] worker error:', err?.message || String(err));
				jobs.set(jobId, {
					status: 'error',
					error: err?.message || 'Transcription failed',
					...jobOwner
				});
				// Attempt cleanup but do not fail on it
				await fs.unlink(tmpFilePath).catch(() => {});
				assemblies.delete(key);
			}
		})();

		// Return the job id so the client can poll /api/transcribe-result?jobId=...
		return json({ jobId }, { status: 202 });
	} catch (err: any) {
		console.error('[upload-chunk] unhandled error:', err?.message);
		return json({ error: 'Internal error', message: err?.message || String(err) }, { status: 500 });
	}
};
