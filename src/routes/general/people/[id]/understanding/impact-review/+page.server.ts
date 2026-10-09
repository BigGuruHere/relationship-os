// PURPOSE: General-context wrapper around longitudinal Living Understanding impact review.
import type { Actions, PageServerLoad } from './$types';
import { load as sharedLoad, actions as sharedActions } from '../../../../../dating/people/[id]/understanding/impact-review/+page.server';
export const load: PageServerLoad = async (event) => (sharedLoad as any)(event);
export const actions = sharedActions as unknown as Actions;
