import test from 'node:test';
import assert from 'node:assert/strict';
import { withConsentGate } from '../../src/lib/server/core/dorianConsentProjection';
import { guardFoundationQuery, runFoundationBoundary } from '../../src/lib/server/foundation/internal';
import { finishDorianInitiationData } from '../../src/lib/server/integrations/elevenlabs/voiceInitiationContract.mjs';

// Exact routing can read the account binding, never the destination or proof relationship.
test('telephone lookup admits only exact verified mobile metadata', async () => {
	const args = {
		where: { type: 'PHONE', status: 'VERIFIED', valueHash: 'a'.repeat(64) },
		select: { id: true, ownerUserId: true, generation: true },
		take: 2
	};
	const lookup = () => guardFoundationQuery('FoundationAccountChannel', 'findMany', args);
	assert.throws(lookup);
	await runFoundationBoundary({ ownerUserId: 'telephone-test', mode: 'DORIAN_PHONE_LOOKUP' }, async () => {
		assert.deepEqual(lookup(), args);
		for (const query of [
			{ ...args, select: { ...args.select, valueEnc: true } },
			{ ...args, where: { ...args.where, status: 'PENDING' } },
			{ ...args, where: { ...args.where, valueHash: { startsWith: 'a' } } },
			{ ...args, include: { proofs: true } }
		]) {
			assert.throws(() => guardFoundationQuery('FoundationAccountChannel', 'findMany', query));
		}
		assert.throws(() => guardFoundationQuery('FoundationAccountChannelVerification', 'findMany', args));
	});
});

test('provider terms_agreed is a server-owned boolean and processing calls have no credential', () => {
	assert.equal(withConsentGate({ terms_agreed: true }, { instruction: 'Consent required', accepted: false }).terms_agreed, false);
	assert.equal(withConsentGate({ terms_agreed: false }, { instruction: 'Terms accepted', accepted: true }).terms_agreed, true);
	const processing = finishDorianInitiationData({
		type: 'conversation_initiation_client_data',
		dynamic_variables: { relish_network_session: 'PROCESSING_NO_SESSION' }
	}, 'PROCESSING_ONLY');
	assert.equal(processing.dynamic_variables.terms_agreed, false);
	assert.equal(processing.dynamic_variables.memory_and_identity_context, '');
	assert.throws(() => finishDorianInitiationData(processing, 'PARTICIPANT'));
});
