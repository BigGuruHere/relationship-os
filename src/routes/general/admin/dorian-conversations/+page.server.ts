// PURPOSE: List all operator-authorised Dorian calls, including already-applied LU updates.
import type { PageServerLoad } from './$types';
import { listDorianCalls, requirePilotOperator } from '$lib/server/pilotMonitor/conversations';
export const load: PageServerLoad = async ({ locals }) => ({ calls: await listDorianCalls(await requirePilotOperator(locals)) });
