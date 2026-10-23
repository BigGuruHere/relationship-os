// Stage 8.18: mobile-first QR handoff. The visitor must personally send the SMS.
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/db';
import { pilotDomainForKind, pilotKindLabel, pilotSource } from '$lib/server/pilot';
import { issuePilotSmsInvitation, pilotTermsConfig } from '$lib/server/core/pilotSmsCallback';

export const load: PageServerLoad = async ({ params }) => {
  const profile = await prisma.profile.findUnique({ where: { slug: params.slug },
    select: { id: true, userId: true, kind: true, displayName: true, isPublished: true } });
  if (!profile?.isPublished || !pilotDomainForKind(profile.kind)) throw error(404, 'Profile unavailable.');
  const domainKey = pilotDomainForKind(profile.kind)!;
  const pref = await prisma.relishContextPreference.findUnique({ where: {
    ownerUserId_domainKey: { ownerUserId: profile.userId, domainKey }
  } });
  return { profileName: profile.displayName || 'this person', contextLabel: pilotKindLabel(profile.kind),
    slug: params.slug, mode: pref?.dorianMode || 'SMS_CALLBACK', ...pilotTermsConfig() };
};

export const actions: Actions = {
  request: async ({ params, locals, request, url }) => {
    const profile = await prisma.profile.findUnique({ where: { slug: params.slug },
      select: { id: true, userId: true, kind: true, isPublished: true } });
    if (!profile?.isPublished || !pilotDomainForKind(profile.kind)) return fail(404, { error: 'Profile unavailable.' });
    const domainKey = pilotDomainForKind(profile.kind)!;
    if (locals.user?.id === profile.userId) return fail(400, { error: 'Use another phone to test the visitor flow.' });
    const pref = await prisma.relishContextPreference.findUnique({ where: {
      ownerUserId_domainKey: { ownerUserId: profile.userId, domainKey }
    } });
    if (pref?.dorianMode === 'BROWSER') return fail(409, { error: 'This profile currently uses the browser Dorian experience.' });
    const cfg = pilotTermsConfig();
    if (!cfg.ready) return fail(503, { error: 'Telephone onboarding is not configured yet.' });
    const form = await request.formData();
    if (form.get('agreeTerms') !== 'yes') return fail(400, { error: 'Please read and agree to the terms and privacy information.' });
    const name = String(form.get('name') || '').trim().slice(0, 90);
    const email = String(form.get('email') || '').trim().slice(0, 254);
    const connect = form.get('shareContact') === 'yes';
    if (connect && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      return fail(400, { error: 'Enter your name and a valid email to share your contact details.' });
    // POST-rate throttle per profile; an SMS must still be received to initiate the actual call.
    const recent = await prisma.pilotSmsInvitation.count({ where: { profileId: profile.id,
      createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (recent >= 100) return fail(429, { error: 'Too many invitations. Please try again later.' });
    try {
      const issued = await issuePilotSmsInvitation({ profileId: profile.id, ownerUserId: profile.userId,
        domainKey, env: locals.env, source: pilotSource(url.searchParams.get('via')),
        offeredName: connect ? name : undefined, offeredEmail: connect ? email : undefined });
      return { issued };
    } catch {
      return fail(503, { error: 'Could not create a new telephone invitation.' });
    }
  }
};
