<script lang="ts">
  // src/routes/u/[slug]/+page.svelte
  // PURPOSE: public profile page with owner-only edit, logged-in user instant connect, and lead capture.
  // SECURITY: only renders public strings provided by the server - no decryption here.
  export let data: any;
  export let form: any;

  // IT: helper utilities for rendering and vCard link building
  import { headerFrom, publicRows, buildVcardUrl, EXTRA_KEYS } from '$lib/publicProfile';
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';


  // IT: start in edit mode if the server requested it
  let editing = Boolean(data?.isOwner && data?.editingRequested);

  // IT: seed fields from server profile or defaults
  const prof: any = data?.profile || {};
  const contextLabel = prof.kind === 'personal' ? 'Friendship' : prof.kind === 'dating' ? 'Dating' : 'Business';
  const isPilotKind = ['business', 'personal', 'dating'].includes(prof.kind);
  // The visitor sees one Dorian-first experience regardless of ContextSpace.
  $: isFirstContact = isPilotKind && prof.isPublished && !data?.isOwner && !editing;
  // Visibility is counted after browser render, not on server prefetch. No identity tracking on landing.
  onMount(() => {
    if (!data?.profile?.isPublished || !isPilotKind || data?.isOwner) return;
    void fetch('/api/pilot/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ slug: prof.slug,
        via: new URLSearchParams(window.location.search).get('via') }) }).catch(() => {});
  });

  // IT: derive a friendly owner name for the thanks banner
  const ownerName = (prof.displayName && prof.displayName.trim()) || 'the owner';

  let profileId   = prof.id || '';
  let profileSlug = prof.slug || (data?.owner && data.owner.slug) || data?.slugParam || '';
  let displayName = prof.displayName || '';
  let headline    = prof.headline || '';
  let bio         = prof.bio || '';
  let avatarUrl   = prof.avatarUrl || '';
  let company     = prof.company || '';
  let title       = prof.title || '';
  let websiteUrl  = prof.websiteUrl || '';
  let emailPublic = prof.emailPublic || '';
  let phonePublic = prof.phonePublic || '';
  let publicMeta  = prof.publicMeta || {};

  // IT: extras keyed by EXTRA_KEYS from helper
  let extra_inputs: Record<string, string> = {};
  for (const spec of EXTRA_KEYS) {
    extra_inputs[spec.key] = typeof publicMeta[spec.key] === 'string' ? publicMeta[spec.key] : '';
  }

  // IT: public link used for vCard note or source
  const publicLink = profileSlug ? data.origin + '/u/' + profileSlug : data.origin + '/u';

  // IT: derived header and rows for view mode
  $: hdr = headerFrom({ displayName, headline, avatarUrl, company, title });
  $: rows = publicRows({ websiteUrl, emailPublic, phonePublic, publicMeta });

  // IT: vCard url includes public link as a note or source tag depending on your helper
  $: vcardUrl = buildVcardUrl(
    { displayName, company, title, emailPublic, phonePublic },
    publicLink
  );

  // IT: compute the thanks flag safely in the browser
  let showThanks = false;
  if (typeof window !== 'undefined') {
    showThanks = new URLSearchParams(window.location.search).get('thanks') === '1';
  }

  // A server-generated invitation is returned to this enhanced form without a second page.
  // The visitor explicitly presses Send in the native messaging app.
  let smsOpening = false;
  $: issuedSms = form?.issued || null;
  $: smsHref = issuedSms ? `sms:${issuedSms.smsTo}?body=${encodeURIComponent(issuedSms.smsText)}` : '';
  function requestSms() {
    return async ({ result, update }: {result: any; update: () => Promise<void>}) => {
      await update();
      smsOpening = false;
      if (result.type === 'success' && result.data?.issued) {
        const outgoing = result.data.issued;
        window.location.href = `sms:${outgoing.smsTo}?body=${encodeURIComponent(outgoing.smsText)}`;
      }
    };
  }

  // IT: save vCard then submit hidden form to /api/guest/start which redirects to /u/<slug>/lead
  async function saveThenShare() {
    try {
      // IT: trigger a client-side vCard download for the owner
      const a = document.createElement('a');
      a.href = vcardUrl; // IT: reuse the computed vCard url
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();

      // IT: small delay so the download starts, then submit hidden form with inviteToken
      setTimeout(() => {
        const f = document.getElementById('start-share-form') as HTMLFormElement | null;
        if (f) f.submit();
      }, 400);
    } catch {
      // IT: if anything fails, fall back to direct navigation to lead page
      window.location.href = `/u/${encodeURIComponent(data?.profile?.slug || data?.slugParam || '')}/lead`;
    }
  }
