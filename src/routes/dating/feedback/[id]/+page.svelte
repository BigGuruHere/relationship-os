<script lang="ts">
	// PURPOSE: Compare the encrypted source transcript with an editable provisional extraction.
	import ProposalEvidence from '$lib/dating/ProposalEvidence.svelte';
	import { datingNextStepLabel } from '$lib/datingNextStep';
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
						<label for="continued">Respondent reports continuation?</label><select id="continued" name="continued"
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
				<h2>What would you like to happen next?</h2>
				<p class="muted small">This is your private intention. Nothing is sent to the other person or arranged automatically.</p>
				<div class="field">
					<label for="privateNextStep">Choose one</label>
					<select id="privateNextStep" name="privateNextStep" required>
						<option value="">Select a next step</option>
						{#each data.nextStepOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="privateNextStepNote">Anything you want Dorian to remember? (optional)</label>
					<textarea id="privateNextStepNote" name="privateNextStepNote" rows="3" maxlength="1000" placeholder="For example, I'd like to give this a week before deciding."></textarea>
				</div>
			</section>

			<section class="card panel">
				<h2>Permissions for private use</h2>
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
					/> Store preference to consider sharing later (no disclosure without a separate, specific permission)</label
				>
				<p class="muted small">
					You may narrow earlier permissions here, but cannot widen them without a new consent flow.
					No matching, disclosure or Knowledge Claim promotion happens automatically.
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
		{#if review.approval.status === 'approved'}
			<section class="card panel">
				<h2>Your private next step</h2>
				<p>{review.privateNextStep ? datingNextStepLabel(review.privateNextStep.choice) : 'No next step recorded for this earlier review.'}</p>
				{#if review.privateNextStep?.note}<p class="muted">{review.privateNextStep.note}</p>{/if}
				<p class="muted small">This is one person's intention. Relish has not contacted or disclosed anything to the other participant.</p>
			</section>
			{#if review.approvedReflection}
				<section class="card panel">
					<h2>Your approved reflection</h2>
					<p class="muted small">These are the corrected, privately approved words, not an independently verified account of the other person.</p>
					<h3>Your experience</h3><p>{review.approvedReflection.personalExperience.summary || 'Not recorded'}</p>
					<h3>What you learned</h3><p>{review.approvedReflection.selfLearning.summary || 'Not recorded'}</p>
					<h3>Your impression of the other person</h3><p>{review.approvedReflection.otherPersonExperience.summary || 'Not recorded'}</p>
					<h3>The dynamic</h3><p>{review.approvedReflection.relationshipDynamic.summary || 'Not recorded'}</p>
					<h3>Whether you want to continue</h3><p>{review.approvedReflection.desireToContinue.summary || 'Not recorded'}</p>
				</section>
			{/if}
		{/if}
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
