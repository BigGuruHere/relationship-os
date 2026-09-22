// src/lib/server/core/interactionEncryption.ts
// PURPOSE: Keep Interaction summary encryption distinct from raw transcript encryption.
// COMPATIBILITY: Stage 8.9 reads the legacy raw-text AAD so existing summaries remain available.

import { decrypt, encrypt } from '$lib/crypto';

const SUMMARY_AAD = 'interaction.summary';
const LEGACY_SUMMARY_AAD = 'interaction.raw_text';

export function encryptInteractionSummary(value: string) {
	return encrypt(value, SUMMARY_AAD);
}

export function decryptInteractionSummary(value: string | null | undefined, fallback = '') {
	if (!value) return fallback;
	try {
		return decrypt(value, SUMMARY_AAD);
	} catch {
		try {
			return decrypt(value, LEGACY_SUMMARY_AAD);
		} catch {
			return fallback;
		}
	}
}
