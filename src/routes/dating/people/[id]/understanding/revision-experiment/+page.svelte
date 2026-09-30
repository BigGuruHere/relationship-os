<script lang="ts">
  // IT: Enhanced form submissions keep the authorised sourceInteractionId in the browser URL.
  import { enhance } from '$app/forms';

  // This route is explicitly opt-in and read-only. Never add direct confirmation or sharing here.
  export let data: any;
  export let form: any;

  function serialiseOperationalUnits(units: any[]) {
    // IT: Keep source text out of hidden form state. The server resolves evidence from authorised turn IDs again.
    return JSON.stringify((units ?? []).map((unit: any) => ({
      unitId: unit.unitId,
      kind: unit.kind,
      certainty: unit.certainty,
      statement: unit.statement,
      operationalReasons: unit.operationalReasons,
      areaIds: unit.areaIds,
      evidenceTurnIds: unit.evidenceTurnIds
    })));
  }

  function linkedAreaLabels(unit: any) {
    const revisions = form?.revisions ?? [];
    return [...new Set((unit?.areaIds ?? [])
      .map((id: string) => revisions.find((revision: any) => (revision.sourceAreaIds ?? [revision.areaId]).includes(id))?.topicName)
      .filter(Boolean))]
      .join(', ');
  }
</script>

<svelte:head><title>Semantic Living Understanding experiment - Relish</title></svelte:head>

