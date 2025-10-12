<script lang="ts">
    // PURPOSE: show the public profile plus actions
    export let data;
  
    // Fallback text if no profile exists yet
    const p = data.profile || {};

  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:640px; margin:0 auto;">
      <div style="display:flex; gap:12px; align-items:center;">
        {#if p.avatarUrl}
          <img src={p.avatarUrl} alt="Avatar" style="width:64px; height:64px; border-radius:50%; object-fit:cover;" />
        {/if}
        <div>
          <h1 style="margin:0;">{p.displayName || 'Public profile'}</h1>
          {#if !data.profile}
        <div style="margin-top:8px; color:#666;">This profile is not set up yet.</div>
        {/if}
          {#if p.headline}<div style="color:#666;">{p.headline}</div>{/if}
          {#if p.company || p.title}
            <div style="color:#666; font-size:0.95rem;">
              {#if p.title}{p.title}{/if}{#if p.title && p.company} · {/if}{#if p.company}{p.company}{/if}
            </div>
          {/if}
        </div>
      </div>
  
      {#if p.bio}
        <div style="margin-top:12px; white-space:pre-wrap;">{p.bio}</div>
      {/if}
  
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        <!-- vCard for easy save -->
        <a class="btn" href={"/api/vcard?name=" + encodeURIComponent(p.displayName || 'Contact') + "&link=" + encodeURIComponent(location.origin + '/u/' + data.owner.slug)}>
          Save contact
        </a>
  
        <!-- Share details - posts to your existing leads endpoint -->
        <form method="post" action="/api/guest/start" style="display:inline;">
          <input type="hidden" name="inviteToken" value={data.inviteToken} />
          <button class="btn" type="submit">Continue as guest</button>
        </form>
  
        <a class="btn" href={"/share"}>Get your own link</a>
      </div>
  
      <div style="margin-top:12px; color:#666; font-size:0.95rem;">
        {#if p.emailPublic}<div>Email: {p.emailPublic}</div>{/if}
        {#if p.phonePublic}<div>Phone: {p.phonePublic}</div>{/if}
        {#if p.websiteUrl}<div>Website: <a class="link" href={p.websiteUrl} target="_blank" rel="noopener">{p.websiteUrl}</a></div>{/if}
      </div>
    </div>
  </div>
  
  <style>
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  </style>
  