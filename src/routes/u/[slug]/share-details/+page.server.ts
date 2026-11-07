import { saveExchange, readExchange, EXCHANGE_RETURN } from '$lib/server/exchangeOnboarding';
import { captureFoundationExchange } from '$lib/server/foundation/capture';
import { accountDomain } from '$lib/server/foundation/provisioning';
import { exchangeBrowserEnabled } from '$lib/server/foundation/devPilotGate';
import { verificationPhone } from '$lib/server/foundation/exchangeCrypto';
import type { Actions, PageServerLoad } from './$types';
import { fail, isHttpError, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { publishedCaptureProfile, capturePrivateContact } from '$lib/server/core/contactCapture';
import { CAPTURE_COOKIE, issueContactCaptureToken, verifyContactCaptureToken } from '$lib/server/core/contactCaptureToken';
import { validateContactDetails } from '$lib/server/core/contacts';
import { profileDraft, saveProfileDraft, PROFILE_ONBOARDING_RETURN, hasSharedContact, rememberContactShare } from '$lib/server/profileOnboarding';
export const load: PageServerLoad = async ({ params, url, cookies, setHeaders, locals }) => {
  const profile = await publishedCaptureProfile(params.slug);
  let browser = cookies.get(CAPTURE_COOKIE);
  if (!browser || !/^[0-9a-f-]{36}$/.test(browser)) {
    browser = randomUUID();
    cookies.set(CAPTURE_COOKIE, browser, { path: '/u', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 1800 });
  }
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
  return { profile: { slug: profile.slug, name: profile.displayName || 'Your new contact', headline: profile.headline, avatarUrl: profile.avatarUrl },
    // IT: Save contact always arrives here; a successful prior share skips the form.
    canClaim: readExchange(cookies)?.profileId === profile.id,
    createStep: url.searchParams.get('step') === 'create' || hasSharedContact(cookies, profile.id), isSignedIn: Boolean(locals.user),
    captureToken: issueContactCaptureToken(profile.id, browser, url.searchParams.get('via')) };
};
export const actions: Actions = {
  default: async ({ params, request, url, cookies, locals }) => {
    if (request.headers.get('origin') !== url.origin) return fail(403, { error: 'Please submit from this profile page.' });
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return fail(415, { error: 'Use the profile form to share your details.' });
    const body = await request.text();
    if (body.length > 8192) return fail(413, { error: 'Submission is too large.' });
    const form = new URLSearchParams(body);
    // IT: Only the explicit third-screen button starts signup. It never creates another Contact.
    if (form.get('intent') === 'create-profile') {
      const selected = await publishedCaptureProfile(params.slug);
      const claim = readExchange(cookies);
      if(claim?.profileId===selected.id) {
        saveProfileDraft(cookies,url,profileDraft({name:form.get('name')||'',email:form.get('email')||'',phone:form.get('phone')||''}));
        throw redirect(303, EXCHANGE_RETURN);
      }
      if (locals.user) throw redirect(303, '/profiles');
      saveProfileDraft(cookies, url, profileDraft({ name: form.get('name') || '', email: form.get('email') || '', phone: form.get('phone') || '' }));
      throw redirect(303, '/auth/register?next=' + encodeURIComponent(PROFILE_ONBOARDING_RETURN));
    }
    // Honeypot returns the same generic receipt without storing anything.
    if (form.get('website_check')) return { shared: true };
    const profile = await publishedCaptureProfile(params.slug);
    const values = { name: form.get('name') || '', email: form.get('email') || '', phone: form.get('phone') || '' };
    if (form.get('contactConsent') !== 'yes') return fail(400, { error: 'Please confirm how your details will be used.', values });
    try { validateContactDetails(values); } catch (e) { return fail(400, { error: (e as Error).message, values }); }
    // Self scans use the existing profile experience before creating any duplicate contact.
    if(locals.user?.id===profile.userId) throw redirect(303,'/profiles');
    let receipt;
    try { receipt = verifyContactCaptureToken(form.get('captureToken'), profile.id, cookies.get(CAPTURE_COOKIE) || ''); }
    catch { return fail(403, { error: 'This form has expired. Reload the page and try again.', values }); }
    try {
      const input = { ...values, ...receipt, captureToken: form.get('captureToken'), browser: cookies.get(CAPTURE_COOKIE)! };
      let supported = false;
      try { verificationPhone(values.phone); supported = true; } catch { /* Ordinary capture accepts unsupported or missing channels. */ }
      if(supported && exchangeBrowserEnabled(locals,url.origin) && await accountDomain(profile.userId)==='ACTIVE') {
        const token = await captureFoundationExchange(profile.id,input);
        if(token) saveExchange(cookies,url,token,profile.id);
      } else await capturePrivateContact(profile,input);
    } catch (e) {
      if (isHttpError(e)) return fail(e.status, { error: e.body.message, values });
      // Do not log the visitor payload or database error objects.
      const reference = (e as { captureReference?: string })?.captureReference;
      return fail(503, { error: 'Could not save your details. Please retry this form.', values, reference: typeof reference === 'string' && /^[0-9a-f-]{36}$/.test(reference) ? reference : undefined });
    }
    // IT: Set only after storage succeeds. Skip, failed submissions and honeypots never count.
    rememberContactShare(cookies, url, profile.id);
    // Never expose a Contact ID, duplicate match, private data or account-linking hint to the visitor.
    return { shared: true, ...(readExchange(cookies)?.profileId===profile.id ? {canClaim:true} : {}), values: profileDraft(values) };
  }
};
