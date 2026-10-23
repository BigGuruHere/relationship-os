// Stage 8.17 - Generate the QR for precisely this context's published profile.
import type { PageServerLoad } from './$types';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextProfile } from '$lib/server/core/relishWorkspaceData';
import { generateQrSvg } from '$lib/qr';
export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  const profile = space.configured ? await loadContextProfile(locals.user!.id, space.name) : null;
  const publicUrl = profile?.isPublished ? `${locals.appOrigin}/u/${encodeURIComponent(profile.slug)}` : null;
  // IT: Generate a fresh SVG based on the current deployment URL, so a stored QR from
  // another deployment cannot accidentally point testers at production.
  const qrSvg = publicUrl ? await generateQrSvg(publicUrl, 280) : null;
  return { profile: profile && { slug: profile.slug, displayName: profile.displayName, isPublished: profile.isPublished }, publicUrl, qrSvg };
};
