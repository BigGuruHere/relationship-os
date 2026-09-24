<script lang="ts">
	// PURPOSE: Asynchronous voice reflection UI. Extraction begins only after the recording is submitted.
	import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
	export let data: any;
	export let form: any;
	let transcript = '';

	function name(party: any) {
		return party?.contact?.name || party?.company?.name || `Participant ${party?.side || ''}`;
	}
</script>

<svelte:head><title>Dating reflection - Relish</title></svelte:head>

<div class="container pilot-page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Private reflection</p>
			<h1>{name(data.introduction.partyA)} ↔ {name(data.introduction.partyB)}</h1>
		</div>
		<a class="btn" href={`/dating/introductions/${data.introduction.id}`}>Cancel</a>
	</div>

	<form method="post" action="?/create">
		<section class="card panel">
			<h2>1. Who is providing this reflection?</h2>
			<div class="field">
				<label for="respondentParticipantId">Respondent</label>
				<select id="respondentParticipantId" name="respondentParticipantId" required>
					<option value="">Select respondent</option>
					{#each data.introduction.participants as participant}<option value={participant.id}
							>{name(participant)}</option
						>{/each}
				</select>
			</div>
		</section>

		<section class="card panel">
			<h2>2. Record or enter the reflection</h2>
			<p class="muted small">
				Useful areas include your experience, what you learned about yourself, your impression of
				the other person, the dynamic between you, and whether you want to continue.
			</p>
			<VoiceTextField
				id="datingTranscript"
				textName="transcript"
				label="Private reflection transcript"
				placeholder="Speak naturally about what the experience was like for you."
				rows={10}
				bind:value={transcript}
				showSummaryBox={false}
				contextLabel="private Dating reflection"
				uploadEndpoint="/dating/api/upload-chunk"
				resultEndpoint="/dating/api/transcribe-result"
			/>
		</section>

		<section class="card panel">
			<h2>3. Permission and use</h2>
			<label class="check required"
				><input type="checkbox" name="consentConfirmed" value="true" required /> I confirm the respondent
				understands that this reflection will be privately stored, transcribed and processed to produce
				a reviewable proposal.</label
			>
			<label class="check"
				><input type="checkbox" name="privateLearningAllowed" value="true" checked /> Use approved information
				privately to improve this person's future experience.</label
			>
			<label class="check"
				><input type="checkbox" name="futureMatchingAllowed" value="true" /> Allow approved information
				to inform future private matching.</label
			>
			<label class="check"
				><input type="checkbox" name="shareWithOtherAllowed" value="true" /> Permit approved information
				to be disclosed to the other participant. This is off by default.</label
			>
			<p class="muted small">
				These permissions are stored with this proposal. No information is disclosed or promoted
				automatically in Stage 8.10.
			</p>
		</section>

		{#if form?.error}<section class="card panel error">{form.error}</section>{/if}
		<button class="btn primary submit" type="submit">Create proposal for review</button>
	</form>
</div>

<style>
	.pilot-page {
		max-width: 900px;
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
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field select {
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
	.check.required {
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
	.submit {
		margin-bottom: 24px;
	}
	@media (max-width: 700px) {
		.page-head {
			flex-direction: column;
		}
	}
</style>
