// PURPOSE: surface the current user to +layout.svelte for conditional nav
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: locals.user }
}
