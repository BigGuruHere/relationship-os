<script lang="ts">
  // IT: Every Profile is independent. Its label is owner-facing and kind is secondary.
  export let data: any;

  function profileTitle(profile: any) {
    // IT: Older profiles use the generic default label, so show a meaningful fallback.
    return profile.label && profile.label !== 'My profile'
      ? profile.label
      : profile.displayName || 'Profile';
  }
</script>

<svelte:head><title>My Profiles - Relish</title></svelte:head>

<div class="container profile-manager">
  <div class="profile-manager-top">
    <div>
      <h1>My Profiles</h1>
      {#if data.channelsAvailable}<a href="/settings/channels">Phone and email verification</a>{/if}
      <p>Create as many separate profiles as you like. Give each one a name you’ll recognise. Each profile has its own link and QR code.</p>
    </div>
    <a class="btn primary" href="/settings/profile?mode=new">Create Profile</a>
  </div>

  {#if data.profiles.length}
    <div class="profile-grid">
      {#each data.profiles as profile (profile.id)}
        <article class="card profile-card">
          <div class="profile-heading">
            <h2>{profileTitle(profile)}</h2>
          </div>
          {#if profile.displayName}<p class="public-name">Public name: {profile.displayName}</p>{/if}
          {#if profile.headline}<p>{profile.headline}</p>{/if}
          <p class:published={profile.isPublished} class="status">{profile.isPublished ? 'Published' : 'Unpublished'}</p>
          {#if !profile.isPublished}
            <a class="btn primary publish-profile" href={'/settings/profile?profile=' + encodeURIComponent(profile.slug) + '&from=profiles'}>Review and publish</a>
          {/if}
          <div class="profile-actions">
            <a href={'/settings/profile?profile=' + encodeURIComponent(profile.slug) + '&from=profiles'}>Edit</a>
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
  .public-name { font-size: .9rem; color: #52666b; }
  .status { font-size: .84rem; color: #78672e; }
  .status.published { color: #16805d; }
  .publish-profile{display:inline-flex;align-items:center;min-height:44px;box-sizing:border-box;font-weight:700;}
  .profile-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
  .profile-actions a { font-weight: 600; }
  .btn { padding: 10px 14px; border: 1px solid #b9c7c5; border-radius: 10px; text-decoration: none; }
  .btn.primary { background: #173f3d; color: white; border-color: #173f3d; }
</style>
