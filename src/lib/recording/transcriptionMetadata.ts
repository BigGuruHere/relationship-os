// An allowlist shared with the telemetry receiver. Never serialize arbitrary request/provider objects.
export const transcriptionStages = [
	'browser.microphone_requested',
	'browser.record_start',
	'browser.record_stop',
	'browser.chunk_ready',
	'browser.upload_complete',
	'browser.result_received',
	'browser.ui_applied',
	'browser.error',
	'upload.received',
	'upload.accepted',
	'upload.rejected',
	'assembly.complete',
	'job.queued',
	'provider.prepare',
	'provider.request_attempted',
	'provider.response',
	'provider.result',
	'provider.error',
	'job.complete',
	'job.error',
	'poll.result',
	'poll.missing',
	'direct.result'
] as const;
export type TranscriptionStage = (typeof transcriptionStages)[number];
export function validCorrelationId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	);
}
export function safeTranscriptionMetadata(input: Record<string, unknown>, browserOnly = false) {
	const out: Record<string, number | string | boolean> = {};
	for (const key of [
		'audioBytes',
		'chunkBytes',
		'chunkIndex',
		'chunkCount',
		'durationMs',
		'elapsedMs',
		'characterCount',
		'httpStatus',
		'sampleRate',
		'channelCount',
		'clientTimestampMs'
	]) {
		const v = input[key];
		if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e13) out[key] = v;
	}
	for (const key of [
		'uploadComplete',
		'emptyContent',
		'externalCallAttempted',
		'credentialsConfigured'
	]) {
		if (
			(!browserOnly || !['externalCallAttempted', 'credentialsConfigured'].includes(key)) &&
			typeof input[key] === 'boolean'
		)
			out[key] = input[key] as boolean;
	}
	const mime = input.mimeType;
	if (
		typeof mime === 'string' &&
		[
			'audio/webm',
			'audio/mp4',
			'audio/ogg',
			'audio/wav',
			'audio/mpeg',
			'application/octet-stream',
			'audio/webm;codecs=opus',
			'audio/webm; codecs=opus',
			'audio/mp4;codecs=mp4a.40.2',
			'audio/mp4; codecs=mp4a.40.2'
		].includes(mime.toLowerCase())
	)
		out.mimeType = mime.toLowerCase();
	if (['opus', 'aac', 'unknown'].includes(String(input.codec))) out.codec = input.codec as string;
	if (!browserOnly) {
		if (input.provider === 'openai') out.provider = 'openai';
		if (input.model === 'whisper-1') out.model = 'whisper-1';
		if (input.endpointCategory === 'audio.transcriptions')
			out.endpointCategory = 'audio.transcriptions';
		if (typeof input.requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input.requestId))
			out.requestId = input.requestId;
		if (
			[
				'missing_credentials',
				'network',
				'provider_auth',
				'provider_rate_limit',
				'provider_http',
				'response_read',
				'input',
				'upload',
				'processing'
			].includes(String(input.errorCategory))
		)
			out.errorCategory = input.errorCategory as string;
	}
	return out;
}
