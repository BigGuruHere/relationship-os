<script lang="ts">
	// PURPOSE: Create one real dyadic Introduction before collecting a private reflection.
	export let data: any;
	export let form: any;
</script>

<svelte:head><title>New Dating Introduction - Relish</title></svelte:head>

<div class="container pilot-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Dating pilot</p>
			<h1>New Introduction</h1>
		</div>
		<a class="btn" href="/dating">Cancel</a>
	</div>

	<section class="card panel">
		{#if data.people.length < 2}
			<p>Add at least two Dating people before creating an Introduction.</p>
			<a class="btn primary" href="/dating/people">Add Dating people</a>
		{:else}
			<form method="post" action="?/create">
				<div class="grid two">
					<div class="field">
						<label for="partyAContactId">Person 1</label>
						<select id="partyAContactId" name="partyAContactId" required>
							<option value="">Select person</option>
							{#each data.people as person}<option value={person.id}>{person.name}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="partyBContactId">Person 2</label>
						<select id="partyBContactId" name="partyBContactId" required>
							<option value="">Select person</option>
							{#each data.people as person}<option value={person.id}>{person.name}</option>{/each}
						</select>
					</div>
				</div>
				<div class="field">
					<label for="occurredAt">Date and time</label>
					<input id="occurredAt" name="occurredAt" type="datetime-local" />
				</div>
				<div class="field">
					<label for="reason">Context</label>
					<textarea id="reason" name="reason" rows="3">Dating pilot reflection</textarea>
				</div>
				<button class="btn primary" type="submit">Create Introduction</button>
			</form>
		{/if}
		{#if form?.error}<p class="error">{form.error}</p>{/if}
	</section>
</div>

<style>
	.pilot-page {
		max-width: 900px;
		padding: 12px;
	}
	.page-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: flex-start;
		margin-bottom: 12px;
	}
	.panel {
		padding: 16px;
	}
	h1 {
		margin: 0;
	}
	.eyebrow {
		color: var(--accent);
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.8rem;
	}
	.grid.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.field input,
	.field select,
	.field textarea {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
	}
	.error {
		color: var(--danger);
	}
	@media (max-width: 700px) {
		.page-head {
			flex-direction: column;
		}
		.grid.two {
			grid-template-columns: 1fr;
		}
	}
</style>
