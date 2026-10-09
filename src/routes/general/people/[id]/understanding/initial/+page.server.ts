// PURPOSE: Production initial Living Understanding route inside the General ContextSpace.
// SECURITY: Delegates to the shared reviewed workflow after the route-owned General domain is resolved.
import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { load as sharedLoad, actions as sharedActions } from '../revision-experiment/+page.server';
export const load: PageServerLoad = async (event) => {
  try { return await (sharedLoad as any)(event); }
  catch (err) {
    if (isRedirect(err) || isHttpError(err)) throw err;
    console.error('[living-understanding] General initial route load failed', err);
    const message = err instanceof Error ? err.message : String(err);
    throw error(500, process.env.NODE_ENV === 'production' ? 'The initial Living Understanding workflow could not be loaded.' : `Initial Living Understanding load failed: ${message}`);
  }
};
export const actions = sharedActions as unknown as Actions;
