<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DorianWebConversation from '$lib/components/DorianWebConversation.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
	let consent = false;
	let started = false;
	let finished = false;
</script>

<svelte:head><title>Talk to Dorian - Relish</title></svelte:head>
<section class="workspace-page dorian-page">
	<a href="/">← Home</a>
	<div class="workspace-panel">
		<h1>{data.accepted ? 'Here’s Dorian' : 'Talk to Dorian'}</h1>
		{#if !data.policyVersion}
			<p>Dorian is temporarily unavailable.</p>
		{:else}
			{#if data.accepted}
				<p>Enjoy the conversation.</p>
			{:else}
				<p>Talk through what matters to you and the connections you’d like to build.</p>
				<p>Dorian is an AI. Relish transcribes and analyses the conversation to help Dorian remember what matters to you.</p>
				<label class="consent">
					<input type="checkbox" bind:checked={consent} disabled={started} />
					<span>I agree to the <a href="/legal/terms" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Notice</a>.</span>
				</label>
			{/if}
			{#if finished}
				<p role="status">Conversation ended.</p>
			{/if}
			<DorianWebConversation action="?/start" preloadVoice disabled={!data.accepted && !consent}
				startFields={{ consent: consent ? '1' : '', policyVersion: data.policyVersion }}
				onStarted={() => {
					started = true;
					finished = false;
					// Refresh the page data after the server has saved first-call acceptance.
					if (!data.accepted) void invalidateAll();
				}}
				onFinished={() => { started = false; finished = true; }} />
		{/if}
	</div>
</section>

<style>
	.dorian-page { max-width: 40rem; }
	.workspace-panel { margin-top: 1rem; }
	.consent { display: flex; align-items: flex-start; gap: .65rem; }
</style>
