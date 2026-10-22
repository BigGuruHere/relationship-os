// PURPOSE: Inspect one call and the authoritative revision linked to its source interaction.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listDorianCalls, requirePilotOperator } from '$lib/server/pilotMonitor/conversations';
export const load: PageServerLoad = async ({ locals, params }) => {
  const [call] = await listDorianCalls(await requirePilotOperator(locals), params.interactionId);
  if (!call) throw error(404, 'Conversation not found or not authorised.');
  return { call };
};
