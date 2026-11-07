<script lang="ts">
  // IT: Every Profile is independent. Its label is owner-facing and kind is secondary.
  export let data: any;
  const labels: Record<string, string> = { business: 'Business', personal: 'Friendship', dating: 'Dating', custom: 'Custom' };

  function profileTitle(profile: any) {
    // IT: Older profiles use the generic default label, so show a meaningful fallback.
    return profile.label && profile.label !== 'My profile'
      ? profile.label
      : profile.displayName || labels[profile.kind] || 'Profile';
  }
</script>

<svelte:head><title>My Profiles - Relish</title></svelte:head>

<div class="container profile-manager">
  <div class="profile-manager-top">
    <div>
      <h1>My Profiles</h1>
      <a href="/settings/channels">Phone and email verification</a>
      <p>Create as many separate profiles as you like. Give each one a name, then choose whether it is Business, Friendship or Dating. Each profile has its own link and QR code.</p>
    </div>
    <a class="btn primary" href="/settings/profile?mode=new&kind=business">Create Profile</a>
  </div>

  {#if data.profiles.length}
    <div class="profile-grid">
      {#each data.profiles as profile (profile.id)}
        <article class="card profile-card">
          <div class="profile-heading">
            <h2>{profileTitle(profile)}</h2>
            <span class="profile-kind">{labels[profile.kind] || profile.kind}</span>
          </div>
          {#if profile.displayName}<p class="public-name">Public name: {profile.displayName}</p>{/if}
          {#if profile.headline}<p>{profile.headline}</p>{/if}
          <p class:published={profile.isPublished} class="status">{profile.isPublished ? 'Published' : 'Unpublished'}</p>
          {#if !profile.isPublished}
            <a class="btn primary publish-profile" href={'/settings/profile?profile=' + encodeURIComponent(profile.slug) + '&kind=' + profile.kind + '&from=profiles'}>Review and publish</a>
          {/if}
          <div class="profile-actions">
            <a href={'/settings/profile?profile=' + encodeURIComponent(profile.slug) + '&kind=' + profile.kind + '&from=profiles'}>Edit</a>
            <a href={'/u/' + encodeURIComponent(profile.slug)}>Preview</a>
            {#if profile.isPublished}
              <a href={'/share?profile=' + encodeURIComponent(profile.slug)}>Share QR</a>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <p>No profiles yet. Create one to share your details with people you meet.</p>
  {/if}

  <h2>Connection requests</h2>
  <p>These people explicitly offered their contact details for follow-up. Their conversations with Dorian remain private.</p>
  {#if data.requests.length}
    <ul>
      {#each data.requests as request}
        <li><strong>{request.name}</strong> - {labels[request.domainKey === 'general' ? 'personal' : request.domainKey] || request.domainKey} -
          <a href={'mailto:' + encodeURIComponent(request.email)}>{request.email}</a> - {new Date(request.requestedAt).toLocaleDateString()}</li>
      {/each}
    </ul>
  {:else}
    <p>No connection requests yet.</p>
  {/if}
  <p><a href="/general/admin/product-intelligence">Product Intelligence (pilot owner)</a></p>
</div>

<style>
  .profile-manager { max-width: 950px; padding: 20px 12px; }
  .profile-manager-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
  .profile-manager-top > div { max-width: 670px; }
  .profile-manager-top h1 { margin-top: 0; }
  .profile-manager-top p { color: #52666b; }
  .profile-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(245px,1fr)); gap: 16px; margin-bottom: 28px; }
  .profile-card { padding: 20px; min-width: 0; }
  .profile-heading { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .profile-heading h2 { margin: 0; font-size: 1.15rem; overflow-wrap: anywhere; }
  .profile-kind { font-size: .78rem; color: #52666b; background: #edf4f3; border-radius: 12px; padding: 4px 9px; }
  .public-name { font-size: .9rem; color: #52666b; }
  .status { font-size: .84rem; color: #78672e; }
  .status.published { color: #16805d; }
  .publish-profile{display:inline-flex;align-items:center;min-height:44px;box-sizing:border-box;font-weight:700;}
  .profile-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
  .profile-actions a { font-weight: 600; }
  .btn { padding: 10px 14px; border: 1px solid #b9c7c5; border-radius: 10px; text-decoration: none; }
  .btn.primary { background: #173f3d; color: white; border-color: #173f3d; }
</style>
