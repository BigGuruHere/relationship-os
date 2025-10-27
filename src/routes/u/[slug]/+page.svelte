<script lang="ts">
  // src/routes/u/[slug]/+page.svelte
  // PURPOSE: public profile page - simplified sharing with social quick actions
  // SECURITY: only renders public strings provided by the server - no decryption here.

  export let data;
  export let form;

  import { headerFrom, publicRows, buildVcardUrl, EXTRA_KEYS } from '$lib/publicProfile';

  let editing = Boolean(data?.editingRequested);
  const prof = data?.profile || {};

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

  const publicLink = profileSlug ? data.origin + '/u/' + profileSlug : data.origin + '/u';

  $: hdr = headerFrom({ displayName, headline, avatarUrl, company, title });
  $: rows = publicRows({ websiteUrl, emailPublic, phonePublic, publicMeta });

  $: vcardUrl = buildVcardUrl(
    { displayName, company, title, emailPublic, phonePublic },
    publicLink
  );

  // IT: thanks flag - computed client side, guarded at render time with optional chaining
  let showThanks = false;
  if (typeof window !== 'undefined') {
    showThanks = new URLSearchParams(window.location.search).get('thanks') === '1';
  }

  // IT: derive quick-action buttons from rows that have hrefs - make common platforms feel native
  type Action = { label: string; href: string; key: string };
  $: quickActions = rows
    .filter(r => !!r.href)
    .map<Action>(r => {
      const href = r.href!;
      const lower = href.toLowerCase();
      const key =
        lower.includes('linkedin.com') ? 'linkedin' :
        lower.includes('twitter.com') || lower.includes('x.com') ? 'x' :
        lower.includes('instagram.com') ? 'instagram' :
        lower.includes('tiktok.com') ? 'tiktok' :
        lower.includes('youtube.com') ? 'youtube' :
        lower.startsWith('mailto:') ? 'email' :
        lower.startsWith('tel:') ? 'phone' :
        'link';
      const label =
        key === 'linkedin' ? 'Connect on LinkedIn' :
        key === 'x' ? 'Message on X' :
        key === 'instagram' ? 'Open Instagram' :
        key === 'tiktok' ? 'Open TikTok' :
        key === 'youtube' ? 'Open YouTube' :
        key === 'email' ? 'Send Email' :
        key === 'phone' ? 'Call' :
        r.label === 'Website' ? 'Open Website' : `Open ${r.label}`;
      return { label, href, key };
    });

  // IT: save vCard then submit hidden form to /api/guest/start which redirects to /u/<slug>/lead
  async function saveThenShare() {
    try {
      const a = document.createElement('a');
      a.href = vcardUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        const f = document.getElementById('start-share-form') as HTMLFormElement | null;
        if (f) f.submit();
      }, 400);
    } catch {
      window.location.href = `/u/${encodeURIComponent(data?.profile?.slug || data?.slugParam || '')}/lead`;
    }
  }
</script>

<div class="container">
  <div class="topbar" style="padding:10px 12px; max-width:720px; margin:0 auto 10px auto; position:relative; display:flex; align-items:center; gap:8px;">
    {#if data?.isOwner && profileSlug}
      <div class="helper-text">Note: Below is the screen that will be shown to those you share with.</div>
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
    {#if data?.isOwner}
      <form method="get" on:submit|preventDefault={() => (editing = !editing)}>
        <button type="submit" class="icon-btn" aria-label="Edit profile" title="Edit profile">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0 1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
          </svg>
        </button>
      </form>
    {/if}

    {#if data?.firstVisit}
      <div class="note" style="margin-bottom:10px;">
        Create profile - fill the fields below then save. This is what others will see.
      </div>
      {#if !editing}{@html (() => { editing = true; return '' })()}{/if}
    {/if}

    {#if showThanks}
      <div class="note" style="margin-bottom:10px;">
        Thanks - your details were shared with {ownerName}.
      </div>
    {/if}

    {#if !editing}
      <header style="display:flex; gap:12px; align-items:center;">
        {#if hdr.avatarUrl}<img src={hdr.avatarUrl} alt="Avatar" class="avatar" />{/if}
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

      <!-- IT: quick actions if any links are present -->
      {#if quickActions.length}
        <div class="btnrow" style="margin-top:12px;">
          {#each quickActions as a}
            <a class="btn outline" rel="noopener" target="_blank" href={a.href} aria-label={a.label} title={a.label}>
              {a.label}
            </a>
          {/each}
        </div>
      {/if}

      <!-- IT: contact and links table stays for completeness -->
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

      <!-- IT: traditional save contact flow -->
      <div class="btnrow" style="margin-top:12px;">
        <button class="btn primary" on:click|preventDefault={saveThenShare}>Save contact</button>
      </div>

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
      <!-- edit form unchanged -->
      <!-- ... your existing edit form code ... -->
    {/if}
  </div>
</div>

<style>
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
  .btn.outline { background:#fff; color:#111; border-color:#ccc; }
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
  .helper-text { color:#555; background:transparent; border:0; padding:0; }
  .topbar .btn.primary { background:#111; color:#fff; border-color:#111; }
  .topbar { background:#f9fafb; border:1px solid #eceef1; border-radius:10px; padding:10px 12px; box-shadow:0 2px 6px rgba(0,0,0,0.05); }
</style>
