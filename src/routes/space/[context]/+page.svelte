<script lang="ts">
  // Stage 8.17 - Common home structure for the three distinct Relish experiences.
  export let data: any;
  $: space = data.workspace;
  $: base = '/space/' + space.name;
  $: hasMissingSpaces = (data.visibleSpaces || []).some((entry: any) => !entry.configured);
</script>
<svelte:head><title>{space.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">MY RELISH / {space.label.toUpperCase()}</p>
  <h1>{space.label}</h1>
  <p class="workspace-intro">{space.description}. The information in this area stays within its own context.</p>
  {#if data.accountRole === 'owner' && hasMissingSpaces}
    <section class="workspace-panel" style="border-left:4px solid var(--workspace-accent)">
      <h2>Set up your three Relish contexts</h2>
      <p>Create any missing Business, Friendship and Dating spaces. Existing information stays in its current context.</p>
      <form method="POST" action="?/setupAll"><button class="btn primary" type="submit">Set up missing contexts</button></form>
    </section>
  {/if}
  {#if !space.configured}
    <section class="workspace-panel">
      <h2>Set up {space.label}</h2>
      <p>This private context has not been created yet. Your other contexts are unaffected.</p>
      <form method="POST" action="?/setup"><button class="btn primary" type="submit">Create {space.label} space</button></form>
    </section>
  {:else}
    <div class="workspace-tiles">
      <a class="workspace-panel workspace-tile" href={base + '/profile'}>
        <span class="workspace-tile-icon">◉</span><h2>My profile</h2>
        <p>{data.profile ? data.profile.displayName || 'Your profile' : 'Create the profile you will share'}</p>
        <span class="workspace-tile-action">View profile →</span>
      </a>
      <a class="workspace-panel workspace-tile" href={base + '/share'}>
        <span class="workspace-tile-icon">▦</span><h2>Share</h2>
        <p>Your {space.label.toLowerCase()} QR code and public link</p>
        <span class="workspace-tile-action">Open sharing →</span>
      </a>
      <a class="workspace-panel workspace-tile" href={base + '/people'}>
        <span class="workspace-tile-icon">♧</span><h2>People</h2>
        <p>{data.pendingCount ? `${data.pendingCount} recent requests to review` : 'People you connect with'}</p>
        <span class="workspace-tile-action">See people →</span>
      </a>
      <a class="workspace-panel workspace-tile" href={base + '/settings'}>
        <span class="workspace-tile-icon">⚙</span><h2>Settings</h2>
        <p>Manage this context and its public profile</p>
        <span class="workspace-tile-action">Open settings →</span>
      </a>
    </div>
    {#if data.people.length}
      <section class="workspace-panel workspace-recent">
        <h2>Recent connections and requests</h2>
        {#each data.people as person}
          <div class="workspace-person"><strong>{person.name}</strong><span>{person.status === 'REQUESTED' ? 'Requested connection' : 'Connected'}</span></div>
        {/each}
        <a href={base + '/people'}>View all people →</a>
      </section>
    {/if}
  {/if}
</div>
