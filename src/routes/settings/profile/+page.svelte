<script lang="ts">
  // PURPOSE: edit your shareable profile with flexible extras from EXTRA_KEYS
  // SECURITY: only handles plain user-entered strings - no decryption here
  export let data: any;
  export let form: any;

  import { EXTRA_KEYS } from '$lib/publicProfile'; // IT: [{ key, label }]

  // IT: working profile from loader or defaults
  const p: any = data?.profile || {};
  // IT: Label is an owner-facing name, separate from the profile's public display name.
  let profileLabel = p.label && p.label !== 'My profile' ? p.label : (p.displayName || '');

  // IT: core public fields
  let displayName = p.displayName || data?.draft?.name || '';
  let headline    = p.headline || '';
  let bio         = p.bio || '';
  let avatarUrl   = p.avatarUrl || '';
  let company     = p.company || '';
  let title       = p.title || '';
  let websiteUrl  = p.websiteUrl || '';
  let emailPublic = p.emailPublic || data?.draft?.email || '';
  let phonePublic = p.phonePublic || data?.draft?.phone || '';
  let kind        = p.kind || data?.requestedProfileKind || 'business';

  // IT: extra inputs - one per EXTRA_KEYS entry
  const publicMeta = p.publicMeta || {};
  let extra_inputs: Record<string, string> = {};
  for (const spec of EXTRA_KEYS) {
    extra_inputs[spec.key] = typeof publicMeta[spec.key] === 'string' ? publicMeta[spec.key] : '';
  }

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
  <h1>{p?.id ? 'Edit profile' : 'Create profile'}</h1>
  {#if p.isPublished === false || !p.id}
    <!-- Submit the existing editor, including unsaved fields and its normal validation. -->
    <aside class="publication-banner" aria-label="Profile publication status">
      <div>
        <strong>Your profile is unpublished</strong>
        <p>{data?.onboarding ? 'Review your details, then publish when you’re ready to share your link and QR code.' : 'Publish it to make your profile link and QR code available.'}</p>
      </div>
      <button class="btn primary" type="submit" form="profile-editor" name="publishNow" value="yes">Publish profile</button>
    </aside>
  {/if}
  <!-- IT: main editor form - named action `save` -->
  <form id="profile-editor" method="post" action={data?.onboarding ? "?/save&onboarding=1" : "?/save"} class="profile-editor">
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
        <small>Choose a photo from your phone. It will be resized and displayed publicly on this profile only.</small>
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

      <div class="field">
        <label for="kind">Profile type</label>
        <select id="kind" name="kind" bind:value={kind} disabled={data?.networkEntry || !!p.id}>
          <option value="business">Business</option>
          <option value="personal">Friendship</option>
          <option value="dating">Dating</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {#if p.id || data?.networkEntry}<input type="hidden" name="kind" value={kind} />{/if}
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

    <div class="publication-setting">
      <label class="checkbox-label"><input type="checkbox" name="isPublished" checked={p?.id ? p.isPublished !== false : !data?.creatingNew && !data?.onboarding} /> Published publicly</label>
      <small>Turn this off to hide your profile and its QR link.</small>
    </div>
    <div class="form-actions">
      <button class="btn primary" type="submit">Save profile</button>
      <a class="btn" href={data?.exchangeReturn || "/profiles"}>{data?.exchangeReturn ? "Cancel and return to exchange" : "Back to My Profiles"}</a>
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
  .field input, .field textarea, .field select {
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
  .publication-setting { display: grid; gap: 4px; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .checkbox-label input { flex: none; width: auto; margin: 0; }
  .publication-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px;
    margin: 16px 0 22px;
    border: 2px solid #256457;
    border-radius: 12px;
    background: #edf7f2;
  }
  .publication-banner p { margin: 6px 0 0; line-height: 1.5; }
  .publication-banner button { min-height: 48px; font-weight: 700; }
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
    .publication-banner button { width: 100%; }
  }
</style>
