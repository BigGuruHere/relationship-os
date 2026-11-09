import {
	transcriptionCorrelationId,
	transcriptionEvent
} from '$lib/server/transcriptionDiagnostics';
// src/routes/api/upload-chunk/+server.ts
// PURPOSE:
// - Accept audio chunks (Content-Type: application/octet-stream)
// - Append to a temp .part file identified by ?key=...
// - On the last chunk (?last=1) enqueue an async transcription job and return { jobId } immediately
// - Client polls /api/transcribe-result for completion
//
// LOGGING:
// - All console logs are safe: only print lengths, IDs, and messages (never full objects)
// - RELISH_TRANSCRIPTION_DEBUG=YES enables structured metadata diagnostics.

import type { RequestHandler } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'node:crypto';

// Toggle detailed logs
// RELISH_TRANSCRIPTION_DEBUG controls detailed, structured metadata only.

// Job store in memory (per instance only)
type Job = {
	status: 'queued' | 'processing' | 'done' | 'error';
	userId: string;
	scopeKey: string;
	expiresAt: number;
	transcript?: string;
	error?: string;
	correlationId: string;
};
const jobs = new Map<string, Job>();
const assemblies = new Map<
	string,
	{
		userId: string;
		scopeKey: string;
		expiresAt: number;
		nextIndex: number;
		finalized: boolean;
		totalBytes: number;
		mime: 'audio/webm' | 'audio/mp4';
	}
>();
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const STALE_AUDIO_MS = 60 * 60 * 1000;

