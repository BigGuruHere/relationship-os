<script lang="ts">
  let { data, form } = $props();

  type TopicView = {
    realm: string;
    topicName: string;
    effect?: string;
    reason?: string;
    relevantTurnIds?: string[];
    previousUnderstanding?: string;
    proposedUnderstanding?: string;
  };

  type ValidationNote = { status: string; reason: string };
  type RepairView = { realm: string; topicName: string; before: string; after: string };
  type PipelineStage = {
    key: 'IMPACT_ANALYSIS' | 'TOPIC_PROPOSAL' | 'SEMANTIC_VALIDATION' | 'BOUNDED_REPAIR' | 'FINAL_CANDIDATE';
    title: string;
    status: string;
    data: {
      topicEffects?: TopicView[];
      newTopicSuggestions?: TopicView[];
      affectedTopics?: TopicView[];
      newTopics?: TopicView[];
      unchangedTopics?: TopicView[];
      notes?: ValidationNote[];
      repairCount?: number;
      repairs?: RepairView[];
    };
  };

  type ProposalView = {
    baselineRevisionNumber: number;
    affectedTopics: TopicView[];
    newTopics: TopicView[];
    unchangedTopics: TopicView[];
    approvalToken?: string;
  };

  function actionUrl(actionName: 'analyseImpact' | 'approveImpact' | 'approvePreparedImpact') {
    return `?/${actionName}&sourceInteractionId=${encodeURIComponent(data.source.id)}`;
  }

  function preparedStages(): PipelineStage[] {
    return (data.preparedDraft?.pipelineStages ?? []) as PipelineStage[];
  }

  function proposalForReview(): ProposalView | null {
    return (form?.impactProposal ?? data.preparedDraft?.impactProposal ?? null) as ProposalView | null;
  }

  function requiredProposalForReview(): ProposalView {
    const proposal = proposalForReview();
    if (!proposal) throw new Error('A Living Understanding proposal is required for approval.');
    return proposal;
  }
</script>

<svelte:head><title>Review impact on Living Understanding - Relish</title></svelte:head>

