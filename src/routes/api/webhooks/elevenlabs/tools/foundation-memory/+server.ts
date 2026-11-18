import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/db';
import { foundationDorianAgent, foundationDorianOriginAllowed } from '$lib/server/foundation/dorianCallConfig';
import { readDorianContinuity } from '$lib/server/foundation/livingUnderstanding';
import { resolveDorianCallAccess } from '$lib/server/foundation/policy';
import { verifyInitiationAuthorization } from '$lib/server/integrations/elevenlabs/initiation';
import type { RequestHandler } from './$types';

const input = z.strictObject({ conversation_id: z.string().regex(/^conv_[a-z0-9_-]{1,235}$/i) });
const headers = { 'cache-control': 'private, no-store' };

export const POST: RequestHandler = async ({ request, url, locals }) => {
	const agentId = foundationDorianAgent();
	const secret = process.env.RELISH_FOUNDATION_DORIAN_TOOL_SECRET?.trim();
	if (!agentId || !secret || !foundationDorianOriginAllowed(locals.env, url))
		return json({ error: 'Unavailable.' }, { status: 404, headers });
	if (!verifyInitiationAuthorization(request.headers.get('authorization'), secret))
		return json({ error: 'Invalid tool credentials.' }, { status: 401, headers });
	const parsed = input.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'Invalid tool input.' }, { status: 400, headers });
	// ElevenLabs supplies the system conversation ID. No tool parameter can select a user.
	const call = await prisma.dorianFoundationCall.findUnique({
		where: { conversationId: parsed.data.conversation_id }, select: { id: true, agentId: true }
	});
	if (!call || call.agentId !== agentId) return json({ topics: [] }, { headers });
	try {
		const access = await resolveDorianCallAccess(call.id, { kind: 'launch' }, 'READ_LU');
		return json({ topics: await readDorianContinuity(access) }, { headers });
	} catch {
		return json({ topics: [] }, { headers });
	}
};
