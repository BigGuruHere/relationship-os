<script lang="ts">
  import DorianWebConversation from '$lib/components/DorianWebConversation.svelte';
</script>


<svelte:head><title>Dorian Voice Test - Relish</title></svelte:head>

<section class="container" style="max-width: 34rem">
  <h1>Dorian Voice Test</h1>
  <p>This DEV test sends live microphone audio to ElevenLabs. Use made-up details. Relish does not save a note from this test.</p>
  <DorianWebConversation />
</section>
