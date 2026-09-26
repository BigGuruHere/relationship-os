// Stage 8.12.2: person-first Dating history. No Introduction is required to reflect.
// Every action is scoped to the signed-in owner and active Dating ContextSpace.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createPersonReflection, createPersonTouchpoint, loadPersonHistory } from '$lib/server/datingPersonHistory';

function scopeFor(locals: App.Locals, contactId: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const scope = scopeFor(locals, params.id);
  try { return { ...(await loadPersonHistory(scope)), savedReflectionId: url.searchParams.get('savedReflectionId') }; }
  catch (error: any) {
    if (error?.message === 'Person is not accessible in this Dating space.') throw redirect(303, '/dating/people');
    throw error;
  }
};

export const actions: Actions = {
  reflect: async ({ locals, params, request }) => {
    const scope = scopeFor(locals, params.id);
    const form = await request.formData();
    let reflection;
    try { reflection = await createPersonReflection(scope, { text: String(form.get('text') || ''), touchpointId: String(form.get('touchpointId') || '') || null }); }
    catch (error: any) { return fail(400, { error: error?.message || 'Could not save private reflection.' }); }
    throw redirect(303, `/dating/people/${params.id}?savedReflectionId=${encodeURIComponent(reflection.id)}#personal-reflections`);
  },
  touchpoint: async ({ locals, params, request }) => {
    const scope = scopeFor(locals, params.id);
    const form = await request.formData();
    try {
      await createPersonTouchpoint(scope, {
        kind: String(form.get('kind') || ''), occurredAt: String(form.get('occurredAt') || '') || undefined,
        note: String(form.get('note') || ''), relatingId: String(form.get('relatingId') || '') || null,
        attendeeIds: form.getAll('attendeeIds').map(String).concat(params.id)
      });
    } catch (error: any) { return fail(400, { error: error?.message || 'Could not save touchpoint.' }); }
    throw redirect(303, `/dating/people/${params.id}`);
  }
};
