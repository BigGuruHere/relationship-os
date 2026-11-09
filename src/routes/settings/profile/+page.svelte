<script lang="ts">
  // PURPOSE: edit your shareable profile with flexible extras from EXTRA_KEYS
  // SECURITY: only handles plain user-entered strings - no decryption here
  import { onMount } from 'svelte';
  export let data: any;
  export let form: any;

  import { EXTRA_KEYS } from '$lib/publicProfile'; // IT: [{ key, label }]

  let profileLabel = '', displayName = '', headline = '', bio = '', avatarUrl = '';
  let company = '', title = '', websiteUrl = '', emailPublic = '', phonePublic = '';
  let extra_inputs: Record<string, string> = {};
  let baseline = '';
  let ready = false;
  onMount(() => { ready = true; });

  // SvelteKit can reuse this editor when moving to another profile or after a save.
  function initialise(profile: any, draft: any) {
    profileLabel = profile.label && profile.label !== 'My profile' ? profile.label : profile.displayName || '';
    displayName = profile.displayName || draft?.name || '';
    headline = profile.headline || '';
    bio = profile.bio || '';
    avatarUrl = profile.avatarUrl || '';
    company = profile.company || '';
    title = profile.title || '';
    websiteUrl = profile.websiteUrl || '';
    emailPublic = profile.emailPublic || draft?.email || '';
    phonePublic = profile.phonePublic || draft?.phone || '';
    extra_inputs = Object.fromEntries(EXTRA_KEYS.map(({ key }) => [key, profile.publicMeta?.[key] || '']));
    baseline = JSON.stringify([profileLabel, displayName, headline, bio, avatarUrl, company, title,
      websiteUrl, emailPublic, phonePublic, extra_inputs]);
  }

  $: p = data?.profile || {};
  $: initialise(p, data?.draft);
  $: creating = !p.id || (data?.onboarding && !p.isPublished);
  $: kind = p.kind || data?.requestedProfileKind || 'business';
  $: changed = JSON.stringify([profileLabel, displayName, headline, bio, avatarUrl, company, title,
    websiteUrl, emailPublic, phonePublic, extra_inputs]) !== baseline;
  $: editorQuery = data?.editorQuery ? '&' + data.editorQuery : '';
  $: showSaveActions = creating || changed || !ready;

  let photoError = '';
  let photoBusy = false;
  // Resize locally to avoid ephemeral Railway filesystem storage or a new provider dependency.
  // Only the explicit profile image (not private photos) is saved as a compact JPEG data URL.
  async function uploadProfilePhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    photoError = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      photoError = 'Choose a JPEG, PNG or WebP photo smaller than 12 MB.'; return;
    }
    photoBusy = true;
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image editing unavailable');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let result = canvas.toDataURL('image/jpeg', 0.76);
      if (result.length > 320000) result = canvas.toDataURL('image/jpeg', 0.52);
      if (result.length > 320000) throw new Error('Photo could not be reduced enough. Choose a smaller image.');
      avatarUrl = result;
    } catch (error) {
      photoError = error instanceof Error ? error.message : 'Could not process this photo.';
    } finally { URL.revokeObjectURL(objectUrl); photoBusy = false; }
  }

</script>

