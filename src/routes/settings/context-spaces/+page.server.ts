// PURPOSE: Let an authenticated owner create and select isolated application ContextSpaces.
// SECURITY: Selection is server-validated by owner and domain before an HTTP-only preference cookie is written.

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { hasCapability } from '$lib/server/core/capabilities';
import {
	BUSINESS_DOMAIN_KEY,
	DATING_DOMAIN_KEY,
	GENERAL_DOMAIN_KEY,
	contextSelectionCookieName
} from '$lib/server/core/contextDomain';
import {
	decryptContextSpaceDisplayName,
	ensureOwnedDomainContextSpace
} from '$lib/server/core/contextSpaceDirectory';

// SECURITY: Check on every load and action; hiding navigation is not authorisation.
function requireSpaceAdministrator(locals: App.Locals): string {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (!hasCapability(locals.capabilities, 'ADMIN')) throw error(403, 'Administrator capability required.');
	return locals.user.id;
}

function destinationForDomain(domainKey: string) {
	if (domainKey === DATING_DOMAIN_KEY) return '/dating';
	if (domainKey === GENERAL_DOMAIN_KEY) return '/general';
	return '/';
}

function contextCookieOptions(locals: App.Locals) {
	return {
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: locals.sessionCookie.options.secure,
		path: '/',
		maxAge: 365 * 24 * 60 * 60
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = requireSpaceAdministrator(locals);

	const rows = await prisma.contextSpace.findMany({
		where: { ownerUserId: userId },
		select: { id: true, domainKey: true, displayNameEnc: true, isDefault: true, createdAt: true },
		orderBy: [{ domainKey: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }]
	});

	return {
		activeContextSpaceId: locals.contextSpaceId ?? null,
		activeDomainKey: locals.contextDomainKey,
		spaces: rows.map((row) => ({
			id: row.id,
			domainKey: row.domainKey,
			displayName: decryptContextSpaceDisplayName(
				row.displayNameEnc,
				row.domainKey === DATING_DOMAIN_KEY ? 'Dating' : row.domainKey === GENERAL_DOMAIN_KEY ? 'General' : 'Business'
			),
			isDefault: row.isDefault
		}))
	};
};

export const actions: Actions = {

	createGeneral: async ({ locals, cookies }) => {
		const userId = requireSpaceAdministrator(locals);

		const space = await ensureOwnedDomainContextSpace(prisma, {
			ownerUserId: userId,
			domainKey: GENERAL_DOMAIN_KEY,
			displayName: 'General'
		});
		cookies.set(
			contextSelectionCookieName(GENERAL_DOMAIN_KEY),
			space.id,
			contextCookieOptions(locals)
		);
		throw redirect(303, '/general');
	},

	createDating: async ({ locals, cookies }) => {
		const userId = requireSpaceAdministrator(locals);

		const space = await ensureOwnedDomainContextSpace(prisma, {
			ownerUserId: userId,
			domainKey: DATING_DOMAIN_KEY,
			displayName: 'Dating'
		});
		cookies.set(
			contextSelectionCookieName(DATING_DOMAIN_KEY),
			space.id,
			contextCookieOptions(locals)
		);
		throw redirect(303, '/dating');
	},

	select: async ({ request, locals, cookies }) => {
		const userId = requireSpaceAdministrator(locals);
		const form = await request.formData();
		const contextSpaceId = String(form.get('contextSpaceId') ?? '').trim();
		if (!contextSpaceId) return fail(400, { error: 'Select a ContextSpace.' });

		// SECURITY: Never trust the submitted domain. Load it from the owner-scoped ContextSpace row.
		const space = await prisma.contextSpace.findFirst({
			where: { id: contextSpaceId, ownerUserId: userId },
			select: { id: true, domainKey: true }
		});
		if (!space) return fail(404, { error: 'ContextSpace not found.' });
		if (![BUSINESS_DOMAIN_KEY, DATING_DOMAIN_KEY, GENERAL_DOMAIN_KEY].includes(space.domainKey)) {
			return fail(400, { error: 'This application domain is not available yet.' });
		}

		cookies.set(
			contextSelectionCookieName(space.domainKey),
			space.id,
			contextCookieOptions(locals)
		);
		throw redirect(303, destinationForDomain(space.domainKey));
	}
};
