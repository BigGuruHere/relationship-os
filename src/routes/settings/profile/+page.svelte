<script lang="ts">
  // PURPOSE: edit your shareable profile with flexible extras from EXTRA_KEYS
  // SECURITY: only handles plain user-entered strings - no decryption here
  export let data;
  export let form;

  import { EXTRA_KEYS } from '$lib/publicProfile'; // IT: [{ key, label }]

  // IT: working profile from loader or defaults
  const p = data?.profile || {};

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
  let kind        = p.kind || 'business';

  // IT: extra inputs - one per EXTRA_KEYS entry
  const publicMeta = p.publicMeta || {};
  let extra_inputs: Record<string, string> = {};
  for (const spec of EXTRA_KEYS) {
    extra_inputs[spec.key] = typeof publicMeta[spec.key] === 'string' ? publicMeta[spec.key] : '';
  }

  // IT: first time banner flag from loader
  const isFirstTime = Boolean(data?.first);
</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:720px; margin:0 auto;">
    <h1 style="margin:0 0 12px 0;">{p?.id ? 'Edit profile' : 'Create profile'}</h1>
    <div class="note" style="margin-top:12px; margin-bottom:18px;">
      Your public link will be generated from your name on first save. You will be redirected to a public preview if this is your first time.
    </div>
    {#if isFirstTime}
      <div style="margin:0 0 12px 0; padding:8px 10px; border:1px solid #e6e6e6; border-radius:10px; background:#fafafa;">
        Create your public profile, then we will show you how others will see it.
      </div>
    {/if}

    <!-- IT: main editor form - named action `save` -->
    <form method="post" action="?/save" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
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

      <div class="field">
        <label for="avatarUrl">Avatar URL</label>
        <input id="avatarUrl" name="avatarUrl" bind:value={avatarUrl} placeholder="https://..." />
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

      <div class="field">
        <label for="kind">Profile type</label>
        <select id="kind" name="kind" bind:value={kind}>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
          <option value="dating">Dating</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <!-- IT: flexible extras - one input per known key -->
      {#each EXTRA_KEYS as spec (spec.key)}
        <div class="field">
          <label for={"extra_"+spec.key}>{spec.label}</label>
          <input id={"extra_"+spec.key} name={"extra_" + spec.key} bind:value={extra_inputs[spec.key]} />
        </div>
      {/each}

      <div style="grid-column: 1 / span 2; display:flex; gap:8px; margin-top:8px;">
        <button class="btn primary" type="submit">Save</button>
        <a class="btn" href="/share">Back to Share</a>
      </div>

      {#if form?.error}
        <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
      {/if}
    </form>


  </div>
</div>

<style>
  .field { display:flex; flex-direction:column; gap:6px; }
  .field input, .field textarea, .field select { padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-family:inherit; }
  .span2 { grid-column: 1 / span 2; }
  .note { color:#444; font-size:0.95rem; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
</style>
