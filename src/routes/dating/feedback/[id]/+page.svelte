<script lang="ts">
	// PURPOSE: Compare the encrypted source transcript with an editable provisional extraction.
	import ProposalEvidence from '$lib/dating/ProposalEvidence.svelte';
	export let data: any;
	export let form: any;
	const review = data.review;
	const proposal = review.proposal;

	function name(party: any) {
		return party?.contact?.name || party?.company?.name || `Participant ${party?.side || ''}`;
	}
</script>

<svelte:head><title>Review Dating Outcome - Relish</title></svelte:head>

<div class="container review-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Mandatory review</p>
			<h1>{name(review.respondent)} reflecting on {name(review.other)}</h1>
			<p class="muted">Proposal version {proposal.proposalVersion} - {review.approval.status}</p>
		</div>
		<a class="btn" href={`/dating/introductions/${proposal.introductionId}`}>Back to Introduction</a
		>
	</div>

	<section class="card panel transcript">
		<h2>Encrypted source transcript</h2>
		<p>{review.transcript}</p>
	</section>

	{#if review.approval.status === 'pending'}
		<form method="post" action="?/approve">
			<section class="card panel">
				<h2>Proposed perspectives</h2>
				<div class="field">
					<label for="personalExperience">1. Respondent's personal experience</label><textarea
						id="personalExperience"
						name="personalExperience"
						rows="4">{proposal.personalExperience.summary}</textarea
					><ProposalEvidence items={proposal.personalExperience.evidence} />
				</div>
				<div class="field">
					<label for="selfLearning">2. What the respondent learned about themselves</label><textarea
						id="selfLearning"
						name="selfLearning"
						rows="4">{proposal.selfLearning.summary}</textarea
					><ProposalEvidence items={proposal.selfLearning.evidence} />
				</div>
				<div class="field">
					<label for="otherPersonExperience"
						>3. Respondent's subjective experience of the other person</label
					><textarea id="otherPersonExperience" name="otherPersonExperience" rows="4"
						>{proposal.otherPersonExperience.summary}</textarea
					><ProposalEvidence items={proposal.otherPersonExperience.evidence} />
				</div>
				<div class="field">
					<label for="relationshipDynamic">4. Relationship dynamic</label><textarea
						id="relationshipDynamic"
						name="relationshipDynamic"
						rows="4">{proposal.relationshipDynamic.summary}</textarea
					><ProposalEvidence items={proposal.relationshipDynamic.evidence} />
				</div>
				<div class="grid two">
					<div class="field">
						<label for="desireToContinue">5. Desire to continue</label><select
							id="desireToContinue"
							name="desireToContinue"
							>{#each data.desireOptions as option}<option
									value={option.value}
									selected={proposal.desireToContinue.value === option.value}>{option.label}</option
								>{/each}</select
						>
					</div>
					<div class="field">
						<label for="desireToContinueSummary">Reason or nuance</label><textarea
							id="desireToContinueSummary"
							name="desireToContinueSummary"
							rows="3">{proposal.desireToContinue.summary}</textarea
						>
					</div>
				</div>
				<ProposalEvidence items={proposal.desireToContinue.evidence} />
			</section>

			<section class="card panel">
				<h2>Whole-Introduction Outcome</h2>
				<p class="muted small">
					Only this section becomes an Outcome after approval. The perspective sections remain
					reviewed private evidence for the pilot.
				</p>
				<div class="grid three">
					<div class="field">
						<label for="outcomeStatus">Status</label><select id="outcomeStatus" name="outcomeStatus"
							>{#each data.outcomeStatuses as option}<option
									value={option.value}
									selected={proposal.wholeOutcome.status === option.value}>{option.label}</option
								>{/each}</select
						>
					</div>
					<div class="field">
						<label for="useful">Useful?</label><select id="useful" name="useful"
							>{#each data.yesNoUnknown as option}<option
									value={option.value}
									selected={(proposal.wholeOutcome.useful === true
										? 'yes'
										: proposal.wholeOutcome.useful === false
											? 'no'
											: '') === option.value}>{option.label}</option
								>{/each}</select
						>
					</div>
					<div class="field">
						<label for="continued">Continued?</label><select id="continued" name="continued"
							>{#each data.yesNoUnknown as option}<option
									value={option.value}
									selected={(proposal.wholeOutcome.continued === true
										? 'yes'
										: proposal.wholeOutcome.continued === false
											? 'no'
											: '') === option.value}>{option.label}</option
								>{/each}</select
						>
					</div>
				</div>
				<div class="field">
					<label for="result">Result</label><textarea id="result" name="result" rows="4"
						>{proposal.wholeOutcome.result}</textarea
					>
				</div>
				<div class="field">
					<label for="notes">Review notes</label><textarea id="notes" name="notes" rows="4"
						>{proposal.wholeOutcome.notes}</textarea
					>
				</div>
			</section>

			<section class="card panel">
				<h2>Permission attached to this reviewed proposal</h2>
				<label class="check"
					><input
						type="checkbox"
						name="privateLearningAllowed"
						value="true"
						checked={proposal.consent.privateLearningAllowed}
					/> Private learning permitted</label
				>
				<label class="check"
					><input
						type="checkbox"
						name="futureMatchingAllowed"
						value="true"
						checked={proposal.consent.futureMatchingAllowed}
					/> Future private matching permitted</label
				>
				<label class="check"
					><input
						type="checkbox"
						name="shareWithOtherAllowed"
						value="true"
						checked={proposal.consent.shareWithOtherAllowed}
					/> Disclosure to the other participant permitted</label
				>
				<p class="muted small">
					Stage 8.10 records these choices but does not perform matching, disclosure, or Knowledge
					Claim promotion.
				</p>
			</section>

			{#if form?.error}<section class="card panel error">{form.error}</section>{/if}
			<div class="actions">
				<button class="btn primary" type="submit">Approve and create Outcome</button>
			</div>
		</form>

		<form method="post" action="?/reject" class="card panel reject-form">
			<div class="field">
				<label for="reviewerNote">Reason for rejection, optional</label><input
					id="reviewerNote"
					name="reviewerNote"
				/>
			</div>
			<button class="btn danger" type="submit">Reject proposal without creating Outcome</button>
		</form>
	{:else}
		<section class="card panel">
			<strong>This proposal has been {review.approval.status}.</strong
			>{#if review.approval.reviewerNote}<p class="muted">{review.approval.reviewerNote}</p>{/if}
		</section>
	{/if}
</div>

<style>
	.review-page {
		max-width: 1000px;
		padding: 12px;
	}
	.page-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 12px;
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
		margin-bottom: 10px;
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
	.transcript p {
		white-space: pre-wrap;
	}
	.grid.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.grid.three {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
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
	.check {
		display: flex;
		gap: 9px;
		align-items: flex-start;
		margin: 10px 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}
	.error {
		color: var(--danger);
	}
	.reject-form {
		border-color: var(--danger);
	}
	.btn.danger {
		color: var(--danger);
		border-color: var(--danger);
	}
	@media (max-width: 700px) {
		.page-head {
			flex-direction: column;
		}
		.grid.two,
		.grid.three {
			grid-template-columns: 1fr;
		}
	}
</style>
