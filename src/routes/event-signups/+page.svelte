<script lang="ts">
  // Stage 8.22.5 - Personal test-group list, owner authenticated by server.
  export let data: { signups: Array<{ id: string; name: string; email: string | null; phone: string | null; group: string; createdAt: string; consentAt: string }> };
</script>
<svelte:head><title>Early Relish testers | Relish</title></svelte:head>
<div class="container">
  <div class="card list-card">
    <h1>People interested in testing Relish</h1>
    <p>Explicit opt-ins from the Tech Networking Walk QR page. Only you can view your list.</p>
    <p><strong>{data.signups.length}</strong> {data.signups.length === 1 ? 'person' : 'people'} in the test group.</p>
    {#if data.signups.length}
      <div class="signup-list">
        {#each data.signups as signup (signup.id)}
          <section class="person">
            <strong>{signup.name}</strong>
            <small>{new Date(signup.createdAt).toLocaleString('en-AU')}</small>
            {#if signup.email}<a href={'mailto:' + signup.email}>{signup.email}</a>{/if}
            {#if signup.phone}<a href={'tel:' + signup.phone}>{signup.phone}</a>{/if}
          </section>
        {/each}
      </div>
    {:else}
      <p>No one has registered yet. The event QR link can be used to join.</p>
    {/if}
  </div>
</div>
<style>
  .list-card { max-width:760px; margin:22px auto; padding:22px; }
  h1 { font-size:1.6rem; line-height:1.3; margin:0 0 10px; }
  .signup-list { display:grid; gap:10px; }
  .person { display:flex; flex-direction:column; gap:3px; border:1px solid #e0e9e6; border-radius:12px; padding:14px; overflow-wrap:anywhere; }
  .person small { color:#62746f; }
  .person a { color:#17584b; }
</style>
