// PURPOSE: General-context wrapper around the shared structural Living Understanding workflow.
import type { Actions, PageServerLoad } from './$types';
import { load as sharedLoad, actions as sharedActions } from '../../../../../dating/people/[id]/understanding/revision-experiment/+page.server';
export const load: PageServerLoad = async (event) => (sharedLoad as any)(event);
export const actions = sharedActions as unknown as Actions;
