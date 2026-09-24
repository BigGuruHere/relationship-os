<script lang="ts">
	// PURPOSE: Dating-specific view over the existing dyadic Introduction and Outcome models.
	export let data: any;

	function name(party: any) {
		return party?.contact?.name || party?.company?.name || `Participant ${party?.side || ''}`;
	}
	function fmt(value: string | Date | null) {
		return value ? new Date(value).toLocaleString() : '';
	}
	function yn(value: boolean | null) {
		return value === true ? 'Yes' : value === false ? 'No' : 'Unknown';
	}
</script>

<svelte:head><title>Dating Introduction - Relish</title></svelte:head>

<div class="container pilot-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Dating Introduction</p>
			<h1>{name(data.introduction.partyA)} ↔ {name(data.introduction.partyB)}</h1>
			<p class="muted">{fmt(data.introduction.occurredAt)}</p>
		</div>
		<div class="actions">
			<a class="btn" href="/dating">Dating home</a><a
				class="btn primary"
				href={`/dating/introductions/${data.introduction.id}/feedback/new`}>Record reflection</a
			>
		</div>
	</div>

	<section class="card panel">
		<h2>Context</h2>
		<p>{data.introduction.reason || 'No context recorded.'}</p>
		<p class="muted small">
			A reflection is always attached to one selected respondent. It does not represent the other
			person's private perspective.
		</p>
	</section>

	<section class="card panel">
		<h2>Reflection reviews</h2>
		{#if data.reviews.length === 0}
			<p class="muted">No reflections recorded yet.</p>
		{:else}
			<div class="item-list">
				{#each data.reviews as review}
					<a class="item-row" href={`/dating/feedback/${review.id}`}
						><span
							>{review.status === 'pending' ? 'Review required' : `Review ${review.status}`}</span
						><span class="muted small">{fmt(review.createdAt)}</span></a
					>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card panel">
		<h2>Approved Outcomes from individual reports</h2>
		<p class="muted small">Each voice reflection records one person's account. An approved Outcome does not establish that both participants agree or wish to continue.</p>
		{#if data.introduction.outcomes.length === 0}
			<p class="muted">No approved Outcome yet.</p>
		{:else}
			<div class="item-list">
				{#each data.introduction.outcomes as outcome}
					<article class="outcome-card">
						<div class="section-head">
							<strong>{outcome.statusLabel}</strong><span class="muted small"
								>{fmt(outcome.occurredAt)}</span
							>
						</div>
						<div class="chips">
							<span>Useful: {yn(outcome.useful)}</span><span
								>Respondent reports continuation: {yn(outcome.continued)}</span
							>
						</div>
						{#if outcome.result}<p>{outcome.result}</p>{/if}
						{#if outcome.notes}<p class="muted">{outcome.notes}</p>{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.pilot-page {
		max-width: 1000px;
		padding: 12px;
	}
	.page-head,
	.section-head,
	.item-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
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
	.small {
		font-size: 0.9rem;
	}
	.actions,
	.chips {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.chips span {
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 3px 8px;
		color: var(--muted);
		font-size: 0.82rem;
	}
	.item-list {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}
	.item-row,
	.outcome-card {
		color: inherit;
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px;
	}
	@media (max-width: 700px) {
		.page-head,
		.section-head,
		.item-row {
			flex-direction: column;
		}
	}
</style>
