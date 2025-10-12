<script lang="ts">
    // PURPOSE: edit your default shareable profile
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
  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:720px; margin:0 auto;">
      <h1 style="margin:0 0 12px 0;">Profile</h1>
  
      <form method="post" action="?/save" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div class="field"><label>Name</label><input name="displayName" bind:value={displayName} /></div>
        <div class="field"><label>Headline</label><input name="headline" bind:value={headline} /></div>
        <div class="field" style="grid-column: 1 / span 2;"><label>Bio</label><textarea name="bio" rows="4" bind:value={bio}></textarea></div>
        <div class="field"><label>Avatar URL</label><input name="avatarUrl" bind:value={avatarUrl} /></div>
        <div class="field"><label>Company</label><input name="company" bind:value={company} /></div>
        <div class="field"><label>Title</label><input name="title" bind:value={title} /></div>
        <div class="field"><label>Website</label><input name="websiteUrl" bind:value={websiteUrl} /></div>
        <div class="field"><label>Public email</label><input name="emailPublic" bind:value={emailPublic} /></div>
        <div class="field"><label>Public phone</label><input name="phonePublic" bind:value={phonePublic} /></div>
        <div class="field">
          <label>Profile type</label>
          <select name="kind" bind:value={kind}>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
            <option value="dating">Dating</option>
            <option value="custom">Custom</option>
          </select>
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
    .field input, .field textarea, .field select { padding:8px 10px; border:1px solid #ddd; border-radius:10px; }
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
  </style>
  