<script lang="ts">
	// PURPOSE: Show isolated app ContextSpaces and provide explicit server-validated selection.
	export let data: any;
	export let form: any;
</script>

<svelte:head><title>Application spaces - Relish</title></svelte:head>

<div class="container">
	<div class="section-head">
		<div>
			<h1>Application spaces</h1>
			<p class="muted">
				Business and Dating use the same Relish Core but keep their contextual records isolated.
			</p>
		</div>
	</div>

	{#if form?.error}<p class="error">{form.error}</p>{/if}

	<div class="space-grid">
		{#each data.spaces as space}
			<section class="card space-card">
				<div>
					<h2>{space.displayName}</h2>
					<p class="muted">Domain: {space.domainKey}</p>
					{#if space.isDefault}<span class="pill">Default</span>{/if}
				</div>
				<form method="POST" action="?/select">
					<input type="hidden" name="contextSpaceId" value={space.id} />
					<button class="btn primary" type="submit">Open {space.displayName}</button>
				</form>
			</section>
		{/each}
	</div>

	{#if !data.spaces.some((space: any) => space.domainKey === 'dating')}
		<section class="card setup-card">
			<h2>Create Dating space</h2>
			<p>
				This creates an empty Dating ContextSpace. It cannot read existing Business contacts,
				interactions, Wants, Offers, or agent memory.
			</p>
			<form method="POST" action="?/createDating">
				<button class="btn primary" type="submit">Create isolated Dating space</button>
			</form>
		</section>
	{/if}
</div>

<style>
	.section-head {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
		margin-bottom: 16px;
	}
	.space-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
	}
	.space-card,
	.setup-card {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: flex-start;
	}
	.space-card {
		justify-content: space-between;
	}
	.setup-card {
		margin-top: 16px;
	}
	h1,
	h2,
	p {
		margin-top: 0;
	}
	.muted {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
</style>
