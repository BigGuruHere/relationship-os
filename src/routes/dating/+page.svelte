<script lang="ts">
	// PURPOSE: Launch and review controlled Stage 8.10 Dating voice reflections.
	export let data: any;

	function fmt(value: string | Date) {
		return new Date(value).toLocaleString();
	}
</script>

<svelte:head><title>Dating - Relish</title></svelte:head>

<div class="container pilot-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Dating application</p>
			<h1>{data.configured ? 'Voice Outcome pilot' : 'Create your Dating space'}</h1>
			<p class="muted">
				Private, single-sided reflections with mandatory review before an Outcome is created.
			</p>
		</div>
		<a class="btn" href="/settings/context-spaces">Manage application spaces</a>
	</div>

	{#if !data.configured}
		<section class="card panel">
			<p>No Dating ContextSpace exists.</p>
			<a class="btn primary" href="/settings/context-spaces">Set up Dating space</a>
		</section>
	{:else}
		<section class="stat-grid">
			<a class="card stat" href="/dating/people"
				><span>People</span><strong>{data.people.length}</strong></a
			>
			<a class="card stat" href="/dating/introductions/new"
				><span>Introductions</span><strong>{data.introductions.length}</strong></a
			>
			<div class="card stat">
				<span>Pending reviews</span><strong>{data.pendingReviews.length}</strong>
			</div>
		</section>

		<section class="card panel safety-note">
			<strong>Pilot boundary</strong>
			<p>
				Transcripts and proposals stay private and encrypted. Dating reflection approval does not automatically update a participant's Living Understanding. Operator-reviewed statements can be added separately under People. Nothing is automatically shared with the other participant or other contexts.
			</p>
		</section>

		<section class="card panel">
			<div class="section-head">
				<div>
					<h2>Introductions</h2>
					<p class="muted small">Choose an Introduction before recording a reflection.</p>
				</div>
				<div class="actions">
					<a class="btn" href="/dating/people">People</a><a
						class="btn primary"
						href="/dating/introductions/new">New Introduction</a
					>
				</div>
			</div>
			{#if data.introductions.length === 0}
				<p class="muted">No Dating Introductions yet.</p>
			{:else}
				<div class="item-list">
					{#each data.introductions as introduction}
						<a class="item-row" href={`/dating/introductions/${introduction.id}`}>
							<div>
								<strong>{introduction.partyA} ↔ {introduction.partyB}</strong>
								<div class="muted small">
									{fmt(introduction.occurredAt)} - {introduction.statusLabel}
								</div>
							</div>
							<span class="status-chip"
								>{introduction.outcomeCount} approved outcome{introduction.outcomeCount === 1
									? ''
									: 's'}</span
							>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.pendingReviews.length > 0}
			<section class="card panel">
				<h2>Pending reviews</h2>
				<div class="item-list">
					{#each data.pendingReviews as review}
						<a class="item-row" href={`/dating/feedback/${review.id}`}
							><span>Review private Outcome proposal</span><span class="muted small"
								>{fmt(review.createdAt)}</span
							></a
						>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
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
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}
	.stat {
		padding: 14px;
		text-decoration: none;
		color: inherit;
		display: flex;
		justify-content: space-between;
	}
	.stat strong {
		font-size: 1.5rem;
	}
	.safety-note {
		border-color: var(--accent);
	}
	.safety-note p {
		margin-bottom: 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.item-list {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}
	.item-row {
		color: inherit;
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px;
	}
	.status-chip {
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 3px 8px;
		color: var(--muted);
		font-size: 0.82rem;
	}
	@media (max-width: 700px) {
		.page-head,
		.section-head,
		.item-row {
			flex-direction: column;
		}
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
