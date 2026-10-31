// Stage 8.22.3c: provider-neutral Relish call completion entry point.
// The caller must authenticate and normalise the external event BEFORE invoking
// this function. Call completion is independent of transcript ingestion and LU.
import { completeDorianCall } from './dorianVoiceCallLifecycle';
import { markPhoneCallEnded } from './phoneUnderstandingAutomation';

export async function recordVerifiedVoiceCallEnded(input: {
  conversationId: unknown;
  endedAt: Date;
  hasParticipantSpeech: boolean;
}) {
  // Write the independent call ledger first. A retry is idempotent, and if the
  // second write fails, local initiation reconciliation repairs the caller state.
  await completeDorianCall(input.conversationId, input.hasParticipantSpeech, input.endedAt);
  if (typeof input.conversationId === 'string') {
    await markPhoneCallEnded(input.conversationId, input.endedAt);
  }
}
