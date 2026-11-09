// src/routes/+layout.server.ts
// PURPOSE: Expose current user info and lightweight counts for the layout.
// SECURITY:
// - Do not expose plaintext email in layout data.
// - If needed for UI, decrypt on the server and pass a redacted string only.
// MULTI TENANT: All queries are scoped by userId.

import type { LayoutServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptUserEmail } from '$lib/server/userEmail'; // IT - server-only decrypt helper
import { decryptContextSpaceDisplayName } from '$lib/server/core/contextSpaceDirectory';
import { visibleRelishWorkspaces } from '$lib/server/core/relishWorkspace';

// IT - helper to redact an email for safe display
function redactEmail(email: string | null) {
	if (!email) return null;
	// keep first 2 chars and domain, mask the middle
	return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// IT: Reading pathname makes SvelteKit refresh this shared layout when navigation crosses an application boundary.
	const routePathname = url.pathname;
	// IT - basic shape for layout - only id plus optional redacted email for display
	let user: { id: string; emailRedacted: string | null } | null = null;
	let activeContext: { id: string; domainKey: string; displayName: string } | null = null;
	let hasDatingContext = false;
	let hasGeneralContext = false;
	let visibleSpaces: Awaited<ReturnType<typeof visibleRelishWorkspaces>> = [];

	if (locals.user?.id) {
		// IT - read encrypted email for this user and produce a redacted string
		const u = await prisma.user.findUnique({
			where: { id: locals.user.id },
			select: { email_Enc: true }
		});

		const decrypted = decryptUserEmail(u?.email_Enc ?? null);
		user = { id: locals.user.id, emailRedacted: redactEmail(decrypted) };

		const spaces = await prisma.contextSpace.findMany({
			where: { ownerUserId: locals.user.id },
			select: { id: true, domainKey: true, displayNameEnc: true }
		});
		visibleSpaces = await visibleRelishWorkspaces(locals.user.id, locals.user.role || 'member');
		hasDatingContext = spaces.some((space) => space.domainKey === 'dating');
		hasGeneralContext = spaces.some((space) => space.domainKey === 'general');
		const selected = spaces.find((space) => space.id === locals.contextSpaceId) ?? null;
		if (selected) {
			activeContext = {
				id: selected.id,
				domainKey: selected.domainKey,
				displayName: decryptContextSpaceDisplayName(
					selected.displayNameEnc,
					selected.domainKey === 'dating' ? 'Dating' : selected.domainKey === 'general' ? 'General' : 'Business'
				)
			};
		}
	}

	return {
		user, // { id, emailRedacted } or null
		activeContext,
		activeDomainKey: locals.contextDomainKey,
		routePathname,
		profileKindHint: url.pathname === '/settings/profile' ? url.searchParams.get('kind') : null,
		networkEntry: url.searchParams.get('entry') === 'network',
		hasDatingContext,
		hasGeneralContext,
		visibleSpaces,
		capabilities: locals.capabilities ?? [],
		accountRole: locals.user?.role ?? null,
	};
};
