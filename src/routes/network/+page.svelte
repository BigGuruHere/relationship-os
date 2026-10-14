<script lang="ts">
  // PURPOSE: Minimal Network pilot entry, without exposing operator or ContextSpace tooling.
  export let data: {
    profile: { slug: string; displayName: string | null; headline: string | null } | null;
    hasNetworkContext: boolean;
  };
</script>
<svelte:head><title>Network - Relish</title></svelte:head>
<div class="container" style="max-width:760px;padding:20px 12px">
  <h1>Your Network</h1>
  <p>Meet people. Stay connected. Discover what becomes possible.</p>
  <section class="card" style="padding:20px;margin:18px 0">
    <h2>My profile</h2>
    {#if data.profile}
      <p><strong>{data.profile.displayName || 'Personal profile'}</strong></p>
      {#if data.profile.headline}<p>{data.profile.headline}</p>{/if}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn primary" href="/network/share">Share my QR</a>
        <a class="btn" href={'/settings/profile?profile=' + encodeURIComponent(data.profile.slug) + '&kind=personal&entry=network'}>Edit profile</a>
      </div>
    {:else}
      <p>Make a personal profile to share with someone you meet. Your Business profile stays separate.</p>
      <a class="btn primary" href="/settings/profile?kind=personal&entry=network">Create my profile</a>
    {/if}
  </section>
  <section class="card" style="padding:20px">
    <h2>What's next?</h2>
    <p>People who open your profile can use the existing Relish connection flow. A simpler invitation and Dorian onboarding journey will follow in the next stages.</p>
    {#if !data.hasNetworkContext}<p>Your General relationship ContextSpace is not configured yet. Network conversation and understanding features will require it.</p>{/if}
  </section>
</div>