</script>

<!-- Stage 8.19: the entire guest journey lives on this screen. No account, connection form or second call page. -->
{#if isFirstContact}
<svelte:head>
  <title>Meet Dorian | Relish</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>
<main class="first-contact">
  <div class="fc-brand">Relish</div>
  <section class="fc-dorian" aria-labelledby="dorian-title">
    <div class="fc-title-row">
      <div class="fc-symbol" aria-hidden="true">D</div>
      <div><h1 id="dorian-title">Meet Dorian</h1><p>Your AI networking partner</p></div>
    </div>
    <p class="fc-lead">I'd love to get to know you, understand what matters to you, and explore what we might make possible through people and relationships.</p>
    {#if data?.dorianMode === 'BROWSER'}
      <form method="post" action="?/startDorian">
        <button class="fc-primary" type="submit">Talk with Dorian</button>
      </form>
    {:else if data?.smsReady}
      {#if issuedSms}
        <a class="fc-primary" href={smsHref}>Open SMS to Dorian</a>
        <p class="fc-hint">Your phone should open Messages. Press Send. Dorian will then call you.</p>
        <details class="fc-details"><summary>SMS not opening?</summary>
          <p>Send <code>{issuedSms.smsText}</code> to <strong>{issuedSms.smsTo}</strong>. The reference is single-use and expires after {issuedSms.expiresMinutes} minutes.</p>
        </details>
      {:else}
        <form method="POST" action="?/requestDorian" use:enhance={requestSms}>
          <button class="fc-primary" type="submit" disabled={smsOpening} on:click={() => smsOpening = true}>
            {smsOpening ? 'Preparing your SMS…' : "Send Dorian a 'Call me' message"}
          </button>
        </form>
        <p class="fc-hint">Opens a prefilled SMS. You press Send, then Dorian calls you.</p>
      {/if}
    {:else}
      <p role="alert" class="fc-hint">Telephone calling is temporarily unavailable. Please try again later.</p>
    {/if}
    {#if form?.error}<p role="alert" class="fc-error">{form.error}</p>{/if}
    <details class="fc-details"><summary>More about Dorian</summary>
      <p>Dorian is an AI, not a human. He gets to know you over time, explores what matters to you and what you enjoy contributing, and may eventually help you find people who can support or collaborate with you. Introductions and private information-sharing require permission.</p>
      <p>Requesting a call uses your phone number to arrange the callback and support provisional future-call recognition. Your conversation is private to you, not shared with the person below. Relish provides the current <a href={data.pilotTerms.termsUrl} target="_blank" rel="noopener noreferrer">Terms</a> and <a href={data.pilotTerms.privacyUrl} target="_blank" rel="noopener noreferrer">Privacy Notice</a> by SMS. Dorian will ask for your agreement before substantive processing. Calls may involve recording and transcription if you agree. Carrier charges may apply.</p>
    </details>
  </section>
  <section class="fc-person" aria-label="Person who shared this invitation">
    <div class="fc-person-top">
      {#if avatarUrl}<img class="fc-photo" src={avatarUrl} alt="Photo of {ownerName}" />
      {:else}<div class="fc-photo fc-placeholder" aria-hidden="true">{ownerName.charAt(0).toUpperCase()}</div>{/if}
      <div class="fc-person-name"><strong>{ownerName}</strong><small>The person who introduced you to Dorian</small></div>
    </div>
    <details class="fc-details"><summary>View {ownerName}'s profile</summary>
      {#if headline}<p>{headline}</p>{/if}
      {#if bio}<p class="fc-bio">{bio}</p>{/if}
      {#if title || company}<p>{[title, company].filter(Boolean).join(' · ')}</p>{/if}
      {#each rows as r}<p class="fc-contact-row"><strong>{r.label}:</strong> {#if r.href}<a href={r.href} rel="noopener noreferrer">{r.value}</a>{:else}{r.value}{/if}</p>{/each}
    </details>
    <a class="fc-secondary" href={vcardUrl} download>Save {ownerName}'s contact</a>
  </section>
  <p class="fc-footer">Relish helps people develop and enrich their relationships. A scan or call does not share your private understanding with someone else.</p>
</main>
{:else}
<div class="container public-profile">
  <!-- IT: owner-facing context bar with return to Share on the right -->
  <div class="topbar" style="padding:10px 12px; max-width:720px; margin:0 auto 10px auto; position:relative; display:flex; align-items:center; gap:8px;">
    <!-- IT: helper text on the left -->
    {#if data?.isOwner && profileSlug}
      <div class="helper-text">
        Note: Below is the screen that will be shown to those you share with.
      </div>

      <!-- IT: flex child with margin-left:auto pushes itself to the right of the topbar -->
      <div style="margin-left:auto;">
        <a
          class="btn primary"
          href={'/share?profile=' + encodeURIComponent(profileSlug)}
          style="text-wrap:nowrap;"
          aria-label="Back to Share"
          title="Back to Share"
        >
          Back to Share
        </a>
      </div>
    {/if}
  </div>

  <div class="card page" style="padding:16px; max-width:720px; margin:0 auto; position:relative;">
    {#if isPilotKind}<p style="margin:0 0 12px"><strong>{contextLabel} profile</strong>{#if !prof.isPublished} - Unpublished (owner preview){/if}</p>{/if}
    {#if !data?.isOwner && isPilotKind && prof.isPublished}
      <section class="card" style="padding:16px;margin:12px 0;border:1px solid #ddd">
        <h2>Talk with Dorian</h2>
        {#if prof.kind === 'business'}
          <p>Explore what you're working on, what matters professionally, and whether you might be useful to one another.</p>
        {:else if prof.kind === 'personal'}
          <p>Get to know each other and discover what you might have in common.</p>
        {:else}
          <p>Explore whether you might enjoy getting to know each other, at your own pace.</p>
        {/if}
        <p>Dorian is an AI conversational partner. Your conversation is private to you and is not shared with this profile owner. We record basic usage to improve this pilot.</p>
        {#if data?.dorianMode === 'BROWSER'}
          <form method="post" action="?/startDorian"><button class="btn primary" type="submit">Talk to Dorian in browser</button></form>
        {:else}
          <a class="btn primary" href={'/u/' + encodeURIComponent(profileSlug) + '/call'}>Call Dorian by phone</a>
        {/if}
        {#if form?.error}<p role="alert">{form.error}</p>{/if}
      </section>
    {/if}

    <!-- IT: owner only edit icon - toggles edit mode on this page -->
    {#if data?.isOwner}
      <form method="get" on:submit|preventDefault={() => (editing = !editing)}>
        <button type="submit" class="icon-btn" aria-label="Edit profile" title="Edit profile">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0 1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
          </svg>
        </button>
      </form>
    {/if}

    <!-- IT: first time banner - auto switch into edit mode -->
    {#if data?.firstVisit}
      <div class="note" style="margin-bottom:10px;">
        Create profile - fill the fields below then save. This is what others will see.
      </div>
      {#if !editing}{@html (() => { editing = true; return '' })()}{/if}
    {/if}

    <!-- IT: thanks banner - shown after lead submit -->
    {#if showThanks}
      <div class="note" style="margin-bottom:10px;">
        Thanks - your details were shared with {ownerName}.
      </div>
    {/if}

    <!-- IT: LOGGED-IN USER DETECTION - show connect UI instead of lead capture -->
    {#if !data?.isOwner && data?.isVisitorLoggedIn && !editing && prof.kind === 'personal'}
      
      {#if data?.isSelfView}
        <!-- IT: visitor is viewing their own profile -->
        <div class="note" style="margin-bottom:10px; background:#f0f0f0; border-color:#d0d0d0;">
          This is your own profile. Share your link with others to connect.
        </div>
      
      {:else if data?.isAlreadyConnected}
        <!-- IT: visitor already connected -->
        <div class="note" style="margin-bottom:10px; background:#e8f5e9; border-color:#81c784;">
          ✓ You're already connected with {ownerName}
        </div>
      
      {:else}
        <!-- IT: visitor can instant-connect -->
        <div class="card" style="padding:14px; margin-bottom:12px; background:#e3f2fd; border:1px solid #64b5f6; border-radius:10px;">
          <p style="margin:0 0 10px 0; font-weight:500;">
            👋 You're both on Relish! Connect instantly.
          </p>
          
          {#if data?.profile?.kind === 'personal'}
            <a class="btn primary" href={'/network/join/' + encodeURIComponent(data.slugParam)} style="width:100%;justify-content:center;">Connect with {ownerName}</a>
          {/if}
          
          <p class="muted" style="margin:10px 0 0 0; font-size:0.9rem;">
            This will create contacts for both of you using your profile information.
          </p>
        </div>
      {/if}
    {/if}

    <!-- IT: view mode -->
    {#if !editing}
      <header style="display:flex; gap:12px; align-items:center;">
        {#if hdr.avatarUrl}
          <img src={hdr.avatarUrl} alt="Avatar" class="avatar" />
        {/if}
        <div>
          <h1 style="margin:0;">{hdr.name || 'Profile'}</h1>
          {#if hdr.headline}<div class="muted">{hdr.headline}</div>{/if}
          {#if hdr.company || hdr.title}
            <div class="muted small">
              {#if hdr.title}{hdr.title}{/if}{#if hdr.title && hdr.company} · {/if}{#if hdr.company}{hdr.company}{/if}
            </div>
          {/if}
        </div>
      </header>

      {#if bio}
        <div style="margin-top:12px; white-space:pre-wrap;">{bio}</div>
      {/if}

      <!-- IT: contact and links table -->
      {#if rows.length}
        <div class="info-grid" style="margin-top:12px;">
          {#each rows as r}
            <div class="info-row">
              <span class="label">{r.label}</span>
              {#if r.href}
                <a class="link" href={r.href} target={r.label === 'Website' ? '_blank' : undefined} rel="noopener">{r.value}</a>
              {:else}
                <span>{r.value}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- User deliberately chooses Connect here; authentication then completes it automatically. -->
      {#if !data?.isOwner && !data?.isVisitorLoggedIn && data?.profile?.kind === 'personal'}
        <div class="card" style="padding:14px; margin:12px 0;">
          <p>Want to stay connected on Relish?</p>
          <a class="btn primary" href={'/network/join/' + encodeURIComponent(data.slugParam)}>Connect on Relish</a>
        </div>
      {/if}
      <!-- Stage 8.18: saving a contact is independent of logging in or making a connection. -->
      {#if !data?.isOwner && prof.isPublished}
        <div class="btnrow" style="margin-top:16px;">
          <a class="btn primary" href={vcardUrl} download>Save contact to phone</a>
        </div>
        {#if prof.kind !== 'personal'}
          <form method="post" action="?/startDorian" style="margin-top:12px">
            <button class="btn" type="submit">Connect with {ownerName}</button>
          </form>
        {/if}
      {/if}

      {#if !data?.profile && !data?.isVisitorLoggedIn}
        <div class="note" style="margin-top:10px;">
          This profile is not set up yet.
          {#if data?.isOwner}Click the pencil icon to edit.{/if}
        </div>
      {/if}
    {:else}
      <!-- IT: edit mode - posts to the named save action -->
      <form method="post" action="?/save" class="grid">
        <input type="hidden" name="profileId" value={profileId} />
        <label><input type="checkbox" name="isPublished" checked={prof.isPublished !== false} /> Published publicly</label>

        <div class="field"><label for="displayName">Name</label><input id="displayName" name="displayName" bind:value={displayName} /></div>
        <div class="field"><label for="headline">Headline</label><input id="headline" name="headline" bind:value={headline} /></div>
        <div class="field span2"><label for="bio">Bio</label><textarea id="bio" name="bio" rows="4" bind:value={bio}></textarea></div>
        <div class="field"><label for="avatarUrl">Avatar URL</label><input id="avatarUrl" name="avatarUrl" bind:value={avatarUrl} /></div>
        <div class="field"><label for="company">Company</label><input id="company" name="company" bind:value={company} /></div>
        <div class="field"><label for="title">Title</label><input id="title" name="title" bind:value={title} /></div>
        <div class="field"><label for="websiteUrl">Website</label><input id="websiteUrl" name="websiteUrl" bind:value={websiteUrl} /></div>
        <div class="field"><label for="emailPublic">Public email</label><input id="emailPublic" name="emailPublic" bind:value={emailPublic} /></div>
        <div class="field"><label for="phonePublic">Public phone</label><input id="phonePublic" name="phonePublic" bind:value={phonePublic} /></div>

        <!-- IT: extra public links driven by helper keys -->
        {#each EXTRA_KEYS as spec}
          {#key spec.key}
            <div class="field">
              <label for={"extra_"+spec.key}>{spec.label}</label>
              <input id={"extra_"+spec.key} name={"extra_" + spec.key} bind:value={extra_inputs[spec.key]} />
            </div>
          {/key}
        {/each}

        <div class="btnrow" style="grid-column: 1 / span 2;">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn" type="button" on:click={() => (editing = false)}>Cancel</button>
        </div>

        {#if form?.error}
          <p style="color:var(--danger); margin-top:6px;">{form.error}</p>
        {/if}
      </form>
    {/if}
  </div>
</div>
{/if}

<style>
  /* Stage 8.19 guest layout uses its own narrow mobile-first viewport, not the old CRM grid. */
  :global(body) { overflow-x: clip; }
  .first-contact { width:100%; max-width:420px; margin:0 auto; padding:20px 14px 35px; box-sizing:border-box; min-width:0; overflow-wrap:anywhere; }
  .fc-brand { font-size:15px; font-weight:750; letter-spacing:.025em; margin-bottom:22px; }
  .fc-dorian { padding:20px; border-radius:20px; background:var(--surface, #fff); border:1px solid #d9e3e1; min-width:0; }
  .fc-title-row { display:flex; align-items:center; gap:13px; }
  .fc-symbol { width:53px; height:53px; flex-shrink:0; border-radius:50%; display:grid; place-items:center; background:#183e39; color:white; font-weight:800; font-size:25px; }
  .fc-title-row h1 { font-size:24px; letter-spacing:-.03em; line-height:1.2; margin:0 0 3px; }
  .fc-title-row p { margin:0; color:var(--muted, #536864); font-size:13px; }
  .fc-lead { font-size:15px; line-height:1.6; margin:20px 0; }
  .fc-primary,.fc-secondary { display:flex; align-items:center; justify-content:center; width:100%; box-sizing:border-box; min-height:49px; border-radius:12px; font-weight:650; font-size:15px; text-align:center; text-decoration:none; cursor:pointer; padding:10px 12px; }
  .fc-primary { border:1px solid #183e39; background:#183e39; color:#fff; }
  .fc-primary:disabled { opacity:.65; }
  .fc-secondary { background:transparent; border:1px solid #9fafac; color:inherit; margin-top:14px; }
  .fc-hint { color:var(--muted, #536864); font-size:12px; line-height:1.5; margin:10px 0 4px; }
  .fc-error { color:#b42318; font-size:14px; }
  .fc-details { margin-top:14px; padding-top:13px; border-top:1px solid #e2e8e6; font-size:13px; line-height:1.55; }
  .fc-details summary { cursor:pointer; font-weight:600; list-style-position:inside; }
  .fc-details p { margin:10px 0; }
  .fc-person { margin-top:14px; background:var(--surface, #fff); border:1px solid #dce3e0; border-radius:18px; padding:17px; min-width:0; }
  .fc-person-top { display:flex; align-items:center; gap:12px; min-width:0; }
  .fc-photo { height:53px; width:53px; flex:0 0 53px; object-fit:cover; border-radius:50%; }
  .fc-placeholder { background:#e5eae8; display:grid; place-items:center; font-size:19px; font-weight:700; }
  .fc-person-name { min-width:0; } .fc-person-name strong { display:block; overflow-wrap:anywhere; }
  .fc-person-name small { display:block; font-size:12px; color:var(--muted, #536864); margin-top:4px; }
  .fc-bio { white-space:pre-wrap; } .fc-contact-row { overflow-wrap:anywhere; }
  .fc-footer { text-align:center; font-size:11px; line-height:1.55; color:var(--muted, #536864); margin:20px 8px; }
  @media(max-width:400px) { .first-contact { padding:14px 10px 25px; } .fc-dorian { padding:16px; } }

  /* IT: simple page styles - align with your app.css tokens if you have them */
  .public-profile { width: 100%; max-width: 100vw; box-sizing: border-box; overflow-x: clip; }
  .public-profile :global(.page) { width: 100%; box-sizing: border-box; min-width: 0; }
  .public-profile .topbar { width: 100%; box-sizing: border-box; min-width: 0; }
  .public-profile header > div { min-width: 0; overflow-wrap: anywhere; }
  .info-row { flex-wrap: wrap; min-width: 0; overflow-wrap: anywhere; }
  @media (max-width: 520px) { .grid { grid-template-columns: minmax(0, 1fr) !important; } .span2 { grid-column: 1 !important; } }
  .avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; }
  .muted { color:#666; }
  .small { font-size:0.95rem; }
  .info-grid { display:grid; gap:6px; }
  .info-row { display:flex; gap:8px; align-items:center; }
  .label { width:72px; color:#666; font-size:0.95rem; }
  .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
  .btn {
    display:inline-flex; align-items:center; justify-content:center;
    height:36px; padding:0 12px; border:1px solid #ccc; border-radius:10px;
    text-decoration:none; background:#fff; color:inherit; line-height:1; cursor:pointer;
  }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
  .icon-btn {
    position:absolute; top:10px; right:10px;
    display:inline-flex; align-items:center; justify-content:center;
    width:32px; height:32px; border:1px solid #ddd; border-radius:10px; background:#fff; cursor:pointer;
  }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  .field { display:flex; flex-direction:column; gap:6px; }
  .field input, .field textarea { padding:8px 10px; border:1px solid #ddd; border-radius:10px; }
  .span2 { grid-column: 1 / span 2; }
  .note { background:#f6f7f8; border:1px solid #e3e4e6; border-radius:10px; padding:8px 10px; color:#444; }

  /* IT: make the helper text look like plain text */
  .helper-text {
    color: #555;
    background: transparent;
    border: 0;
    padding: 0;
  }

  /* IT: ensure the button reads as a primary action in the topbar */
  .topbar .btn.primary {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  .topbar {
    background: #f9fafb;
    border: 1px solid #eceef1;
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  }
</style>