<script lang="ts">
  export let data: any;
  $: edit = '/settings/profile?kind=' + data.workspace.kind + (data.profile ? '&profile=' + encodeURIComponent(data.profile.slug) : '') + '&returnContext=' + data.workspace.name;
</script>
<svelte:head><title>My profile - {data.workspace.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">{data.workspace.label.toUpperCase()} / PROFILE</p><h1>My profile</h1>
  <p class="workspace-intro">Only information you explicitly publish in your {data.workspace.label.toLowerCase()} profile is visible to visitors.</p>
  <section class="workspace-panel">
    {#if data.profile}
      <h2>{data.profile.displayName || 'My profile'}</h2>
      <p>{data.profile.headline || 'Add a short introduction to your profile.'}</p>
      <p><strong>Status:</strong> {data.profile.isPublished ? 'Published' : 'Not published'}</p>
      <div class="workspace-buttons"><a class="btn primary" href={edit}>Edit profile</a>
        <a class="btn" href={'/u/' + encodeURIComponent(data.profile.slug)}>Preview</a>
        {#if data.profile.isPublished}<a class="btn" href={'/space/' + data.workspace.name + '/share'}>Share QR</a>{/if}
      </div>
    {:else}
      <h2>Create your {data.workspace.label.toLowerCase()} profile</h2>
      <p>Your other profiles and private context data will stay separate.</p>
      <a class="btn primary" href={edit}>Create profile</a>
    {/if}
  </section>
</div>