<main class="experiment">
  <a href={`/dating/people/${data.personId}/understanding${data.sourceId ? `?sourceInteractionId=${encodeURIComponent(data.sourceId)}` : ''}`}>← Return to existing understanding workflow</a>
  <h1>Semantic Living Understanding experiment</h1>
  <p>This read-only experiment separates a private source into distinct areas of understanding before proposing topic revisions. It also distinguishes rich Living Understanding from the smaller set of knowledge that may need its own operational or permission boundary.</p>
  <p><strong>Nothing here is saved, confirmed, retired, moved between topics, made discoverable or made shareable.</strong> Suggested topics and operational knowledge units are experimental proposals only.</p>

  {#if !data.sourceId}
    <p class="warning">Open this experiment from a person's original reflection or conversation review to select an authorised source.</p>
  {:else}
    <form method="POST" action="?/analyseTopics" class="panel" use:enhance>
      <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
      <h2>1. Decompose this source semantically</h2>
      <p>Dorian receives this private source plus the person's current topic inventory. It should identify all materially distinct areas, use the narrowest suitable existing topic, and suggest a new topic only where no suitable one exists.</p>
      <p>It may also propose a small set of independently controllable knowledge units, but only where information may need separate matching, permission, disclosure, verification, retrieval or action.</p>
      <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending this private source and the current topic inventory to the configured AI provider for this read-only experiment.</label>
      <button type="submit">Analyse semantic areas</button>
    </form>
  {/if}

  {#if form?.revisionError}<p class="warning" role="alert">{form.revisionError}</p>{/if}

  {#if form?.semanticAnalysis}
    <section class="panel">
      <p class="eyebrow">EXPERIMENTAL SEMANTIC DECOMPOSITION - NOT SAVED</p>
      <h2>Distinct areas Dorian found</h2>
      <p class="muted">An area may map to an existing topic or suggest a new topic. Suggested topics are not created.</p>

      {#if form.semanticAnalysis.analysis.errors.length}
        <div class="warning"><strong>Validation warnings</strong><ul>{#each form.semanticAnalysis.analysis.errors as item}<li>{item}</li>{/each}</ul></div>
      {/if}

      {#if form.semanticAnalysis.analysis.areas.length}
        <form method="POST" action="?/reviseTopics" class="revision-form" use:enhance>
          <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
          <input type="hidden" name="operationalUnitsJson" value={serialiseOperationalUnits(form.semanticAnalysis.analysis.operationalUnits)} />

          {#each form.semanticAnalysis.analysis.areas as area (area.areaId)}
            <label class="topic-card">
              <input type="checkbox" name="areaId" value={area.areaId} checked />
              <span class="topic-body">
                <span class="topic-title"><strong>{area.label}</strong> <span class="impact">{area.impact}</span></span>
                {#if area.proposedNewTopic}<span class="new-topic">SUGGESTED NEW TOPIC</span>{:else}<span class="existing-topic">EXISTING TOPIC</span>{/if}
                <span class="reason">{area.reason}</span>
                {#if area.relevantTurns?.length}
                  <span class="evidence-preview"><strong>Relevant source:</strong> {area.relevantTurns.map((turn: any) => turn.id).join(', ')}</span>
                {/if}
              </span>
            </label>
            <input type="hidden" name={`existingTopicId:${area.areaId}`} value={area.existingTopicId} />
            <input type="hidden" name={`realm:${area.areaId}`} value={area.realm} />
            <input type="hidden" name={`topicName:${area.areaId}`} value={area.topicName} />
            <input type="hidden" name={`impact:${area.areaId}`} value={area.impact} />
            <input type="hidden" name={`reason:${area.areaId}`} value={area.reason} />
            {#each area.relevantTurnIds ?? [] as turnId}
              <input type="hidden" name={`relevantTurnId:${area.areaId}`} value={turnId} />
            {/each}
          {/each}

          {#if form.semanticAnalysis.analysis.operationalUnits.length}
            <div class="operational-preview">
              <h3>Proposed independently controllable knowledge</h3>
              <p class="muted">These are deliberately selective. They are proposed only because they may need an independent verification, matching, permission, disclosure, retrieval or action boundary.</p>
              {#each form.semanticAnalysis.analysis.operationalUnits as unit (unit.unitId)}
                <article class="item">
                  <p><strong>{unit.kind}</strong> · {unit.certainty}</p>
                  <p>{unit.statement}</p>
                  <p class="muted"><strong>Why atomic:</strong> {unit.operationalReasons.join(', ')}</p>
                  <p class="muted"><strong>Linked areas:</strong> {unit.areaIds.join(', ')}</p>
                  {#if unit.evidenceValid && unit.evidenceTurns?.length}
                    <div class="evidence-block"><strong>Source evidence ({unit.evidenceTurns.map((turn: any) => turn.id).join(', ')})</strong>
                      {#each unit.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text || '[Source turn text unavailable]'}</span></blockquote>{/each}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}
            <p class="muted">No separate operational knowledge unit was proposed. That is valid: not every useful piece of understanding needs to become an atomic record.</p>
          {/if}

          <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending the selected semantic areas, their existing claims and this private source to the configured AI provider for read-only revision.</label>
          <button type="submit">Generate selected topic understandings</button>
        </form>
      {:else}
        <p>No materially distinct enduring area was identified.</p>
      {/if}
    </section>
  {/if}

  {#if form?.revisions}
    <section class="panel">
      <p class="eyebrow">EXPERIMENTAL TOPIC UNDERSTANDINGS - NOT SAVED</p>
      <h2>Proposed Living Understanding by topic target</h2>
      <p class="muted">Relish consolidates multiple selected semantic areas when they target the same topic, so one topic receives only one proposed current understanding. Each revision is then bounded to that topic's validated source turns and semantic scope rather than re-reading the whole conversation.</p>
      {#if form.revisionBatchSummary}
        <p class="muted"><strong>Safe batching:</strong> {form.revisionBatchSummary.selectedAreaCount} selected semantic areas became {form.revisionBatchSummary.targetCount} topic targets and were processed in {form.revisionBatchSummary.batchCount} batch{form.revisionBatchSummary.batchCount === 1 ? '' : 'es'} of at most {form.revisionBatchSummary.batchSize}. The eight-area batch size is no longer a selection limit.</p>
      {/if}
      {#each form.revisions as revision (revision.areaId)}
        <article class="revision">
          <h3>{revision.topicName}</h3>
          {#if revision.proposedNewTopic}<p class="new-topic">SUGGESTED NEW TOPIC - NOT CREATED</p>{/if}
          {#if revision.sourceAreaIds?.length > 1}<p class="muted"><strong>Combined semantic areas:</strong> {revision.sourceAreaIds.join(', ')}</p>{/if}
          <h4>Proposed current understanding</h4>
          <p class="understanding">{revision.draft.summary}</p>

          {#if revision.draft.errors.length}
            <div class="warning"><strong>Verification warnings. Do not treat this as an approved revision.</strong>
              <ul>{#each revision.draft.errors as item}<li>{item}</li>{/each}</ul>
            </div>
          {/if}

          {#if revision.existing.length}
            <h4>What happened to the existing statements in this topic?</h4>
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
                      <div class="evidence-block"><strong>Source evidence ({change.evidenceTurns.map((turn: any) => turn.id).join(', ')})</strong>
                        {#each change.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text || '[Source turn text unavailable]'}</span></blockquote>{/each}
                      </div>
                    {:else}
                      <p class="warning">No valid target-speaker turn evidence was recovered. Do not adopt this proposal.</p>
                    {/if}
                  {/if}
                {:else}
                  <p class="warning">The model omitted this prior claim. Relish has not changed it.</p>
                {/if}
              </article>
            {/each}
          {:else}
            <p class="muted">This is a proposed new topic, so there are no existing statements to revise.</p>
          {/if}
        </article>
      {/each}

      <h3>Independently controllable knowledge proposed by the decomposition</h3>
      <p class="muted">This is not intended to reproduce the whole Living Understanding. These units exist only where separate operational control may matter.</p>
      {#if form.operationalErrors?.length}
        <div class="warning"><strong>Operational knowledge validation warnings</strong><ul>{#each form.operationalErrors as item}<li>{item}</li>{/each}</ul></div>
      {/if}
      {#if form.operationalUnits?.length}
        {#each form.operationalUnits as unit (unit.unitId)}
          <article class="item">
            <p><strong>{unit.kind}</strong> · {unit.certainty}</p>
            <p>{unit.statement}</p>
            <p class="muted"><strong>Why atomic:</strong> {unit.operationalReasons.join(', ')}</p>
            <p class="muted"><strong>Linked topic understandings:</strong> {linkedAreaLabels(unit) || unit.areaIds.join(', ')}</p>
            {#if unit.evidenceValid && unit.evidenceTurns?.length}
              <div class="evidence-block"><strong>Source evidence ({unit.evidenceTurns.map((turn: any) => turn.id).join(', ')})</strong>
                {#each unit.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text || '[Source turn text unavailable]'}</span></blockquote>{/each}
              </div>
            {:else}
              <p class="warning">No valid target-speaker turn evidence was recovered. Do not adopt this proposal.</p>
            {/if}
          </article>
        {/each}
      {:else}
        <p>No separate operational knowledge units were proposed for the selected areas.</p>
      {/if}
      {#if form.longitudinalSeed?.length}
        <p class="muted"><strong>Longitudinal test preparation:</strong> this read-only result now carries stable topic-target keys and source provenance so a later experiment can compare a second conversation against these proposed understandings without saving them as authoritative knowledge.</p>
      {/if}
      <p class="muted">No understanding, topic, statement, permission or sharing rule has been written to the database.</p>
    </section>
  {/if}
</main>

<style>
  .experiment { max-width: 980px; margin: 2rem auto; padding: 1rem; }
  .panel { border: 1px solid var(--border-color, #aaa); border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0; }
  form { display: grid; gap: 1rem; }
  button { padding: .65rem; }
  .consent, .topic-card { display: flex; align-items: flex-start; gap: .65rem; }
  .consent input, .topic-card > input { margin-top: .3rem; }
  .topic-card { border-top: 1px solid var(--border-color, #aaa); padding: .9rem 0; }
  .topic-body, .reason, .evidence-preview, .new-topic, .existing-topic { display: block; }
  .topic-title { display: block; margin-bottom: .3rem; }
  .reason { margin-top: .45rem; }
  .new-topic, .existing-topic { margin-top: .3rem; font-size: .72rem; font-weight: bold; letter-spacing: .04em; }
  .item { border-top: 1px solid var(--border-color, #aaa); padding: 1rem 0; }
  .revision + .revision { border-top: 3px solid var(--border-color, #aaa); margin-top: 2rem; padding-top: 1.5rem; }
  .understanding { white-space: pre-wrap; line-height: 1.6; }
  .warning { padding: 1rem; background: #fdf2da; color: #5d3b0c; border: 1px solid #d5a241; border-radius: 8px; }
  .muted { opacity: .8; }
  .eyebrow { font-size: .8rem; font-weight: bold; letter-spacing: .04em; }
  .impact { font-size: .75rem; font-weight: bold; margin-left: .5rem; }
  .evidence-preview { margin-top: .4rem; font-size: .85rem; opacity: .8; }
  .evidence-block { margin-top: .75rem; }
  .turn-text { margin-left: .5rem; }
  blockquote { margin: .6rem 0; padding: .75rem 1rem; border-left: 3px solid var(--border-color, #aaa); white-space: pre-wrap; }
  .turn-id { font-size: .75rem; font-weight: bold; opacity: .7; }
  .operational-preview { margin-top: 1rem; padding-top: .5rem; border-top: 2px solid var(--border-color, #aaa); }
</style>
