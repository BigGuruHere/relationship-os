// PURPOSE: Let an authenticated owner create and select isolated application ContextSpaces.
// SECURITY: Selection is server-validated by owner and domain before an HTTP-only preference cookie is written.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import {
	BUSINESS_DOMAIN_KEY,
	DATING_DOMAIN_KEY,
	contextSelectionCookieName
} from '$lib/server/core/contextDomain';
import {
	decryptContextSpaceDisplayName,
	ensureOwnedDomainContextSpace
} from '$lib/server/core/contextSpaceDirectory';

function destinationForDomain(domainKey: string) {
	return domainKey === DATING_DOMAIN_KEY ? '/dating' : '/';
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
	if (!locals.user) throw redirect(303, '/auth/login');

	const rows = await prisma.contextSpace.findMany({
		where: { ownerUserId: locals.user.id },
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
				row.domainKey === DATING_DOMAIN_KEY ? 'Dating' : 'Business'
			),
			isDefault: row.isDefault
		}))
	};
};

export const actions: Actions = {
	createDating: async ({ locals, cookies }) => {
		if (!locals.user) throw redirect(303, '/auth/login');

		const space = await ensureOwnedDomainContextSpace(prisma, {
			ownerUserId: locals.user.id,
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
		if (!locals.user) throw redirect(303, '/auth/login');
		const form = await request.formData();
		const contextSpaceId = String(form.get('contextSpaceId') ?? '').trim();
		if (!contextSpaceId) return fail(400, { error: 'Select a ContextSpace.' });

		// SECURITY: Never trust the submitted domain. Load it from the owner-scoped ContextSpace row.
		const space = await prisma.contextSpace.findFirst({
			where: { id: contextSpaceId, ownerUserId: locals.user.id },
			select: { id: true, domainKey: true }
		});
		if (!space) return fail(404, { error: 'ContextSpace not found.' });
		if (![BUSINESS_DOMAIN_KEY, DATING_DOMAIN_KEY].includes(space.domainKey)) {
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
