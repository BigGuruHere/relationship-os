<script lang="ts">
	// PURPOSE: Confirm the Dating boundary before Stage 8.10 adds voice-feedback workflows.
	export let data: any;
</script>

<svelte:head><title>Dating - Relish</title></svelte:head>

<div class="container">
	<section class="card boundary-card">
		<p class="eyebrow">Dating application</p>
		<h1>{data.configured ? 'Dating space is isolated and ready' : 'Create your Dating space'}</h1>
		{#if data.configured}
			<p>
				This ContextSpace is separate from Business. The voice-feedback pilot will be added here in
				Stage 8.10.
			</p>
			<a class="btn" href="/settings/context-spaces">Manage application spaces</a>
		{:else}
			<p>
				No Dating ContextSpace exists. Create one through the controlled application-space setup.
			</p>
			<a class="btn primary" href="/settings/context-spaces">Set up Dating space</a>
		{/if}
	</section>
</div>

<style>
	.boundary-card {
		max-width: 720px;
		padding: 24px;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.78rem;
		color: var(--muted);
	}
	h1 {
		margin-top: 0;
	}
</style>
