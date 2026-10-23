<script lang="ts">
  export let data: any;
</script>
<svelte:head><title>Settings - {data.workspace.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">{data.workspace.label.toUpperCase()} / SETTINGS</p><h1>Settings</h1>
  <p class="workspace-intro">These are settings for your {data.workspace.label.toLowerCase()} context only.</p>
  <section class="workspace-panel">
    <h2>Public profile</h2>
    <p>{data.profile?.isPublished ? 'Published - people with the link can view this public profile.' : 'Not published - visitors cannot open this profile.'}</p>
    <a class="btn primary" href={'/space/' + data.workspace.name + '/profile'}>Manage profile and visibility</a>
  </section>
  <section class="workspace-panel">
    <h2>Connections and Dorian</h2>
    <p>Connection acceptance preferences and the phone-versus-browser conversation setting will be added when their end-to-end behaviour is implemented. No automatic acceptance or outbound calling is enabled by this UI stage.</p>
  </section>
  <section class="workspace-panel">
    <h2>Account</h2><p>Manage your sign-in separately from the information you share in this context.</p>
    <form method="POST" action="/auth/logout"><button class="btn" type="submit">Sign out</button></form>
  </section>
</div>
