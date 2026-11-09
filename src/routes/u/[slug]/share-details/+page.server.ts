import { saveProfileExchangeReturn } from '$lib/server/profileExchangeReturn';
import { saveExchange, readExchange, clearExchange, EXCHANGE_RETURN } from '$lib/server/exchangeOnboarding';
import { ownedExchangeChoices, confirmOwnedProfileExchange } from '$lib/server/foundation/exchangeClaims';
import { captureFoundationAccountExchange } from '$lib/server/foundation/capture';
import { accountDomain } from '$lib/server/foundation/provisioning';
import { exchangeBrowserEnabled } from '$lib/server/foundation/devPilotGate';
import { submissionChannels } from '$lib/server/foundation/exchangeCrypto';
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
  const exchangeAvailable = exchangeBrowserEnabled(locals, url.origin) &&
    await accountDomain(profile.userId) === 'ACTIVE';
  const ownedFlow = Boolean(locals.user && locals.user.id !== profile.userId && exchangeAvailable &&
    await accountDomain(locals.user.id) === 'ACTIVE');
  const choices = ownedFlow ? await ownedExchangeChoices(locals,profile.id,browser) : [];
  return { ownedFlow, choices, exchangeAvailable, canSignIn: !locals.user && exchangeAvailable, profile: { slug: profile.slug, name: profile.displayName || 'Your new contact', headline: profile.headline, avatarUrl: profile.avatarUrl },
    // IT: Save contact always arrives here; a successful prior share skips the form.
    canClaim: exchangeAvailable && readExchange(cookies)?.profileId === profile.id,
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
    // Owned-profile confirmation is isolated from anonymous capture and never sends an SMS.
    if (form.get('intent') === 'confirm-profile') {
      if (!exchangeBrowserEnabled(locals,url.origin) || !locals.user) return fail(403,{error:'Sign in to exchange profiles.'});
      const target=await publishedCaptureProfile(params.slug);
      try {
        // Bind the route target too, rather than accepting a preview copied from another card.
        const choicesToken=String(form.get('confirmation') || '');
        await confirmOwnedProfileExchange(locals,choicesToken,cookies.get(CAPTURE_COOKIE) || '',target.id);
      } catch { return fail(409,{error:'This exchange could not be completed. Reload to review current details. Archived or revoked contacts need recovery.'}); }
      rememberContactShare(cookies,url,target.id);
      throw redirect(303,'/people');
    }
    if(form.get('intent')==='signin-exchange') {
      const target=await publishedCaptureProfile(params.slug);
      if(!exchangeBrowserEnabled(locals,url.origin)) return fail(404,{error:'Exchange unavailable.'});
      saveProfileExchangeReturn(cookies,url,'visitor',target.slug);
      throw redirect(303,'/auth/login?next='+encodeURIComponent(EXCHANGE_RETURN));
    }
    if (form.get('intent') === 'new-exchange-profile') {
      const target=await publishedCaptureProfile(params.slug);
      if(!locals.user || !exchangeBrowserEnabled(locals,url.origin)) return fail(403,{error:'Sign in first.'});
      saveProfileExchangeReturn(cookies,url,locals.user.id,target.slug);
      throw redirect(303,'/settings/profile?mode=new&exchange=1');
    }
    // IT: Only the explicit third-screen button starts signup. It never creates another Contact.
    if (form.get('intent') === 'create-profile') {
      const selected = await publishedCaptureProfile(params.slug);
      const claim = readExchange(cookies);
      if(exchangeBrowserEnabled(locals, url.origin) && claim?.profileId===selected.id) {
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
    let details: ReturnType<typeof validateContactDetails>;
    try { details = validateContactDetails(values); } catch (e) { return fail(400, { error: (e as Error).message, values }); }
    if (!details.email && !details.phone) {
      return fail(400, { error: 'Enter an email address or mobile number.', values });
    }
    if (details.phone && details.phone.replace(/[^0-9]/g, '').length < 7) {
      return fail(400, { error: 'Enter a valid mobile number.', values });
    }
    // Self scans use the existing profile experience before creating any duplicate contact.
    if(locals.user?.id===profile.userId) throw redirect(303,'/profiles');
    let receipt;
    try { receipt = verifyContactCaptureToken(form.get('captureToken'), profile.id, cookies.get(CAPTURE_COOKIE) || ''); }
    catch { return fail(403, { error: 'This form has expired. Reload the page and try again.', values }); }
    try {
      const input = { ...values, ...receipt, captureToken: form.get('captureToken'), browser: cookies.get(CAPTURE_COOKIE)! };
      if (exchangeBrowserEnabled(locals, url.origin) && await accountDomain(profile.userId) === 'ACTIVE') {
        const channels = submissionChannels(details.phone, details.email);
        if (details.phone && !channels.some(channel => channel.type === 'PHONE')) {
          return fail(400, { error: 'Enter an Australian mobile number, or remove it and share your email address.', values });
        }
        const token = await captureFoundationAccountExchange(profile.id,input);
        if(token) saveExchange(cookies,url,token,profile.id,2);
      } else {
        await capturePrivateContact(profile,input);
        // A new ordinary capture must not offer proof for an older submission to this profile.
        if(readExchange(cookies)?.profileId===profile.id) clearExchange(cookies);
      }
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
