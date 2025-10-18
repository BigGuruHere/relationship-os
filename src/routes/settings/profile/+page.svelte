<script lang="ts">
  // PURPOSE: edit your default shareable profile including flexible publicMeta JSON.
  export let data;
  export let form;

  const p = data.profile || {};
  let displayName = p.displayName || '';
  let headline = p.headline || '';
  let bio = p.bio || '';
  let avatarUrl = p.avatarUrl || '';
  let company = p.company || '';
  let title = p.title || '';
  let websiteUrl = p.websiteUrl || '';
  let emailPublic = p.emailPublic || '';
  let phonePublic = p.phonePublic || '';
  let kind = p.kind || 'business';

  // JSON editor for flexible extras stored in publicMeta
  let publicMetaJson =
    p.publicMeta
      ? JSON.stringify(p.publicMeta, null, 2)
      : `{
  "linkedin": "https://linkedin.com/in/you",
  "calendar": "https://cal.com/you",
  "extras": [
    { "label": "YouTube", "value": "youtube.com/@you", "href": "https://youtube.com/@you" }
  ]
}`;

const isFirstTime = typeof window !== 'undefined' && new URLSearchParams(location.search).get('first') === '1';

</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:720px; margin:0 auto;">
    <h1 style="margin:0 0 12px 0;">Profile</h1>
    {#if isFirstTime}
  <div style="margin:0 0 12px 0; padding:8px 10px; border:1px solid #e6e6e6; border-radius:10px; background:#fafafa;">
    Create your public profile, then we will show you how others will see it.
  </div>
{/if}

    <!-- Each label uses for= and the control has a matching id -->
    <form method="post" action="?/save" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="field"><label for="displayName">Name</label><input id="displayName" name="displayName" bind:value={displayName} /></div>
      <div class="field"><label for="headline">Headline</label><input id="headline" name="headline" bind:value={headline} /></div>
      <div class="field span2"><label for="bio">Bio</label><textarea id="bio" name="bio" rows="4" bind:value={bio}></textarea></div>
      <div class="field"><label for="avatarUrl">Avatar URL</label><input id="avatarUrl" name="avatarUrl" bind:value={avatarUrl} /></div>
      <div class="field"><label for="company">Company</label><input id="company" name="company" bind:value={company} /></div>
      <div class="field"><label for="title">Title</label><input id="title" name="title" bind:value={title} /></div>
      <div class="field"><label for="websiteUrl">Website</label><input id="websiteUrl" name="websiteUrl" bind:value={websiteUrl} /></div>
      <div class="field"><label for="emailPublic">Public email</label><input id="emailPublic" name="emailPublic" bind:value={emailPublic} /></div>
      <div class="field"><label for="phonePublic">Public phone</label><input id="phonePublic" name="phonePublic" bind:value={phonePublic} /></div>

      <div class="field">
        <label for="kind">Profile type</label>
        <select id="kind" name="kind" bind:value={kind}>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
          <option value="dating">Dating</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div class="field span2">
        <label for="publicMetaJson">Public extras (JSON)</label>
        <textarea id="publicMetaJson" name="publicMetaJson" rows="10" bind:value={publicMetaJson}></textarea>
        <div class="hint">
          Examples - linkedin, twitter, github, calendar, extras list of { label, value, href }.
          Leave empty to clear.
        </div>
      </div>

      <div style="grid-column: 1 / span 2; display:flex; gap:8px; margin-top:8px;">
        <button class="btn primary" type="submit">Save</button>
        <a class="btn" href="/share">Back to Share</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

<style>
  .field { display:flex; flex-direction:column; gap:6px; }
  .field input, .field textarea, .field select { padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-family:inherit; }
  .span2 { grid-column: 1 / span 2; }
  .hint { color:#666; font-size:0.9rem; margin-top:6px; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
</style>
