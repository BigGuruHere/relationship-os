import { json, type RequestHandler } from '@sveltejs/kit';
import {
	safeTranscriptionMetadata,
	transcriptionStages,
	validCorrelationId,
	type TranscriptionStage
} from '$lib/recording/transcriptionMetadata';
import { transcriptionDebugEnabled, transcriptionEvent } from './transcriptionDiagnostics';
const limits = new Map<string, { started: number; count: number }>();
export const receiveTranscriptionDiagnostics: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || !locals.contextSpaceId) return new Response(null, { status: 401 });
	if (!transcriptionDebugEnabled()) return new Response(null, { status: 204 });
	// Bound telemetry independently of audio; never log invalid payloads or user identifiers.
	const now = Date.now();
	for (const [id, v] of limits) if (now - v.started > 60000) limits.delete(id);
	const limit = limits.get(locals.user.id) ?? { started: now, count: 0 };
	if (limits.size > 1000 || ++limit.count > 300) return new Response(null, { status: 429 });
	limits.set(locals.user.id, limit);
	try {
		const text = await request.text();
		if (text.length > 4096) return new Response(null, { status: 413 });
		const body = JSON.parse(text);
		if (
			!validCorrelationId(body.correlationId) ||
			!transcriptionStages.includes(body.stage) ||
			!String(body.stage).startsWith('browser.')
		)
			return new Response(null, { status: 400 });
		transcriptionEvent(
			body.stage as TranscriptionStage,
			body.correlationId,
			safeTranscriptionMetadata(body, true)
		);
		return new Response(null, { status: 204 });
	} catch {
		return json({ error: 'Invalid diagnostic metadata' }, { status: 400 });
	}
};
