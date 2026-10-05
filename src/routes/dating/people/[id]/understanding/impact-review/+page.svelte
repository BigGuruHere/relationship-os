<script lang="ts">
  let { data, form } = $props();

  // Named SvelteKit actions replace the current query string. Keep the source
  // interaction id in the action URL so the page load can reconstruct the same
  // private source after an analyse/approve POST or a validation failure.
  function actionUrl(actionName: 'analyseImpact' | 'approveImpact') {
    return `?/${actionName}&sourceInteractionId=${encodeURIComponent(data.source.id)}`;
  }
</script>

<svelte:head><title>Review impact on Living Understanding - Relish</title></svelte:head>

<div class="page-shell">
  <nav><a href={`/dating/people/${data.personId}/understanding?sourceInteractionId=${encodeURIComponent(data.source.id)}`}>← Back to reflection review</a></nav>
  <header>
    <p class="eyebrow">Longitudinal Living Understanding</p>
    <h1>Review impact on Living Understanding</h1>
    <p class="muted">Current baseline: authoritative v{data.baseline.revisionNumber}. Only topics genuinely affected by this new source will receive new topic versions. Unchanged topic versions are carried forward.</p>
  </header>

  {#if data.alreadyApplied}
    <section class="card"><h2>Already incorporated</h2><p>This source is already part of the authoritative Living Understanding history. No second revision is needed.</p></section>
  {:else}
    <section class="card">
      <h2>New source</h2>
      <p class="muted small">Recorded {new Date(data.source.at).toLocaleString()} · Private to this Dating space</p>
      <blockquote>{data.source.text}</blockquote>
    </section>

    <section class="card">
      <h2>Authoritative baseline v{data.baseline.revisionNumber}</h2>
      <p class="muted">{data.baseline.topics.length} current topics. The AI receives these persisted identities and current authoritative text, not the legacy topic inventory.</p>
      {#each data.baseline.topics as topic}
        <details>
          <summary><strong>{topic.realm} / {topic.topicName}</strong> · t{topic.topicVersionNumber}</summary>
          <p>{topic.understanding}</p>
        </details>
      {/each}
    </section>

    {#if form?.impactError}<p class="error" role="alert">{form.impactError}</p>{/if}

    {#if !form?.impactProposal}
      <form method="POST" action={actionUrl('analyseImpact')} class="card">
        <input type="hidden" name="sourceInteractionId" value={data.source.id} />
        <label><input type="checkbox" name="consent" value="YES" required /> Allow AI processing of this private source together with authoritative v{data.baseline.revisionNumber} to identify its impact.</label>
        <button class="btn primary" type="submit">Analyse impact</button>
        <p class="muted small">Analysis is a proposal only. Nothing becomes authoritative until you review and approve it.</p>
      </form>
    {:else}
      {@const proposal = form.impactProposal}
      <section class="card result-summary">
        <h2>Proposed authoritative v{proposal.baselineRevisionNumber + 1}</h2>
        <p><strong>{proposal.affectedTopics.length}</strong> affected existing topic(s), <strong>{proposal.newTopics.length}</strong> genuinely new topic(s), and <strong>{proposal.unchangedTopics.length}</strong> unchanged topic(s) carried forward.</p>
        <p class="muted small">Semantic boundary review checked the changed/new topics against the full resulting snapshot. Shared meaning may legitimately inform more than one topic when it plays a different explanatory role; the review repairs redundant duplication or true contamination instead. {proposal.boundaryReview.repairedTopicCount} topic{proposal.boundaryReview.repairedTopicCount === 1 ? '' : 's'} required boundary refinement before this proposal was shown.</p>
        {#if proposal.boundaryReview.notes.length}
          <details><summary>Boundary review details</summary>
            {#each proposal.boundaryReview.notes as note}<p class="muted small"><strong>{note.status}</strong> · {note.reason}</p>{/each}
          </details>
        {/if}
      </section>

      <section class="card">
        <h2>Affected topics</h2>
        {#each proposal.affectedTopics as topic}
          <article class="topic-change">
            <p class="eyebrow">{topic.effect}</p>
            <h3>{topic.realm} / {topic.topicName} · t{topic.topicVersionNumber} → t{topic.topicVersionNumber + 1}</h3>
            <p class="muted small">{topic.reason}</p>
            <h4>Current</h4><p>{topic.previousUnderstanding}</p>
            <h4>Proposed</h4><p>{topic.proposedUnderstanding}</p>
          </article>
        {/each}
      </section>

      {#if proposal.newTopics.length}
        <section class="card"><h2>Suggested new topics</h2>
          {#each proposal.newTopics as topic}
            <article class="topic-change"><h3>{topic.realm} / {topic.topicName}</h3><p class="muted small">{topic.reason}</p><p>{topic.proposedUnderstanding}</p></article>
          {/each}
        </section>
      {/if}

      <section class="card"><h2>Unchanged topics carried forward</h2>
        {#each proposal.unchangedTopics as topic}
          <p><strong>{topic.realm} / {topic.topicName}</strong> · keeps t{topic.topicVersionNumber}</p>
        {/each}
      </section>

      <form method="POST" action={actionUrl('approveImpact')} class="card approval">
        <input type="hidden" name="approvalToken" value={proposal.approvalToken} />
        <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id ?? ''} />
        <label><input type="checkbox" name="approve" value="YES" required /> Approve these changes as the next authoritative Living Understanding revision.</label>
        <button class="btn primary" type="submit">Approve and create v{proposal.baselineRevisionNumber + 1}</button>
        <p class="muted small">Approval updates private authoritative knowledge only. It grants no matching, disclosure or sharing permission.</p>
      </form>
    {/if}
  {/if}
</div>

<style>
  .page-shell{max-width:980px;margin:0 auto;padding:1.5rem}.card{border:1px solid var(--border-color,#ddd);border-radius:12px;padding:1rem;margin:1rem 0}.muted{opacity:.72}.small{font-size:.9rem}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;font-weight:700}.topic-change{padding:1rem 0;border-top:1px solid var(--border-color,#ddd)}.topic-change:first-of-type{border-top:0}.btn{padding:.65rem 1rem;border-radius:8px}.primary{font-weight:700}.error{color:#b42318}blockquote{white-space:pre-wrap}details{margin:.65rem 0}.approval label{display:block;margin-bottom:1rem}
</style>
