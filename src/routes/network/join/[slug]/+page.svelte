<script lang="ts">
  import { onMount } from 'svelte';
  let autoConnectForm: HTMLFormElement;
  onMount(() => {
    // IT: A deliberate Connect action on the public profile authorises this POST.
    // GET loads never mutate connection data; retry remains possible if submission fails.
    if (data.signedIn && !data.isSelf && !data.connected) autoConnectForm?.requestSubmit();
  });
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
      <p>Connecting you with {data.profile.name}… Your private notes and Living Understanding will not be shared.</p>
      <form bind:this={autoConnectForm} method="POST" action="?/connect"><button class="btn primary" type="submit">Continue connection</button></form>
    {:else}
      <p>Continue with Google or sign in using an existing account. You'll connect automatically after authentication.</p>
      <a class="btn primary" href={'/auth/google?next=' + encodeURIComponent(data.next)}>Continue with Google</a>
      <a class="btn" href={'/auth/register?next=' + encodeURIComponent(data.next)}>Create account with email</a>
      <a class="btn" href={'/auth/login?next=' + encodeURIComponent(data.next)}>I already have an account</a>
    {/if}
  </section>
</div>
