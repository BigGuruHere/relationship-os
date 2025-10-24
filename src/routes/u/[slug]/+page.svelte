<script lang="ts">
  // src/routes/u/[slug]/+page.svelte
  // PURPOSE: public profile page with owner-only edit and LinkedIn-first flow
  // SECURITY: only renders public strings provided by the server - no decryption here. All DOM access guarded by browser flag.

  export let data;
  export let form;

  // IT: helper utilities for rendering and vCard link building
  import { headerFrom, publicRows, buildVcardUrl, EXTRA_KEYS, pickLinkedInUrlFromProfile } from '$lib/publicProfile';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // IT: start in edit mode if the server requested it
  let editing = Boolean(data?.editingRequested);

  // IT: seed fields from server profile or defaults
  const prof = data?.profile || {};

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

  // IT: LinkedIn url for the alternate flow
  let linkedinUrl = pickLinkedInUrlFromProfile({ websiteUrl, publicMeta });

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

  // IT: compute the thanks flag only on the client
  let showThanks = false;
  if (browser) {
    showThanks = new URLSearchParams(window.location.search).get('thanks') === '1';
  }

  // IT: save vCard then submit hidden form to /api/guest/start which redirects to /u/<slug>/lead
  async function saveThenShare() {
    if (!browser) return; // SSR guard
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

  // -----------------------------
  // LinkedIn-first alternate flow
  // -----------------------------

  // IT: state to avoid double resume
  let liOpened = false;
  let liResumed = false;

  // IT: call backend to record the LinkedIn click, then open LinkedIn in a new tab
  async function saveToLinkedIn() {
    if (!browser) return; // SSR guard
    if (!linkedinUrl) return;
    if (liOpened) return;
    liOpened = true;

    const payload = JSON.stringify({ linkedinUrl, ownerSlug: profileSlug });

    // IT: use sendBeacon to reduce the chance of losing the POST if navigation happens quickly
    let sent = false;
    try {
      if ('sendBeacon' in navigator) {
        const ok = navigator.sendBeacon('/api/share/linkedin', new Blob([payload], { type: 'application/json' }));
        sent = ok;
      }
    } catch {
      // ignore
    }

    if (!sent) {
      try {
        await fetch('/api/share/linkedin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
          keepalive: true
        });
      } catch {
        // swallow - do not block user
      }
    }

    // IT: open LinkedIn in a new tab so our page stays alive to catch focus when user returns
    const win = window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      // IT: if popup blocked, navigate current tab as a fallback
      window.location.href = linkedinUrl;
    }
  }

  // IT: when the page regains focus or becomes visible, resume once to thank-you with a ref marker
  function maybeResumeFromLinkedIn() {
    if (!browser) return; // SSR guard
    if (liResumed) return;
    if (document.visibilityState === 'visible') {
      liResumed = true;
      window.location.assign('/thank-you?ref=linkedin');
    }
  }
  const onVis = () => maybeResumeFromLinkedIn();
  const onFocus = () => maybeResumeFromLinkedIn();

  onMount(() => {
    // IT: only attach listeners in the browser
    if (!browser) return;
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
  });
  onDestroy(() => {
    if (!browser) return;
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);
  });
</script>

<div class="container">
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

      <!-- IT: public actions -->
      <div class="btnrow" style="margin-top:12px;">
        <!-- IT: LinkedIn-first share - only show if a linkedin url is available -->
        {#if linkedinUrl}
          <button class="btn" on:click|preventDefault={saveToLinkedIn}>Connect on LinkedIn</button>
        {/if}

        <!-- IT: traditional save contact flow stays available -->
        <button class="btn primary" on:click|preventDefault={saveThenShare}>Save contact</button>
      </div>

      <!-- IT: hidden form that will post to start guest flow and redirect to /u/<slug>/lead -->
      <form id="start-share-form" method="post" action="/api/guest/start" style="display:none;">
        <input type="hidden" name="inviteToken" value={data?.inviteToken} />
      </form>

      {#if !data?.profile}
        <div class="note" style="margin-top:10px;">
          This profile is not set up yet.
          {#if data?.isOwner}Click the pencil icon to edit.{/if}
        </div>
      {/if}
    {:else}
      <!-- IT: edit mode - posts to the named save action -->
      <form method="post" action="?/save" class="grid">
        <input type="hidden" name="profileId" value={profileId} />

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

<style>
  /* IT: simple page styles - align with your app.css tokens if you have them */
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
  .topbar .note { background:#f9fafb; border-color:#eceef1; }

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
