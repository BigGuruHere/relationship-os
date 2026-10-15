<script lang="ts">
  // PURPOSE: One clear choice to accept a Network invitation, without a developer interface.
  export let data: { profile: { name: string }; signedIn: boolean; isSelf: boolean; connected: boolean; next: string };
  export let form: { error?: string } | undefined;
</script>
<svelte:head><title>Connect on Relish</title></svelte:head>
<div class="container" style="max-width:540px;padding:20px 12px">
  <section class="card" style="padding:24px">
    <h1>Connect with {data.profile.name}</h1>
    <p>Relish helps you stay connected with the people you meet.</p>
    {#if form?.error}<p role="alert">{form.error}</p>{/if}
    {#if data.isSelf}<p>This is your own profile.</p><a class="btn" href="/network">Your Network</a>
    {:else if data.connected}<p>You're already connected.</p><a class="btn" href="/network">View your Network</a>
    {:else if data.signedIn}
      <p>Connecting creates a contact for each of you in your own General ContextSpace. It does not share private notes or Living Understanding.</p>
      <form method="POST" action="?/connect"><button class="btn primary" type="submit">Connect</button></form>
    {:else}
      <p>Create a free account or sign in to connect. You'll return to this invitation afterwards.</p>
      <a class="btn primary" href={'/auth/register?next=' + encodeURIComponent(data.next)}>Create account</a>
      <a class="btn" href={'/auth/login?next=' + encodeURIComponent(data.next)}>I already have an account</a>
    {/if}
  </section>
</div>