// Exported so /api/transcribe-result can read job state
export function _getJob(
	jobId: string,
	userId: string,
	scopeKey: string,
	retain = false
): Job | undefined {
	const job = jobs.get(jobId);
	// SECURITY: A transcript job belongs to the exact user and server-issued domain scope that uploaded it.
	if (!job || job.userId !== userId || job.scopeKey !== scopeKey || job.expiresAt <= Date.now())
		return undefined;
	// IT: Legacy results are consumed once. Foundation polling permits retries until expiry.
	if (!retain && (job.status === 'done' || job.status === 'error')) jobs.delete(jobId);
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

// Shared transient transport accepts a server-issued scope, never a browser-selected vault.
export type _AudioScope = { key: string; authorize: () => Promise<void> };
const inFlight = new Set<string>();
export const POST: RequestHandler = (event) => _upload(event);
export async function _upload(event: Parameters<RequestHandler>[0], scope?: _AudioScope) {
	await scope?.authorize();
	const key = event.url.searchParams.get('key') || '';
	if (inFlight.has(key))
		return json({ error: 'Audio chunk is already being processed' }, { status: 409 });
	inFlight.add(key);
	try {
		return await upload(event, scope);
	} finally {
		inFlight.delete(key);
	}
}
async function upload(
	{ request, url, locals }: Parameters<RequestHandler>[0],
	scope?: _AudioScope
) {
	const scopeKey =
		scope?.key ?? (locals.contextSpaceId ? 'legacy:' + locals.contextSpaceId : undefined);
	const correlationId = transcriptionCorrelationId(url.searchParams.get('key'));
	const reject = (status: number) =>
		transcriptionEvent(
			'upload.rejected',
			correlationId,
			{ httpStatus: status, errorCategory: 'upload' },
			true
		);
	const receivedAt = performance.now();
	transcriptionEvent('upload.received', correlationId);
	// Require login for uploads
	if (!locals.user) {
		reject(401);
		throw redirect(303, '/auth/login');
	}
	if (!scopeKey) {
		reject(400);
		return json({ error: 'ContextSpace required' }, { status: 400 });
	}

	try {
		const key = url.searchParams.get('key');
		const indexStr = url.searchParams.get('index') ?? '0';
		const lastStr = url.searchParams.get('last') ?? '0';
		// The upload format must be stable across chunks. Reject arbitrary MIME strings.
		const mimeParam = url.searchParams.get('mime') || 'audio/webm';
		if (mimeParam !== 'audio/webm' && mimeParam !== 'audio/mp4') {
			reject(415);
			return json({ error: 'Unsupported audio format' }, { status: 415 });
		}

		if (!key) {
			reject(400);
			return json({ error: 'Missing key param' }, { status: 400 });
		}
		// SECURITY: Only browser-generated UUID upload keys are accepted as temporary filenames.
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
			reject(400);
			return json({ error: 'Invalid upload key' }, { status: 400 });
		}

		for (const [id, job] of jobs) if (job.expiresAt <= Date.now()) jobs.delete(id);
		for (const [id, assembly] of assemblies)
			if (assembly.expiresAt <= Date.now()) assemblies.delete(id);
		const existingAssembly = assemblies.get(key);
		if (
			existingAssembly &&
			(existingAssembly.userId !== locals.user.id || existingAssembly.scopeKey !== scopeKey)
		) {
			reject(409);
			return json({ error: 'Upload key is not available' }, { status: 409 });
		}
		if (!existingAssembly) {
			assemblies.set(key, {
				userId: locals.user.id,
				scopeKey,
				expiresAt: Date.now() + STALE_AUDIO_MS,
				nextIndex: 0,
				finalized: false,
				totalBytes: 0,
				mime: mimeParam
			});
		}

		const index = Number(indexStr);
		if (!Number.isSafeInteger(index) || index < 0)
			return json({ error: 'Invalid chunk index' }, { status: 400 });
		const assembly = assemblies.get(key)!;
		// Once queued, no later chunk may mutate the provider input.
		if (assembly.finalized)
			return json({ error: 'Audio upload is already complete' }, { status: 409 });
		if (assembly.mime !== mimeParam) {
			reject(409);
			return json({ error: 'Audio format changed during upload' }, { status: 409 });
		}
		if (index !== assembly.nextIndex) {
			reject(409);
			return json({ error: 'Audio chunks must arrive in order' }, { status: 409 });
		}
		const last = lastStr === '1' || lastStr === 'true';

		// Read raw bytes
		let ab: ArrayBuffer;
		try {
			ab = await request.arrayBuffer();
		} catch (err: any) {
			reject(400);
			return json({ error: 'Failed to read body' }, { status: 400 });
		}
		const bytes = Buffer.from(ab);

		await ensureDir();
		await cleanupStaleAudio();
		const tmpFilePath = path.join(ASSEMBLE_DIR, `${key}.part`);
		if (assembly.totalBytes + bytes.length > MAX_AUDIO_BYTES) {
			assemblies.delete(key);
			await fs.unlink(tmpFilePath).catch(() => {});
			reject(413);
			return json({ error: 'Audio too large' }, { status: 413 });
		}

		try {
			// A new process or expired assembly must never append to an abandoned file.
			if (index === 0) await fs.writeFile(tmpFilePath, bytes);
			else await fs.appendFile(tmpFilePath, bytes);
			assembly.nextIndex += 1;
			assembly.totalBytes += bytes.length;
			transcriptionEvent('upload.accepted', correlationId, {
				mimeType: assembly.mime,
				chunkBytes: bytes.length,
				audioBytes: assembly.totalBytes,
				chunkIndex: index,
				chunkCount: assembly.nextIndex,
				uploadComplete: last,
				elapsedMs: performance.now() - receivedAt
			});
		} catch (err: any) {
			reject(500);
			return json({ error: 'Failed to append chunk' }, { status: 500 });
		}

		if (!last) {
			return json({ ok: true, appended: bytes.length });
		}

		assembly.finalized = true;
		const jobId = randomUUID();
		const jobOwner = {
			userId: locals.user.id,
			scopeKey,
			expiresAt: Date.now() + STALE_AUDIO_MS,
			correlationId
		};
		transcriptionEvent('job.queued', correlationId, {
			audioBytes: assembly.totalBytes,
			chunkCount: assembly.nextIndex,
			uploadComplete: true
		});
		jobs.set(jobId, { status: 'queued', ...jobOwner });

		// Fire-and-forget background worker
		void (async () => {
			try {
				jobs.set(jobId, { status: 'processing', ...jobOwner });

				const assembled = await fs.readFile(tmpFilePath);
				transcriptionEvent('assembly.complete', correlationId, {
					audioBytes: assembled.length,
					mimeType: assembly.mime,
					chunkCount: assembly.nextIndex,
					uploadComplete: true
				});

				// Import your speech to text helper
				const { transcribeAudio } = await import('$lib/ai');

				// Call the transcriber - it should accept a Buffer and return a string
				await scope?.authorize();
				const text = await transcribeAudio(assembled, assembly.mime, { correlationId });
				await scope?.authorize();
				if (!text.trim()) throw new Error('Empty transcription');

				transcriptionEvent('job.complete', correlationId, {
					characterCount: text.length,
					emptyContent: !text.length
				});
				jobs.set(jobId, { status: 'done', transcript: text || '', ...jobOwner });

				// Clean up the assembled temp file
				await fs.unlink(tmpFilePath).catch(() => {});
				assemblies.delete(key);
			} catch (err: any) {
				transcriptionEvent('job.error', correlationId, { errorCategory: 'processing' }, true);
				jobs.set(jobId, {
					status: 'error',
					error: 'Transcription failed',
					...jobOwner
				});
				// Attempt cleanup but do not fail on it
				await fs.unlink(tmpFilePath).catch(() => {});
				assemblies.delete(key);
			}
		})();

		// Return the job id so the client can poll /api/transcribe-result?jobId=...
		return json({ jobId, correlationId }, { status: 202 });
	} catch (err: any) {
		reject(500);
		return json({ error: 'Internal error' }, { status: 500 });
	}
}

// Best-effort process cleanup. Durable queue/storage is a separate rollout gate.
const cleanupTimer = setInterval(() => {
	const now = Date.now();
	for (const [id, job] of jobs) if (job.expiresAt <= now) jobs.delete(id);
	for (const [id, assembly] of assemblies) if (assembly.expiresAt <= now) assemblies.delete(id);
	void cleanupStaleAudio();
}, 60000);
cleanupTimer.unref();
