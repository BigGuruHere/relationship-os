<script lang="ts">
	// PURPOSE: Minimal identities for controlled Dating pilot Introductions, not full Dating profiles.
	export let data: any;
	export let form: any;
</script>

<svelte:head><title>Dating people - Relish</title></svelte:head>

<div class="container pilot-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Dating pilot</p>
			<h1>People</h1>
			<p class="muted">Private identity shells used only inside this Dating space.</p>
		</div>
		<a class="btn" href="/dating">Dating home</a>
	</div>

	<section class="card panel">
		<h2>Add a person</h2>
		<form method="post" action="?/create" class="inline-form">
			<div class="field">
				<label for="name">Name</label>
				<input id="name" name="name" required maxlength="200" value={form?.values?.name || ''} />
			</div>
			<button class="btn primary" type="submit">Add person</button>
		</form>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
	</section>

	<section class="card panel">
		<div class="section-head">
			<h2>Dating people</h2>
			<a class="btn" href="/dating/introductions/new">Create Introduction</a>
		</div>
		{#if data.people.length === 0}
			<p class="muted">No Dating people yet. Add two people before creating an Introduction.</p>
		{:else}
			<div class="people-list">
				{#each data.people as person}
					<div class="person-row"><strong>{person.name}</strong><div><a href={`/dating/people/${person.id}`}>Personal history</a> · <a href={`/dating/people/${person.id}/understanding`}>Living Understanding</a></div></div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.pilot-page {
		max-width: 900px;
		padding: 12px;
	}
	.page-head,
	.section-head,
	.inline-form {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: flex-end;
	}
	.panel {
		padding: 16px;
		margin-bottom: 12px;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.eyebrow {
		color: var(--accent);
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.8rem;
	}
	.muted {
		color: var(--muted);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
	}
	.field input {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
	}
	.people-list {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}
	.person-row {
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 10px 12px;
	}
	.error {
		color: var(--danger);
	}
	@media (max-width: 700px) {
		.page-head,
		.section-head,
		.inline-form {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
