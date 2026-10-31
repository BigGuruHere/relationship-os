<script lang="ts">
  // PURPOSE: edit your shareable profile with flexible extras from EXTRA_KEYS
  // SECURITY: only handles plain user-entered strings - no decryption here
  export let data: any;
  export let form: any;

  import { EXTRA_KEYS } from '$lib/publicProfile'; // IT: [{ key, label }]

  // IT: working profile from loader or defaults
  const p: any = data?.profile || {};

  // IT: core public fields
  let displayName = p.displayName || '';
  let headline    = p.headline || '';
  let bio         = p.bio || '';
  let avatarUrl   = p.avatarUrl || '';
  let company     = p.company || '';
  let title       = p.title || '';
  let websiteUrl  = p.websiteUrl || '';
  let emailPublic = p.emailPublic || '';
  let phonePublic = p.phonePublic || '';
  let kind        = p.kind || data?.requestedProfileKind || 'business';

  // IT: extra inputs - one per EXTRA_KEYS entry
  const publicMeta = p.publicMeta || {};
  let extra_inputs: Record<string, string> = {};
  for (const spec of EXTRA_KEYS) {
    extra_inputs[spec.key] = typeof publicMeta[spec.key] === 'string' ? publicMeta[spec.key] : '';
  }

  // IT: first time banner flag from loader
  const isFirstTime = Boolean(data?.first);

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

<div class="container">
  <div class="card" style="padding:16px; max-width:720px; margin:0 auto;">
    <h1 style="margin:0 0 12px 0;">{p?.id ? 'Edit profile' : 'Create profile'}</h1>

    {#if isFirstTime}
      <div style="margin:0 0 12px 0; padding:8px 10px; border:1px solid #e6e6e6; border-radius:10px; background:#fafafa;">
        Create your public profile, then we will show you how others will see it.
      </div>
    {/if}

    <!-- IT: main editor form - named action `save` -->
    <form method="post" action="?/save" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      {#if data?.returnContext}
        <!-- IT: Return to the same context after editing, never to a mismatched profile. -->
        <input type="hidden" name="returnContext" value={data.returnContext} />
      {/if}
      {#if data?.networkEntry}
        <!-- IT: explicit Network workflow flag, checked by the server. -->
        <input type="hidden" name="entry" value="network" />
      {/if}
      {#if p?.id}
        <!-- IT: include for update path -->
        <input type="hidden" name="profileId" value={p.id} />
      {/if}

      <div class="field">
        <label for="displayName">Name</label>
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
        <label for="websiteUrl">Website</label>
        <input id="websiteUrl" name="websiteUrl" bind:value={websiteUrl} placeholder="https://..." />
      </div>

      <div class="field">
        <label for="emailPublic">Public email</label>
        <input id="emailPublic" name="emailPublic" type="email" bind:value={emailPublic} />
      </div>

      <div class="field">
        <label for="phonePublic">Public phone</label>
        <input id="phonePublic" name="phonePublic" bind:value={phonePublic} />
      </div>

      <div class="field span2">
        <label><input type="checkbox" name="isPublished" checked={p.isPublished !== false} /> Published publicly</label>
        <small>Uncheck to hide this profile and disable its public QR destination.</small>
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

      <!-- IT: flexible extras - one input per known key -->
      {#each EXTRA_KEYS as spec (spec.key)}
        <div class="field">
          <label for={"extra_"+spec.key}>{spec.label}</label>
          <input id={"extra_"+spec.key} name={"extra_" + spec.key} bind:value={extra_inputs[spec.key]} />
        </div>
      {/each}

      <div style="grid-column: 1 / span 2; display:flex; gap:8px; margin-top:8px;">
        <button class="btn primary" type="submit">Save</button>
      </div>

      {#if form?.error}
        <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
      {/if}
    </form>


  </div>
</div>

<style>
  .profile-photo-preview { width:76px; height:76px; border-radius:50%; object-fit:cover; }
  @media(max-width:540px){form{grid-template-columns:minmax(0,1fr)!important;} .span2{grid-column:1!important;} input,textarea,select{min-width:0;max-width:100%;box-sizing:border-box;} }
  .field { display:flex; flex-direction:column; gap:6px; }
  .field input, .field textarea, .field select { padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-family:inherit; }
  .span2 { grid-column: 1 / span 2; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
</style>
