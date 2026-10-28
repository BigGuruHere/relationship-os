// Operator-only conversation monitor and explicit, audited recovery controls.
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDorianCalls, requirePilotOperator } from '$lib/server/pilotMonitor/conversations';
import { listDorianRecovery, recoverDorianCall } from '$lib/server/pilotMonitor/dorianRecovery';

export const load: PageServerLoad = async ({ locals, url }) => {
  const viewer = await requirePilotOperator(locals);
  const [calls, recovery] = await Promise.all([listDorianCalls(viewer), listDorianRecovery(viewer)]);
  return { calls, recovery, recovered: url.searchParams.get('recovered') === '1' };
};

export const actions: Actions = {
  recover: async ({ locals, request }) => {
    const viewer = await requirePilotOperator(locals);
    const data = await request.formData();
    const sessionId = String(data.get('sessionId') || '');
    const operation = String(data.get('operation') || '');
    const reasonCode = String(data.get('reasonCode') || '');
    const confirmedEnded = data.get('confirmedEnded') === 'yes';
    const confirmedWorkerStopped = data.get('confirmedWorkerStopped') === 'yes';
    try {
      await recoverDorianCall(viewer, { sessionId, operation, reasonCode, confirmedEnded, confirmedWorkerStopped });
    } catch (cause) {
      // Preserve SvelteKit error statuses; do not return sensitive IDs or participant data.
      if (cause && typeof cause === 'object' && 'status' in cause && typeof cause.status === 'number') {
        const status = cause.status;
        if (status >= 400 && status < 500) {
          return fail(status, { recoveryError: cause instanceof Error ? cause.message : 'Recovery rejected. Refresh and try again.' });
        }
      }
      console.error('[Dorian Recovery] Unexpected failure', { errorClass: cause instanceof Error ? cause.name : 'UnknownError' });
      throw error(500, 'Recovery unavailable. No call was released; check operator logs.');
    }
    throw redirect(303, '/general/admin/dorian-conversations?recovered=1');
  }
};
