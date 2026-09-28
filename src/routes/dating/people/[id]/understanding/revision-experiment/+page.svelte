<script lang="ts">
  // This route is explicitly opt-in and read-only. Never add direct confirmation or sharing here.
  export let data: any;
  export let form: any;
  let topicId = '';
</script>
<svelte:head><title>Living Understanding revision experiment - Relish</title></svelte:head>
<main class="experiment">
  <a href={`/dating/people/${data.personId}/understanding${data.sourceId ? `?sourceInteractionId=${encodeURIComponent(data.sourceId)}` : ''}`}>← Return to existing understanding workflow</a>
  <h1>Living Understanding revision experiment</h1>
  <p>This is a separate, read-only experiment. It sends the selected conversation and ONLY the current claims assigned to one selected topic to the configured AI model. The existing knowledge review remains unchanged.</p>
  <p><strong>Nothing here is saved, confirmed, retired or made shareable.</strong> The proposed summary and changes are displayed only as the response to this request. Privacy-safe model invocation metadata may be recorded for auditing.</p>
  {#if !data.sourceId}
    <p class="warning">Open this experiment from a person's original reflection or conversation review to select an authorised source.</p>
  {:else if !data.topics.length}
    <p class="warning">Create a topic in Living Understanding first. The experiment needs an existing topic against which to compare the new conversation.</p>
  {:else}
    <form method="POST" action="?/run" class="panel">
      <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
      <label for="topic">Which existing understanding should be revised?</label>
      <select id="topic" name="topicId" bind:value={topicId} required>
        <option value="" disabled>Choose one topic</option>
        {#each data.topics as topic (topic.id)}
          <option value={topic.id}>{topic.label} ({topic.count} existing statements)</option>
        {/each}
      </select>
      <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending this private source and the selected topic's current statements to the configured AI provider for this experimental comparison.</label>
      <button type="submit">Generate read-only revised understanding</button>
      <p class="muted">The AI cannot approve changes or grant permission to share. Selecting a topic also limits the prior information sent to the model.</p>
    </form>
  {/if}
  {#if form?.revisionError}<p class="warning" role="alert">{form.revisionError}</p>{/if}
  {#if form?.revision}
    {@const revision = form.revision}
    <section class="panel" aria-label="Experimental revised understanding">
      <p class="eyebrow">EXPERIMENTAL RESULT - NOT SAVED</p>
      <h2>{revision.topicName}</h2>
      <h3>Proposed revised understanding</h3>
      <p class="understanding">{revision.draft.summary}</p>
      {#if revision.draft.errors.length}
        <div class="warning"><strong>Verification warnings. Do not treat this as an approved revision.</strong>
          <ul>{#each revision.draft.errors as item, i (i)}<li>{item}</li>{/each}</ul>
        </div>
      {/if}
      <h3>What happened to every previous statement?</h3>
      <p class="muted">Unreported previous statements are listed explicitly, rather than silently dropped.</p>
      {#each revision.existing as existing (existing.id)}
        {@const change = revision.draft.changes.find((item: any) => item.claimId === existing.id)}
        <article class="item">
          <p><strong>Previous:</strong> {existing.statement}</p>
          {#if change}
            <p><strong>Proposed action:</strong> {change.action.replaceAll('_', ' ')}</p>
            {#if change.proposedStatement}<p><strong>Suggested revision:</strong> {change.proposedStatement}</p>{/if}
            {#if change.reason}<p><strong>Reason supplied by the model:</strong> {change.reason}</p>{/if}
            {#if change.action !== 'UNCHANGED'}
              <p><strong>Evidence:</strong> {change.evidenceValid ? change.exactEvidence : 'No valid exact target-speaker evidence recovered.'}</p>
            {/if}
          {:else}
            <p class="warning">The model omitted this prior claim from its change record. It remains unchanged in Relish.</p>
          {/if}
        </article>
      {/each}
      <h3>Proposed new individual statements ({revision.draft.proposals.length})</h3>
      {#each revision.draft.proposals as item, i (i)}
        <article class="item">
          <p><strong>{item.kind}</strong> · {item.certainty}</p>
          <p>{item.statement}</p>
          <p><strong>Evidence:</strong> {item.evidenceValid ? item.exactEvidence : 'Invalid or misattributed passage - do not adopt.'}</p>
        </article>
      {/each}
      <p class="muted">Compare this experimental result with the existing Extract individual knowledge workflow using the same source. No change has been written to the database.</p>
    </section>
  {/if}
</main>
<style>
  .experiment { max-width: 920px; margin: 2rem auto; padding: 1rem; }
  .panel { border: 1px solid var(--border-color, #aaa); border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0; }
  form { display: grid; gap: 1rem; }
  select, button { padding: .65rem; }
  .consent { display: flex; align-items: flex-start; gap: .5rem; }
  .consent input { margin-top: .3rem; }
  .item { border-top: 1px solid var(--border-color, #aaa); padding: 1rem 0; }
  .understanding { white-space: pre-wrap; line-height: 1.6; }
  .warning { padding: 1rem; background: #fdf2da; color: #5d3b0c; border: 1px solid #d5a241; border-radius: 8px; }
  .muted { opacity: .8; }
  .eyebrow { font-size: .8rem; font-weight: bold; letter-spacing: .04em; }
</style>
