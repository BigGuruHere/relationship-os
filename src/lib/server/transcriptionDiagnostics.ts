import { randomUUID } from 'node:crypto';
import {
	safeTranscriptionMetadata,
	validCorrelationId,
	type TranscriptionStage
} from '$lib/recording/transcriptionMetadata';
export const transcriptionDebugEnabled = () => process.env.RELISH_TRANSCRIPTION_DEBUG === 'YES';
export const transcriptionCorrelationId = (value?: unknown) =>
	validCorrelationId(value) ? value : randomUUID();
// Errors remain visible when detailed diagnostics are disabled; bodies, error.message and stacks never pass through.
export function transcriptionEvent(
	stage: TranscriptionStage,
	correlationId: string,
	metadata: Record<string, unknown> = {},
	error = false
) {
	if (!error && !transcriptionDebugEnabled()) return;
	const record = {
		component: 'relish.transcription',
		stage,
		timestamp: new Date().toISOString(),
		correlationId: validCorrelationId(correlationId) ? correlationId : 'invalid',
		...safeTranscriptionMetadata(metadata)
	};
	(error ? console.error : console.log)(JSON.stringify(record));
}
