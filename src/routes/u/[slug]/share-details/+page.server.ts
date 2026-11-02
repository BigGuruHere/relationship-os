import type { Actions, PageServerLoad } from './$types';
import { fail, isHttpError } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { publishedCaptureProfile, capturePrivateContact } from '$lib/server/core/contactCapture';
import { CAPTURE_COOKIE, issueContactCaptureToken, verifyContactCaptureToken } from '$lib/server/core/contactCaptureToken';
import { validateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ params, url, cookies, setHeaders }) => {
  const profile = await publishedCaptureProfile(params.slug);
  let browser = cookies.get(CAPTURE_COOKIE);
  if (!browser || !/^[0-9a-f-]{36}$/.test(browser)) {
    browser = randomUUID();
    cookies.set(CAPTURE_COOKIE, browser, { path: '/u', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 1800 });
  }
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
  return { profile: { slug: profile.slug, name: profile.displayName || 'Your new contact', headline: profile.headline, avatarUrl: profile.avatarUrl },
    captureToken: issueContactCaptureToken(profile.id, browser, url.searchParams.get('via')) };
};
export const actions: Actions = {
  default: async ({ params, request, url, cookies }) => {
    if (request.headers.get('origin') !== url.origin) return fail(403, { error: 'Please submit from this profile page.' });
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return fail(415, { error: 'Use the profile form to share your details.' });
    const body = await request.text();
    if (body.length > 8192) return fail(413, { error: 'Submission is too large.' });
    const form = new URLSearchParams(body);
    // Honeypot returns the same generic receipt without storing anything.
    if (form.get('website_check')) return { shared: true };
    const profile = await publishedCaptureProfile(params.slug);
    const values = { name: form.get('name') || '', email: form.get('email') || '', phone: form.get('phone') || '' };
    if (form.get('contactConsent') !== 'yes') return fail(400, { error: 'Please confirm how your details will be used.', values });
    try { validateContactDetails(values); } catch (e) { return fail(400, { error: (e as Error).message, values }); }
    let receipt;
    try { receipt = verifyContactCaptureToken(form.get('captureToken'), profile.id, cookies.get(CAPTURE_COOKIE) || ''); }
    catch { return fail(403, { error: 'This form has expired. Reload the page and try again.', values }); }
    try {
      await capturePrivateContact(profile, { ...values, ...receipt, browser: cookies.get(CAPTURE_COOKIE)! });
    } catch (e) {
      if (isHttpError(e)) return fail(e.status, { error: e.body.message, values });
      // Do not log the visitor payload or database error objects.
      return fail(503, { error: 'Could not save your details. Please retry this form.', values });
    }
    // Never expose a Contact ID, duplicate match, private data or account-linking hint to the visitor.
    return { shared: true };
  }
};
