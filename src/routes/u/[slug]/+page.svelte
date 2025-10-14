<script lang="ts">
  // PURPOSE: public profile page with owner-only edit.
  // RENDERS: all core fields plus extras defined in publicMeta.
  export let data;
  export let form;

  import { headerFrom, publicRows, buildVcardUrl, EXTRA_KEYS } from '$lib/publicProfile';

  let editing = Boolean(data.editingRequested);

  // Seed fields from server
  const prof = data.profile || {};
  let profileId   = prof.id || '';
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

  // Two example extras bound to inputs - add more by extending EXTRA_KEYS in the helper
  let extra_inputs: Record<string, string> = {};
  for (const spec of EXTRA_KEYS) {
    extra_inputs[spec.key] = typeof publicMeta[spec.key] === 'string' ? publicMeta[spec.key] : '';
  }

  const publicLink = data.origin + '/u/' + data.owner.slug;

  $: hdr = headerFrom({ displayName, headline, avatarUrl, company, title });
  $: rows = publicRows({ websiteUrl, emailPublic, phonePublic, publicMeta });

  $: vcardUrl = buildVcardUrl(
    { displayName, company, title, emailPublic, phonePublic },
    publicLink
  );
</script>



<div class="container">
  <div class="card page" style="padding:16px; max-width:720px; margin:0 auto; position:relative;">

    <!-- Owner only edit icon -->
    {#if data.isOwner}
      <form method="get" on:submit|preventDefault={() => (editing = !editing)}>
        <button type="submit" class="icon-btn" aria-label="Edit profile" title="Edit profile">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
          </svg>
        </button>
      </form>
    {/if}

    <!-- Create profile banner on first visit -->
    {#if data.firstVisit}
      <div class="note" style="margin-bottom:10px;">
        Create profile - fill the fields below then save. This is what others will see.
      </div>
      {#if !editing}{@html (() => { editing = true; return '' })()}{/if}
    {/if}

    <!-- View mode -->
    {#if !editing}
      <header style="display:flex; gap:12px; align-items:center;">
        {#if hdr.avatarUrl}
          <img src={hdr.avatarUrl} alt="Avatar" class="avatar" />
        {/if}
        <div>
          <h1 style="margin:0;">{hdr.name}</h1>
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

      <!-- Contact and links - driven by helper -->
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

      <div class="btnrow" style="margin-top:12px;">
        <a class="btn" href={vcardUrl}>Save contact</a>

        <form method="post" action="/api/guest/start" style="display:inline;">
          <input type="hidden" name="inviteToken" value={data.inviteToken} />
          <button class="btn" type="submit">Continue as guest</button>
        </form>

        {#if data.isOwner && data.profile && !data.profile.qrReady}
          <form method="post" action="/api/profile/generate-qr" style="display:inline;">
            <input type="hidden" name="profileId" value={profileId} />
            <button class="btn primary" type="submit">Generate QR</button>
          </form>
        {/if}
      </div>

      {#if !data.profile}
        <div class="note" style="margin-top:10px;">
          This profile is not set up yet.
          {#if data.isOwner}Click the pencil icon to edit.{/if}
        </div>
      {/if}
    {:else}
      <!-- Edit mode -->
<!-- Edit mode -->
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

  <!-- Extra public links - each label paired with a unique id -->
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
</style>
