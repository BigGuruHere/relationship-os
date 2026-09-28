<script lang="ts">
  // IT: Enhanced form submissions keep the authorised sourceInteractionId in the browser URL.
  import { enhance } from '$app/forms';

  // This route is explicitly opt-in and read-only. Never add direct confirmation or sharing here.
  export let data: any;
  export let form: any;
</script>

<svelte:head><title>Topic-aware Living Understanding experiment - Relish</title></svelte:head>

<main class="experiment">
  <a href={`/dating/people/${data.personId}/understanding${data.sourceId ? `?sourceInteractionId=${encodeURIComponent(data.sourceId)}` : ''}`}>← Return to existing understanding workflow</a>
  <h1>Topic-aware Living Understanding revision experiment</h1>
  <p>This read-only experiment first asks which existing topics the new source appears to affect. You then choose which suggested topics Dorian should revise. The existing knowledge workflow remains unchanged.</p>
  <p><strong>Nothing here is saved, confirmed, retired, moved between topics or made shareable.</strong> Every result is an experimental proposal only.</p>

  {#if !data.sourceId}
    <p class="warning">Open this experiment from a person's original reflection or conversation review to select an authorised source.</p>
  {:else if !data.topics.length}
    <p class="warning">Create at least one topic in Living Understanding first. This experiment compares a new source with existing topic knowledge.</p>
  {:else}
    <form method="POST" action="?/analyseTopics" class="panel" use:enhance>
      <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
      <h2>1. Identify affected topics</h2>
      <p>Dorian receives the selected private source plus this person's current topic names and statements. It proposes which topic understandings appear materially affected and may suggest a new topic where nothing suitable exists.</p>
      <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending this private source and the current topic inventory to the configured AI provider for this read-only experiment.</label>
      <button type="submit">Analyse affected topics</button>
    </form>
  {/if}

  {#if form?.revisionError}<p class="warning" role="alert">{form.revisionError}</p>{/if}

  {#if form?.topicAnalysis}
    <section class="panel">
      <p class="eyebrow">EXPERIMENTAL TOPIC ANALYSIS - NOT SAVED</p>
      <h2>Topics Dorian thinks this source affects</h2>
      {#if form.topicAnalysis.analysis.errors.length}
        <div class="warning"><strong>Validation warnings</strong><ul>{#each form.topicAnalysis.analysis.errors as item}<li>{item}</li>{/each}</ul></div>
      {/if}
      {#if form.topicAnalysis.analysis.impacts.length}
        <form method="POST" action="?/reviseTopics" class="revision-form" use:enhance>
          <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
          {#each form.topicAnalysis.analysis.impacts as item (item.topicId)}
            <label class="topic-card">
              <input type="checkbox" name="topicId" value={item.topicId} checked />
              <span><strong>{item.label}</strong> <span class="impact">{item.impact}</span><br />{item.reason}</span>
            </label>
          {/each}
          <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending the selected topic claims and this private source to the configured AI provider for read-only revision.</label>
          <button type="submit">Generate selected topic revisions</button>
        </form>
      {:else}
        <p>No existing topic was identified as materially affected.</p>
      {/if}

      {#if form.topicAnalysis.analysis.newTopics.length}
        <h3>Possible new topics</h3>
        <p class="muted">These are suggestions only. This experiment does not create topics.</p>
        {#each form.topicAnalysis.analysis.newTopics as item}
          <article class="item"><p><strong>{item.realm} / {item.name}</strong></p><p>{item.reason}</p></article>
        {/each}
      {/if}
    </section>
  {/if}

  {#if form?.revisions}
    <section class="panel">
      <p class="eyebrow">EXPERIMENTAL REVISIONS - NOT SAVED</p>
      <h2>Proposed topic understandings</h2>
      {#each form.revisions as revision (revision.topicId)}
        <article class="revision">
          <h3>{revision.topicName}</h3>
          <h4>Proposed revised understanding</h4>
          <p class="understanding">{revision.draft.summary}</p>
          {#if revision.draft.errors.length}
            <div class="warning"><strong>Verification warnings. Do not treat this as an approved revision.</strong>
              <ul>{#each revision.draft.errors as item}<li>{item}</li>{/each}</ul>
            </div>
          {/if}

          <h4>Previous statements</h4>
          {#each revision.existing as existing (existing.id)}
            {@const change = revision.draft.changes.find((item: any) => item.claimId === existing.id)}
            <article class="item">
              <p><strong>Previous:</strong> {existing.statement}</p>
              <p class="muted">Recorded authority: {existing.authority}{existing.confidence ? ` · confidence ${existing.confidence}` : ''}</p>
              {#if change}
                <p><strong>Proposed action:</strong> {change.action.replaceAll('_', ' ')}</p>
                {#if change.proposedStatement}<p><strong>Suggested revision:</strong> {change.proposedStatement}</p>{/if}
                {#if change.reason}<p><strong>Reason:</strong> {change.reason}</p>{/if}
                {#if change.action !== 'UNCHANGED'}
                  {#if change.evidenceValid && change.evidenceTurns?.length}
                    <details><summary><strong>Source evidence ({change.evidenceTurns.map((turn: any) => turn.id).join(', ')})</strong></summary>
                      {#each change.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span> {turn.text}</blockquote>{/each}
                    </details>
                  {:else}
                    <p class="warning">No valid target-speaker turn evidence was recovered. Do not adopt this proposal.</p>
                  {/if}
                {/if}
              {:else}
                <p class="warning">The model omitted this prior claim. Relish has not changed it.</p>
              {/if}
            </article>
          {/each}

          <h4>Proposed new individual statements ({revision.draft.proposals.length})</h4>
          {#each revision.draft.proposals as item}
            <article class="item">
              <p><strong>{item.kind}</strong> · {item.certainty}</p>
              <p>{item.statement}</p>
              {#if item.evidenceValid && item.evidenceTurns?.length}
                <details><summary><strong>Source evidence ({item.evidenceTurns.map((turn: any) => turn.id).join(', ')})</strong></summary>
                  {#each item.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span> {turn.text}</blockquote>{/each}
                </details>
              {:else}
                <p class="warning">No valid target-speaker turn evidence was recovered. Do not adopt this proposal.</p>
              {/if}
            </article>
          {/each}
        </article>
      {/each}
      <p class="muted">Turn references are validated against the selected speaker before display. No generated quotation is trusted as evidence and no result has been written to the database.</p>
    </section>
  {/if}
</main>

<style>
  .experiment { max-width: 980px; margin: 2rem auto; padding: 1rem; }
  .panel { border: 1px solid var(--border-color, #aaa); border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0; }
  form { display: grid; gap: 1rem; }
  button { padding: .65rem; }
  .consent, .topic-card { display: flex; align-items: flex-start; gap: .65rem; }
  .consent input, .topic-card input { margin-top: .3rem; }
  .topic-card { border-top: 1px solid var(--border-color, #aaa); padding: .9rem 0; }
  .item { border-top: 1px solid var(--border-color, #aaa); padding: 1rem 0; }
  .revision + .revision { border-top: 3px solid var(--border-color, #aaa); margin-top: 2rem; padding-top: 1.5rem; }
  .understanding { white-space: pre-wrap; line-height: 1.6; }
  .warning { padding: 1rem; background: #fdf2da; color: #5d3b0c; border: 1px solid #d5a241; border-radius: 8px; }
  .muted { opacity: .8; }
  .eyebrow { font-size: .8rem; font-weight: bold; letter-spacing: .04em; }
  .impact { font-size: .75rem; font-weight: bold; margin-left: .5rem; }
  blockquote { margin: .6rem 0; padding: .75rem 1rem; border-left: 3px solid var(--border-color, #aaa); white-space: pre-wrap; }
  .turn-id { font-size: .75rem; font-weight: bold; opacity: .7; }
</style>