<div class="page-shell">
  <nav><a href={`/dating/people/${data.personId}/understanding?sourceInteractionId=${encodeURIComponent(data.source.id)}`}>← Back to reflection review</a></nav>
  <header>
    <p class="eyebrow">Longitudinal Living Understanding</p>
    <h1>Review impact on Living Understanding</h1>
    <p class="muted">Current baseline: authoritative v{data.baseline.revisionNumber}. Automated preparation can run the analysis, proposal, validation and bounded repair stages, but nothing becomes authoritative until you approve the final candidate.</p>
  </header>

  {#if data.alreadyApplied}
    <section class="card"><h2>Already incorporated</h2><p>This source is already part of the authoritative Living Understanding history. No second revision is needed.</p></section>
  {:else}
    <section class="card">
      <h2>Source conversation</h2>
      <p class="muted small">Recorded {new Date(data.source.at).toLocaleString()} · Private to this context</p>
      <blockquote>{data.source.text}</blockquote>
    </section>

    {#if form?.impactError}<p class="error" role="alert">{form.impactError}</p>{/if}

    {#if data.preparedDraft?.impactProposal}
      <section class="card result-summary">
        <p class="eyebrow">Automatically prepared</p>
        <h2>Candidate revision ready for review</h2>
        <p>Relish has already run the proposal pipeline. Each stage is retained below so you can inspect how the final candidate was reached before approving it.</p>
        {#if data.preparedDraft.preparedAt}<p class="muted small">Prepared {new Date(data.preparedDraft.preparedAt).toLocaleString()}</p>{/if}
      </section>

      <section class="pipeline" aria-label="Living Understanding preparation stages">
        {#each preparedStages() as stage}
          <details class="card stage-panel" open={stage.key === 'FINAL_CANDIDATE'}>
            <summary><strong>{stage.title}</strong><span class="stage-status">{stage.status}</span></summary>
            {#if stage.key === 'IMPACT_ANALYSIS'}
              <p class="muted small">How the new conversation relates to every authoritative topic before wording changes are proposed.</p>
              {#each stage.data.topicEffects ?? [] as effect}
                <article class="stage-row"><strong>{effect.realm} / {effect.topicName}</strong> · {effect.effect}<p>{effect.reason}</p>{#if effect.relevantTurnIds?.length}<p class="muted small">Evidence: {effect.relevantTurnIds.join(', ')}</p>{/if}</article>
              {/each}
              {#if stage.data.newTopicSuggestions?.length}<h4>Possible new topics</h4>{#each stage.data.newTopicSuggestions as topic}<p><strong>{topic.realm} / {topic.topicName}</strong> · {topic.reason}</p>{/each}{/if}
            {:else if stage.key === 'TOPIC_PROPOSAL'}
              <p class="muted small">The topic wording proposed before semantic-boundary validation.</p>
              {#each stage.data.affectedTopics ?? [] as topic}<article class="stage-row"><strong>{topic.realm} / {topic.topicName}</strong> · {topic.effect}<p>{topic.proposedUnderstanding}</p></article>{/each}
              {#each stage.data.newTopics ?? [] as topic}<article class="stage-row"><strong>NEW · {topic.realm} / {topic.topicName}</strong><p>{topic.proposedUnderstanding}</p></article>{/each}
            {:else if stage.key === 'SEMANTIC_VALIDATION'}
              <p class="muted small">Checks topic boundaries, legitimate cross-topic relevance, redundant duplication and contamination against the complete resulting snapshot.</p>
              {#if !(stage.data.notes?.length)}<p>No semantic-boundary issues were reported.</p>{/if}
              {#each stage.data.notes ?? [] as note}<article class="stage-row"><strong>{note.status}</strong><p>{note.reason}</p></article>{/each}
            {:else if stage.key === 'BOUNDED_REPAIR'}
              {#if stage.data.repairCount}
                <p>{stage.data.repairCount} topic{stage.data.repairCount === 1 ? '' : 's'} changed during bounded repair.</p>
                {#each stage.data.repairs ?? [] as repair}<article class="stage-row"><strong>{repair.realm} / {repair.topicName}</strong><h4>Before repair</h4><p>{repair.before}</p><h4>After repair</h4><p>{repair.after}</p></article>{/each}
              {:else}<p>No bounded repair was required.</p>{/if}
            {:else if stage.key === 'FINAL_CANDIDATE'}
              <p><strong>{stage.data.affectedTopics?.length ?? 0}</strong> affected topic(s), <strong>{stage.data.newTopics?.length ?? 0}</strong> new topic(s), <strong>{stage.data.unchangedTopics?.length ?? 0}</strong> unchanged topic(s).</p>
              {#each stage.data.affectedTopics ?? [] as topic}<article class="stage-row"><p class="eyebrow">{topic.effect}</p><strong>{topic.realm} / {topic.topicName}</strong><h4>Current</h4><p>{topic.previousUnderstanding}</p><h4>Final proposed</h4><p>{topic.proposedUnderstanding}</p></article>{/each}
              {#each stage.data.newTopics ?? [] as topic}<article class="stage-row"><p class="eyebrow">NEW TOPIC</p><strong>{topic.realm} / {topic.topicName}</strong><p>{topic.proposedUnderstanding}</p></article>{/each}
            {/if}
          </details>
        {/each}
      </section>
    {/if}

    {#if !proposalForReview()}
      <form method="POST" action={actionUrl('analyseImpact')} class="card">
        <input type="hidden" name="sourceInteractionId" value={data.source.id} />
        <label><input type="checkbox" name="consent" value="YES" required /> Run the Living Understanding proposal pipeline manually for this private source.</label>
        <button class="btn primary" type="submit">Prepare proposal now</button>
        <p class="muted small">This fallback is shown when no automatic draft is available. Nothing becomes authoritative until approval.</p>
      </form>
    {:else}
      {@const proposal = requiredProposalForReview()}
      {#if !data.preparedDraft?.impactProposal}
        <section class="card result-summary"><h2>Proposed authoritative v{proposal.baselineRevisionNumber + 1}</h2><p><strong>{proposal.affectedTopics.length}</strong> affected, <strong>{proposal.newTopics.length}</strong> new, <strong>{proposal.unchangedTopics.length}</strong> unchanged.</p></section>
      {/if}

      <form method="POST" action={data.preparedDraft?.impactProposal ? actionUrl('approvePreparedImpact') : actionUrl('approveImpact')} class="card approval">
        {#if data.preparedDraft?.impactProposal}
          <input type="hidden" name="draftCheckpointId" value={data.preparedDraft.id} />
        {:else}
          <input type="hidden" name="approvalToken" value={proposal.approvalToken ?? ''} />
          <input type="hidden" name="draftCheckpointId" value={form?.draftCheckpoint?.id ?? ''} />
        {/if}
        <label><input type="checkbox" name="approve" value="YES" required /> I have reviewed the final candidate and approve it as the next authoritative Living Understanding revision.</label>
        <button class="btn primary" type="submit">Approve and create v{proposal.baselineRevisionNumber + 1}</button>
        <p class="muted small">Approval updates private authoritative knowledge only. It grants no matching, disclosure or sharing permission.</p>
      </form>
    {/if}
  {/if}
</div>

<style>
  .page-shell{max-width:980px;margin:0 auto;padding:1.5rem}.card{border:1px solid var(--border-color,#ddd);border-radius:12px;padding:1rem;margin:1rem 0}.muted{opacity:.72}.small{font-size:.9rem}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;font-weight:700}.stage-panel>summary{cursor:pointer;display:flex;justify-content:space-between;gap:1rem;align-items:center}.stage-status{font-size:.78rem;opacity:.68}.stage-row{padding:1rem 0;border-top:1px solid var(--border-color,#ddd)}.stage-row:first-of-type{border-top:0}.btn{padding:.65rem 1rem;border-radius:8px}.primary{font-weight:700}.error{color:#b42318}blockquote{white-space:pre-wrap}details{margin:.65rem 0}.approval label{display:block;margin-bottom:1rem}
</style>
