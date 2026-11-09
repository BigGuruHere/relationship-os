// Keep the dedicated vCard preview and generate its QR from the same selected profile.
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildVcardUrl } from '$lib/publicProfile';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const slug = url.searchParams.get('profile');
  const profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id, ...(slug === null ? {} : { slug }) },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      slug: true, isPublished: true, displayName: true, company: true,
      title: true, emailPublic: true, phonePublic: true, websiteUrl: true, publicMeta: true
    }
  });
  if (slug !== null && !profile) throw error(404, 'Profile not found.');
  if (!profile) throw redirect(303, '/share');

  const selected = encodeURIComponent(profile.slug);
  if (!profile.isPublished) throw redirect(303, '/share?profile=' + selected);
  const link = absoluteUrlFromOrigin(locals.appOrigin, '/u/' + selected);
  return {
    link,
    qrUrl: '/api/qr?slug=' + selected,
    smsUrl: 'sms:?&body=' + encodeURIComponent('Hi - here is my link to connect: ' + link),
    whatsappUrl: 'https://wa.me/?text=' + encodeURIComponent('Hi - here is my link to connect: ' + link),
    vcardUrl: buildVcardUrl(profile, link)
  };
};