<div class="card profile-card">
  <h1>{creating ? 'Create profile' : 'Edit profile'}</h1>
  {#if !creating}
    <aside class="publication-banner" aria-label="Profile publication status">
      <strong>{p.isPublished ? 'Published' : 'Unpublished'}</strong>
      {#if !changed && !data?.exchangeReturn}
        <form method="post" action={'?/publication' + editorQuery}>
          <input type="hidden" name="profileId" value={p.id} />
          <button class="btn" type="submit" name="publication" value={p.isPublished ? 'unpublish' : 'publish'}>
            {p.isPublished ? 'Unpublish' : 'Publish saved profile'}
          </button>
        </form>
      {/if}
    </aside>
  {/if}
  <!-- IT: main editor form - named action `save` -->
  <form id="profile-editor" method="post" action={'?/save' + editorQuery} class="profile-editor">
    {#if data?.exchangeReturn}<input type="hidden" name="returnToExchange" value="1" />{/if}
    {#if data?.returnContext}
      <!-- IT: Return to the same context after editing, never to a mismatched profile. -->
      <input type="hidden" name="returnContext" value={data.returnContext} />
    {/if}
    {#if data?.networkEntry}
      <!-- IT: explicit Network workflow flag, checked by the server. -->
      <input type="hidden" name="entry" value="network" />
    {/if}
    {#if data?.fromProfiles}
      <!-- IT: Editing from the manager returns to the manager, not an unrelated context. -->
      <input type="hidden" name="returnToProfiles" value="1" />
    {/if}
    {#if data?.creatingNew}
      <!-- IT: Explicitly create another profile even if this account has one of the same type. -->
      <input type="hidden" name="createNewProfile" value="1" />
      <input type="hidden" name="returnToProfiles" value="1" />
    {/if}
    {#if p?.id}
      <!-- IT: include for update path -->
      <input type="hidden" name="profileId" value={p.id} />
    {/if}

    <fieldset class="editor-section">
      <legend>Profile details</legend>
      <div class="field">
        <label for="displayName">Public name</label>
        <input id="displayName" name="displayName" bind:value={displayName} required />
      </div>

      <div class="field">
        <label for="headline">Headline</label>
        <input id="headline" name="headline" bind:value={headline} />
      </div>

      <div class="field span2">
        <label for="bio">Bio</label>
        <textarea id="bio" name="bio" rows="4" bind:value={bio}></textarea>
      </div>

      <div class="field span2">
        <label for="photoFile">Profile photo (specific to this profile)</label>
        {#if avatarUrl}<img src={avatarUrl} alt="Current profile" class="profile-photo-preview" />{/if}
        <input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp" on:change={uploadProfilePhoto} />
        <small>Choose a photo from your phone. It will be resized and shown when you publish this profile.</small>
        {#if photoBusy}<small>Preparing photo…</small>{/if}
        {#if photoError}<p role="alert">{photoError}</p>{/if}
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      <div class="field">
        <label for="company">Company</label>
        <input id="company" name="company" bind:value={company} />
      </div>

      <div class="field">
        <label for="title">Title</label>
        <input id="title" name="title" bind:value={title} />
      </div>

      <div class="field">
        <label for="profileLabel">Profile label (only you see this)</label>
        <input id="profileLabel" name="label" bind:value={profileLabel} maxlength="120" required={data?.creatingNew} placeholder="e.g. Thursday Networking" />
        <small>Use this name to choose which profile to share. Visitors see your public name.</small>
      </div>

      <!-- Contextual entry points still use the stored kind for legacy routing. -->
      <input type="hidden" name="kind" value={kind} />
    </fieldset>

    <fieldset class="editor-section">
      <legend>Public contact details</legend>
      <div class="field">
        <label for="emailPublic">Public email</label>
        <input id="emailPublic" name="emailPublic" type="email" bind:value={emailPublic} />
      </div>

      <div class="field">
        <label for="phonePublic">Public phone</label>
        <input id="phonePublic" name="phonePublic" type="tel" bind:value={phonePublic} />
      </div>
    </fieldset>

    <!-- Closed details keep the form short. Its named inputs still submit existing values. -->
    <details class="links">
      <summary>Website and social links</summary>
      <div class="editor-section">
        <div class="field">
          <label for="websiteUrl">Website</label>
          <input id="websiteUrl" name="websiteUrl" bind:value={websiteUrl} placeholder="https://..." />
        </div>

        <!-- IT: flexible extras - one input per known key -->
        {#each EXTRA_KEYS as spec (spec.key)}
          <div class="field">
            <label for={"extra_"+spec.key}>{spec.label}</label>
            <input id={"extra_"+spec.key} name={"extra_" + spec.key} bind:value={extra_inputs[spec.key]} />
          </div>
        {/each}
      </div>
    </details>

    {#if showSaveActions && p.isPublished}
      <small>Save for later unpublishes this profile and turns off its public link and QR code.</small>
    {/if}
    <div class="form-actions">
      {#if showSaveActions}
        <!-- The first submit is private, including when Enter submits a field. -->
        <button class="btn" type="submit" disabled={photoBusy}>Save for later</button>
        <button class="btn primary" type="submit" name="publishNow" value="yes" disabled={photoBusy}>Publish</button>
      {/if}
      <a class="btn" href={data?.exchangeReturn || "/profiles"}>{data?.exchangeReturn ? "Cancel and return to exchange" : "Back to profiles"}</a>
    </div>

    {#if form?.error}
      <p class="form-error" role="alert">{form.error}</p>
    {/if}
  </form>
</div>

<style>
  .profile-card { max-width: 720px; margin: 0 auto; padding: clamp(12px, 3vw, 24px); }
  h1 { margin: 0 0 12px; }
  .profile-editor { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .editor-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-inline-size: 0;
    margin: 0;
    padding: 12px;
    border: 1px solid var(--border, #ddd);
    border-radius: 12px;
  }
  legend { padding: 0 4px; font-weight: 700; }
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; }
  .field input, .field textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font: inherit;
  }
  .span2 { grid-column: 1 / -1; }
  .links summary { cursor: pointer; font-weight: 700; padding: 12px 0; }
  .links .editor-section { margin-top: 4px; }
  .publication-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    margin: 8px 0 16px;
    border: 1px solid #b9d5cc;
    border-radius: 10px;
    background: #edf7f2;
  }
  .profile-photo-preview { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; }
  .form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .form-error { margin: 0; color: var(--danger); }
  .btn { padding: 8px 12px; min-height: 44px; border: 1px solid #ccc; border-radius: 10px; text-decoration: none; }
  .btn.primary { background: #111; color: #fff; border-color: #111; }

  /* A full-width row always spans the explicit grid, even when the phone layout has one column. */
  @media (min-width: 851px) {
    .editor-section { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 540px) {
    .form-actions { display: grid; }
  }
</style>
