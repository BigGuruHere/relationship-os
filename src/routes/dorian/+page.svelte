<script lang="ts">
	import DorianWebConversation from '$lib/components/DorianWebConversation.svelte';

	let consent = false;
	let started = false;
	let finished = false;
</script>

<svelte:head><title>Talk to Dorian - Relish</title></svelte:head>
<section class="container" style="max-width: 40rem">
	<a href="/">← Home</a>
	<h1>Talk to Dorian</h1>
	<p>Talk through what matters to you and the connections you’d like to build.</p>
	<p>
		Dorian is an AI. ElevenLabs handles the call and transcription. Relish saves your transcript
		privately and uses OpenAI to analyse it. During this pilot, an authorised Relish operator can
		review your transcript and what Dorian learns for future calls.
	</p>
	<p><a href="/legal">Terms and privacy</a></p>
	<label>
		<input type="checkbox" bind:checked={consent} disabled={started} />
		I agree to this use of my conversation.
	</label>
	{#if finished}
		<p role="status">Conversation ended. Relish will process it in the background.</p>
	{/if}
	<DorianWebConversation action="?/start" disabled={!consent} startFields={{ consent: consent ? '1' : '' }}
		onStarted={() => { started = true; finished = false; }}
		onFinished={() => { started = false; finished = true; }} />
</section>
