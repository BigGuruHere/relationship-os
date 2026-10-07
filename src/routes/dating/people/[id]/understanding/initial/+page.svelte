<script lang="ts">
  // IT: Enhanced form submissions keep the authorised sourceInteractionId in the browser URL.
  import { enhance } from '$app/forms';

  // IT: This route supports the production first-v1 workflow when initial=1, while retaining the
  // development experiment mode for diagnostics. Persistence still requires explicit final approval.
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
      evidenceTurnIds: unit.evidenceTurnIds,
      status: unit.status
    })));
  }

  function linkedAreaLabels(unit: any) {
    const revisions = form?.revisions ?? [];
    return [...new Set((unit?.areaIds ?? [])
      .map((id: string) => revisions.find((revision: any) => (revision.sourceAreaIds ?? [revision.areaId]).includes(id))?.topicName)
      .filter(Boolean))]
      .join(', ');
  }

  function serialiseLongitudinalSeed(seed: any[]) {
    // IT: The seed contains only prior experimental topic summaries and provenance, never raw source text.
    return JSON.stringify(seed ?? []);
  }

  function serialiseChainHistory(history: any[]) {
    // IT: History contains concise proposed understanding snapshots only, never raw transcript text.
    return JSON.stringify(history ?? []);
  }

  function laterSourcesAfter(sourceDate: string, sourceId: string) {
    const after = new Date(sourceDate).getTime();
    return (data?.laterSources ?? []).filter((source: any) =>
      source.id !== sourceId && Number.isFinite(after) && new Date(source.at).getTime() > after
    );
  }

  function priorOperationalStatement(unitId: string) {
    return form?.longitudinal?.priorOperationalUnits?.find((unit: any) => unit.unitId === unitId)?.statement ?? unitId;
  }

  function remainingLongitudinalSources() {
    // IT: Keep this derived list in script rather than using {@const} inside a DOM element.
    // Svelte only permits {@const} as the immediate child of specific block/component constructs.
    return laterSourcesAfter(form?.longitudinal?.nextSourceDate, form?.longitudinal?.nextSourceInteractionId);
  }

  function remainingRestructureSources() {
    return laterSourcesAfter(form?.restructuring?.latestSourceDate, form?.restructuring?.latestSourceInteractionId);
  }
</script>

<svelte:head><title>{data.initialCreationMode ? 'Create initial Living Understanding' : 'Semantic Living Understanding experiment'} - Relish</title></svelte:head>

<main class="experiment">
  <a href={`/dating/people/${data.personId}/understanding${data.sourceId ? `?sourceInteractionId=${encodeURIComponent(data.sourceId)}` : ''}`}>← Back to reflection review</a>
  {#if data.initialCreationMode}
    <p class="eyebrow">Initial Living Understanding</p>
    <h1>Create initial Living Understanding</h1>
    <p>Build the person's first authoritative Living Understanding from this private source. Relish will identify distinct areas, propose topic understandings, validate the topic structure, then ask you to approve the complete result as <strong>authoritative v1</strong>.</p>
    <div class="workflow-steps" aria-label="Initial Living Understanding workflow">
      <span>1. Analyse source</span><span>2. Generate topic understandings</span><span>3. Review structure</span><span>4. Approve v1</span>
    </div>
    <p class="muted"><strong>Nothing is authoritative until the final approval step.</strong> Working checkpoints may be saved privately so a failed validation step can be retried without repeating successful work. Creating v1 grants no matching, sharing or disclosure permission.</p>
  {:else}
    <h1>Semantic Living Understanding experiment</h1>
    <p>This development experiment separates a private source into distinct areas of understanding before proposing topic revisions. It also distinguishes rich Living Understanding from the smaller set of knowledge that may need its own operational or permission boundary.</p>
    <p><strong>Nothing here is authoritative, confirmed, retired, made discoverable or made shareable.</strong> Relish may save short-lived encrypted working checkpoints so a failed later stage does not force you to repeat successful comparisons. Suggested topics and operational knowledge units remain experimental until explicitly approved.</p>
  {/if}

  {#if data.latestDraft && String(data.latestDraft.stage || '').startsWith('STRUCTURE')}
    <section class="panel">
      <h2>{data.initialCreationMode ? 'Resume initial Living Understanding review' : 'Resume saved structural checkpoint'}</h2>
      <p class="muted">A short-lived encrypted working checkpoint exists for this person. Retrying resumes the structural validation stage without repeating successful earlier analysis. Nothing becomes authoritative until you approve v1.</p>
      <form method="POST" action="?/retryRestructuring" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
        <input type="hidden" name="draftCheckpointId" value={data.latestDraft.id} />
        <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise retrying structural review from the saved private working checkpoint.</label>
        <button type="submit">Resume structural review</button>
      </form>
    </section>
  {/if}

  {#if !data.sourceId}
    <p class="warning">Open this workflow from a person's original reflection or conversation review to select an authorised source.</p>
  {:else}
    <form method="POST" action="?/analyseTopics" class="panel" use:enhance>
      <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
      <input type="hidden" name="sourceInteractionId" value={data.sourceId} />
      <h2>1. Analyse this source</h2>
      <p>Dorian reviews this private source and identifies the materially distinct areas that belong in the person's Living Understanding. Existing topic names may guide placement, but no topic or understanding is saved at this stage.</p>
      {#if !data.initialCreationMode}
        <p>It may also propose a small set of independently controllable knowledge units, but only where information may need separate matching, permission, disclosure, verification, retrieval or action.</p>
      {/if}
      <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise AI processing of this private source to propose the initial Living Understanding.</label>
      <button type="submit">Analyse source</button>
    </form>
  {/if}

  {#if form?.revisionError}<p class="warning" role="alert">{form.revisionError}</p>{/if}

  {#if form?.semanticAnalysis}
    <section class="panel">
      <p class="eyebrow">STEP 1 RESULT - NOT YET AUTHORITATIVE</p>
      <h2>Proposed areas of understanding</h2>
      <p class="muted">Select the areas that should contribute to the initial Living Understanding. Suggested topic names remain proposals until final approval.</p>

      {#if form.semanticAnalysis.analysis.errors.length}
        <div class="warning"><strong>Validation warnings</strong><ul>{#each form.semanticAnalysis.analysis.errors as item}<li>{item}</li>{/each}</ul></div>
      {/if}

      {#if form.semanticAnalysis.analysis.areas.length}
        <form method="POST" action="?/reviseTopics" class="revision-form" use:enhance>
          <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
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

          {#if !data.initialCreationMode && form.semanticAnalysis.analysis.operationalUnits.length}
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
          {:else if !data.initialCreationMode}
            <p class="muted">No separate operational knowledge unit was proposed. That is valid: not every useful piece of understanding needs to become an atomic record.</p>
          {/if}

          <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise AI processing of the selected areas and their supporting source material to draft topic understandings.</label>
          <button type="submit">2. Generate selected topic understandings</button>
        </form>
      {:else}
        <p>No materially distinct enduring area was identified.</p>
      {/if}
    </section>
  {/if}

  {#if form?.revisions}
    <section class="panel">
      <p class="eyebrow">STEP 2 RESULT - NOT YET AUTHORITATIVE</p>
      <h2>Proposed topic understandings</h2>
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

      {#if !data.initialCreationMode}
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
      {/if}

      {#if data.initialCreationMode && form.longitudinalSeed?.length}
        <div class="restructure-start production-next-step">
          <p class="eyebrow">Next step</p>
          <h3>3. Review the complete topic structure</h3>
          <p class="muted">Relish will now check whether the proposed topics should be kept, split, narrowed, merged, moved or renamed, while preserving the meaning supported by the source. This validation must pass before v1 can be approved.</p>
          <form method="POST" action="?/restructureTopics" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
            <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.longitudinalSeed)} />
            <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.operationalUnits ?? [])} />
            <input type="hidden" name="chainHistoryJson" value="[]" />
            <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id || ''} />
            <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise AI processing of the proposed topic understandings for structural validation before creating v1.</label>
            <button type="submit">3. Review topic structure</button>
          </form>
        </div>

        {#if data.laterSources?.length}
          <details class="optional-source">
            <summary>Add another source before creating v1</summary>
            <p class="muted">Optional. If the first Living Understanding should incorporate another later reflection or conversation before approval, compare it here. Otherwise continue directly to structural review above.</p>
            <form method="POST" action="?/compareLongitudinal" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
              <input type="hidden" name="baselineSourceInteractionId" value={data.sourceId} />
              <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.longitudinalSeed)} />
              <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.operationalUnits ?? [])} />
              <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id || ''} />
              <label>Additional source
                <select name="nextSourceInteractionId" required>
                  <option value="">Choose a later source</option>
                  {#each data.laterSources as source}
                    <option value={source.id}>{new Date(source.at).toLocaleString()} · {source.sourceKind === 'CONVERSATION_EXCERPT' ? `Conversation${source.speaker ? ` - ${source.speaker}` : ''}` : 'Reflection'}</option>
                  {/each}
                </select>
              </label>
              <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise AI processing of this additional private source with the current proposed initial understanding.</label>
              <button type="submit">Add source to proposed v1</button>
            </form>
          </details>
        {/if}
      {/if}

      {#if form.longitudinalSeed?.length && !data.initialCreationMode}
        <p class="muted"><strong>Longitudinal test preparation:</strong> this read-only result carries stable topic-target keys and source provenance so a later source can be compared without saving this baseline as authoritative knowledge.</p>

        <div class="longitudinal">
          <h3>2. Test a later conversation or reflection</h3>
          <p>Choose a later private source for this same person. Relish will explicitly account for every topic understanding above and classify the later source as unchanged, reinforced, refined, expanded, qualified, contradicted or superseded.</p>
          {#if data.laterSources?.length}
            <form method="POST" action="?/compareLongitudinal" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
              <input type="hidden" name="baselineSourceInteractionId" value={data.sourceId} />
              <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.longitudinalSeed)} />
              <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.operationalUnits ?? [])} />
              <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id || ''} />
              <label>Later source
                <select name="nextSourceInteractionId" required>
                  <option value="">Choose a later source</option>
                  {#each data.laterSources as source}
                    <option value={source.id}>{new Date(source.at).toLocaleString()} · {source.sourceKind === 'CONVERSATION_EXCERPT' ? `Conversation${source.speaker ? ` - ${source.speaker}` : ''}` : 'Reflection'}</option>
                  {/each}
                </select>
              </label>
              <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending the selected later source and this read-only experimental baseline to the configured AI provider for longitudinal comparison.</label>
              <button type="submit">Compare later source with this understanding</button>
            </form>
          {:else}
            <p class="muted">There is no later private conversation or reflection for this person yet. Add or import a later source, then reopen this baseline experiment to continue the longitudinal test.</p>
          {/if}
        </div>
      {/if}
      <p class="muted">No understanding, topic, statement, permission or sharing rule has been written to the database.</p>
    </section>
  {/if}

  {#if form?.longitudinal}
    <section class="panel">
      <p class="eyebrow">EXPERIMENTAL LONGITUDINAL EVOLUTION - NOT SAVED</p>
      <h2>How the later source changes the Living Understanding</h2>
      <p class="muted">Every prior topic target is explicitly accounted for. Absence from the later source is not treated as contradiction or supersession.</p>

      {#if form.longitudinal.topicAnalysis.errors?.length}
        <div class="warning"><strong>Topic evolution validation warnings</strong><ul>{#each form.longitudinal.topicAnalysis.errors as item}<li>{item}</li>{/each}</ul></div>
      {/if}

      {#each form.longitudinal.evolutions as evolution (evolution.targetKey)}
        <article class="revision">
          <h3>{evolution.topicName} <span class="impact">{evolution.effect}</span></h3>
          {#if evolution.effect === 'NEW_TOPIC'}<p class="new-topic">SUGGESTED NEW TOPIC - NOT CREATED</p>{/if}
          {#if evolution.previousUnderstanding}
            <h4>Previous understanding</h4>
            <p class="understanding">{evolution.previousUnderstanding}</p>
          {/if}
          <h4>Proposed current understanding</h4>
          <p class="understanding">{evolution.proposedUnderstanding}</p>
          <p><strong>What changed:</strong> {evolution.reason || 'No material change reported.'}</p>
          {#if evolution.relevantTurns?.length}
            <div class="evidence-block"><strong>Later source evidence ({evolution.relevantTurns.map((turn: any) => turn.id).join(', ')})</strong>
              {#each evolution.relevantTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text}</span></blockquote>{/each}
            </div>
          {:else if evolution.effect !== 'UNCHANGED'}
            <p class="warning">No valid later-source evidence was recovered for this proposed change. Do not adopt it.</p>
          {/if}
        </article>
      {/each}

      <h3>Operational knowledge evolution</h3>
      <p class="muted">These are still experimental proposals. A later source cannot silently retire a prior permissionable unit.</p>
      {#if form.longitudinal.operationalAnalysis.errors?.length}
        <div class="warning"><strong>Operational validation warnings</strong><ul>{#each form.longitudinal.operationalAnalysis.errors as item}<li>{item}</li>{/each}</ul></div>
      {/if}
      {#each form.longitudinal.operationalAnalysis.changes as change (change.unitId)}
        <article class="item">
          <p><strong>{change.action}</strong></p>
          <p><strong>Previous:</strong> {priorOperationalStatement(change.unitId)}</p>
          {#if change.proposedStatement}<p><strong>Proposed:</strong> {change.proposedStatement}</p>{/if}
          {#if change.reason}<p>{change.reason}</p>{/if}
          {#if change.evidenceTurns?.length}
            <div class="evidence-block"><strong>Later source evidence</strong>{#each change.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text}</span></blockquote>{/each}</div>
          {/if}
        </article>
      {/each}
      {#if form.longitudinal.operationalAnalysis.additions?.length}
        <h4>Proposed new independently controllable knowledge</h4>
        <p class="muted">Only durable propositions that may genuinely need their own persistent rule belong here.</p>
        {#each form.longitudinal.operationalAnalysis.additions as unit (unit.unitId)}
          <article class="item">
            <p><strong>{unit.kind}</strong> · {unit.certainty}</p>
            <p>{unit.statement}</p>
            <p class="muted"><strong>Why atomic:</strong> {unit.operationalReasons.join(', ')}</p>
            {#if unit.evidenceTurns?.length}
              <div class="evidence-block"><strong>Later source evidence</strong>{#each unit.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text}</span></blockquote>{/each}</div>
            {/if}
          </article>
        {/each}
      {/if}
      {#if form.longitudinal.operationalAnalysis.interactionState?.length}
        <h4>Temporary interaction state</h4>
        <p class="muted">These are session-level choices or instructions. They are shown for review but are not proposed as enduring person knowledge.</p>
        {#each form.longitudinal.operationalAnalysis.interactionState as state (state.stateId)}
          <article class="item">
            <p>{state.statement}</p>
            {#if state.evidenceTurns?.length}
              <div class="evidence-block"><strong>Later source evidence</strong>{#each state.evidenceTurns as turn}<blockquote><span class="turn-id">{turn.id}</span><span class="turn-text">{turn.text}</span></blockquote>{/each}</div>
            {/if}
          </article>
        {/each}
      {/if}

      {#if form.longitudinal.chainHistory?.length}
        <div class="chain-history">
          <h3>Read-only evolution chain</h3>
          <p class="muted">Each version is temporary experiment state. The next comparison starts from the latest proposed understanding, not from the raw previous conversation alone.</p>
          {#each form.longitudinal.chainHistory as version}
            <details class="chain-version" open={version.version === form.longitudinal.chainHistory[form.longitudinal.chainHistory.length - 1]?.version}>
              <summary><strong>v{version.version}</strong> · {new Date(version.sourceDate).toLocaleString()} · {version.topics.length} topic{version.topics.length === 1 ? '' : 's'}{version.version > 1 ? ` · ${version.changedTopicCount} changed · ${version.newTopicCount} new` : ' · baseline'}</summary>
              {#each version.topics as topic (topic.targetKey)}
                <article class="chain-topic">
                  <strong>{topic.topicName}</strong>
                  <p>{topic.proposedUnderstanding}</p>
                </article>
              {/each}
            </details>
          {/each}
        </div>
      {/if}

      <div class="longitudinal continue-chain">
        <h3>Continue with another later source</h3>
        <p>Carry this proposed version forward as the temporary baseline, then compare the next conversation or reflection. Nothing is saved as authoritative knowledge.</p>
        {#if remainingLongitudinalSources().length}
          <form method="POST" action="?/compareLongitudinal" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
            <input type="hidden" name="baselineSourceInteractionId" value={form.longitudinal.nextSourceInteractionId} />
            <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.longitudinal.nextLongitudinalSeed)} />
            <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.longitudinal.nextOperationalUnits)} />
            <input type="hidden" name="chainHistoryJson" value={serialiseChainHistory(form.longitudinal.chainHistory)} />
            <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id || ''} />
            <label>Next later source
              <select name="nextSourceInteractionId" required>
                <option value="">Choose the next source</option>
                {#each remainingLongitudinalSources() as source}
                  <option value={source.id}>{new Date(source.at).toLocaleString()} · {source.sourceKind === 'CONVERSATION_EXCERPT' ? `Conversation${source.speaker ? ` - ${source.speaker}` : ''}` : 'Reflection'}</option>
                {/each}
              </select>
            </label>
            <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending this next private source and the latest temporary read-only understanding to the configured AI provider.</label>
            <button type="submit">Continue chain with this source</button>
          </form>
        {:else}
          <p class="muted">There is no private source later than the one just compared. Add or import another later source for this person, then reopen the experiment chain.</p>
        {/if}
      </div>

      <div class="restructure-start">
        <h3>Review the topic structure</h3>
        <p class="muted">Run a structural review of the latest proposed Living Understanding. This can suggest splitting, narrowing, merging, moving or renaming topics without changing the underlying meaning.</p>
        <form method="POST" action="?/restructureTopics" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
          <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.longitudinal.nextLongitudinalSeed)} />
          <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.longitudinal.nextOperationalUnits)} />
          <input type="hidden" name="chainHistoryJson" value={serialiseChainHistory(form.longitudinal.chainHistory)} />
            <input type="hidden" name="draftCheckpointId" value={form.draftCheckpoint?.id || ''} />
          <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending the current temporary read-only understanding to the configured AI provider for structural review.</label>
          <button type="submit">Review topic structure</button>
        </form>
      </div>

      <p class="muted"><strong>Read-only:</strong> this comparison has not created, changed, retired, confirmed or shared any stored knowledge or temporary interaction state.</p>
    </section>
  {/if}

  {#if form?.restructuring}
    <section class="panel">
      <p class="eyebrow">{data.initialCreationMode ? 'STEP 3 RESULT - READY FOR FINAL REVIEW' : 'EXPERIMENTAL TOPIC RESTRUCTURING - NOT SAVED'}</p>
      <h2>{data.initialCreationMode ? 'Final proposed Living Understanding v1' : 'Proposed cleaner Living Understanding structure'}</h2>
      <p class="muted">{data.initialCreationMode ? 'Review the complete proposed v1 below. Structural validation may split, narrow, merge, move or rename topics, but it must preserve supported meaning. Nothing is authoritative until you approve the final result.' : 'This is a structural proposal only. It may split, narrow, merge, move or rename topics, but it must not add facts, erase prior meaning, resolve contradictions or change uncertainty.'}</p>

      {#if form.restructuring.repairAttempted}
        <p class="muted"><strong>Validator-guided repair:</strong> {form.restructuring.repairSucceeded ? 'The first structural response failed deterministic validation, so Relish ran one bounded repair pass and this is the repaired result.' : 'The first structural response failed deterministic validation and one bounded repair pass was attempted. The result still has blocking validation warnings below.'}</p>
      {/if}

      {#if form.restructuring.analysis.errors?.length}
        <div class="warning"><strong>Structural validation warnings. Do not adopt this proposal.</strong><ul>{#each form.restructuring.analysis.errors as item}<li>{item}</li>{/each}</ul></div>
        {#if form.restructuring.draftCheckpointId}
          <div class="continue-chain">
            <h3>Retry only the structural stage</h3>
            <p class="muted">The successful comparison chain is saved as a temporary encrypted checkpoint. You do not need to repeat the earlier source comparisons. Relish will retry structural review from that checkpoint and preserve all validated earlier work.</p>
            <form method="POST" action="?/retryRestructuring" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
              <input type="hidden" name="draftCheckpointId" value={form.restructuring.draftCheckpointId} />
              <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise retrying structural review from this saved private working checkpoint.</label>
              <button type="submit">Retry structural review only</button>
            </form>
          </div>
        {/if}
      {/if}

      {#if form.restructuring.analysis.audits?.length}
        <h3>Structural contamination audit</h3>
        <p class="muted">Before choosing KEEP, Dorian checks whether each prior topic contains distinct concepts that could evolve independently, belong elsewhere, mismatch the topic name, or duplicate another topic.</p>
        {#each form.restructuring.analysis.audits as audit (audit.targetKey)}
          <article class="item">
            <p><strong>{audit.topicName}</strong> → recommended {audit.recommendedOperation}</p>
            {#if audit.semanticConcepts?.length}<p class="muted"><strong>Concepts:</strong> {audit.semanticConcepts.join(' · ')}</p>{/if}
            <p class="muted"><strong>Flags:</strong> {audit.contaminationFlags.join(', ')} · <strong>KEEP coherent:</strong> {audit.keepCoherent ? 'yes' : 'no'} · <strong>Title fits current state:</strong> {audit.titleFitsCurrentState ? 'yes' : 'no'}{form.restructuring.analysis.identityContract ? ` · Meaning coverage: ${audit.meaningUnitsComplete ? 'complete' : 'incomplete'}` : ''}</p>
            {#if audit.titleCurrentStateConcern}<p class="muted"><strong>Title concern:</strong> {audit.titleCurrentStateConcern}</p>{/if}
            {#if audit.explanation}<p>{audit.explanation}</p>{/if}
          </article>
        {/each}
      {/if}

      {#if form.restructuring.analysis.ownershipContract}
        <h3>{form.restructuring.analysis.flexibleOverlapContract ? 'Temporal and semantic placement validation' : 'Temporal and semantic ownership validation'}</h3>
        <p class="muted">{form.restructuring.analysis.flexibleOverlapContract ? 'Every durable meaning must be preserved and retain its temporal role. A canonical anchor supports provenance and retrieval, while legitimate shared meaning may still inform more than one topic when it serves a distinct explanatory purpose.' : 'Every durable meaning unit must have exactly one primary semantic home, retain its temporal role, and pass a no-mutation fidelity check.'}</p>
        {#each form.restructuring.analysis.ownership as item (item.ref)}
          <article class="item">
            <p><strong>{item.sourceTopicName}</strong> · {item.temporalRole}</p>
            <p>{item.sourceExcerpt}</p>
            {#if item.purposeContext}<p class="muted"><strong>Purpose/context:</strong> {item.purposeContext}</p>{/if}
            <p class="muted"><strong>{form.restructuring.analysis.flexibleOverlapContract ? 'Canonical anchor' : 'Primary home'}:</strong> {item.primaryHome || 'missing'}{item.primaryHomeFit ? ` · ${item.primaryHomeFit}` : ''}{item.primaryHomeSource === 'OVERLAP_GROUP' || item.primaryHomeSource === 'OVERLAP_GROUP_IDENTITY' ? ' · server-resolved from semantic identity group' : ''}{item.representedBy?.length > 1 ? ` · represented in ${item.representedBy.length} topics` : ''}</p>
          </article>
        {/each}
      {/if}

      {#if form.restructuring.analysis.identityContract}
        <h3>{form.restructuring.analysis.flexibleOverlapContract ? 'Semantic overlap validation' : 'Semantic identity validation'}</h3>
        <p class="muted">{form.restructuring.analysis.flexibleOverlapContract ? 'Relish distinguishes redundant duplication or contamination from legitimate cross-topic relevance and shared themes. Shared meaning may remain in more than one topic when each use has a distinct explanatory purpose.' : 'Equivalent or substantially overlapping meaning across prior topics must converge on one primary semantic home. Completion is derived by the server from validated coverage, group consistency and an independent lexical-overlap backstop, rather than trusted from a model completion flag.'}</p>
        {#if form.restructuring.analysis.semanticOverlapGroups?.length}
          {#each form.restructuring.analysis.semanticOverlapGroups as group (group.groupId)}
            <article class="item">
              <p><strong>{group.groupId}</strong> · {group.relationship}</p>
              <p>{group.canonicalMeaning}</p>
              <p class="muted">{group.meaningUnitRefs.join(' · ')}</p>
            </article>
          {/each}
        {:else}
          <p class="muted">No cross-topic semantic overlap groups were declared.</p>
        {/if}
      {/if}

      {#each form.restructuring.analysis.proposedTopics as topic (topic.targetKey)}
        <article class="revision">
          <h3>{topic.label} <span class="impact">{topic.operation}</span></h3>
          <p class="muted"><strong>Built from:</strong> {topic.sourceTargetKeys.map((key: string) => form.restructuring.priorSeeds.find((seed: any) => seed.targetKey === key)?.topicName ?? key).join(' + ')}{topic.temporalScope ? ` · ${topic.temporalScope}` : ''}</p>
          <p class="understanding">{topic.proposedUnderstanding}</p>
          {#if topic.reason}<p><strong>Why restructure:</strong> {topic.reason}</p>{/if}
        </article>
      {/each}

      <h3>Coverage check</h3>
      <p class="muted">Every prior topic must be represented. A count above one means a prior topic was deliberately split across multiple proposed topics.</p>
      {#each form.restructuring.analysis.coverage as row (row.targetKey)}
        <article class="item">
          <p><strong>{row.topicName}</strong> → {row.proposedTopicCount} proposed topic{row.proposedTopicCount === 1 ? '' : 's'}</p>
        </article>
      {/each}

      {#if form.restructuring.chainHistory?.length}
        <p class="muted"><strong>Longitudinal history preserved:</strong> this restructuring proposal keeps the existing read-only evolution chain and source provenance. It does not rewrite the historical versions.</p>
      {/if}

      {#if form.restructuring.adoptionToken && !form.restructuring.analysis.errors?.length}
        <div class="adoption-panel">
          <h3>{data.initialCreationMode ? '4. Approve and create authoritative v1' : 'Approve and save this Living Understanding'}</h3>
          <p class="muted">{data.initialCreationMode ? 'This is the first authoritative persistence step. The displayed topic understandings will be stored as immutable Living Understanding v1 with source provenance and revision history. This does not grant matching, sharing or disclosure permission.' : 'This is the authoritative persistence step. The displayed topic understandings will be stored as a new immutable revision. Earlier revisions and source history remain intact. This does not grant matching, sharing or disclosure permission.'}</p>
          <form method="POST" action="?/adoptRestructuring">
            <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
            <input type="hidden" name="adoptionToken" value={form.restructuring.adoptionToken} />
            <input type="hidden" name="draftCheckpointId" value={form.restructuring.draftCheckpointId || ''} />
            <label class="consent"><input name="approve" type="checkbox" value="YES" required /> I have reviewed this validated structure and approve saving it as the current Living Understanding. In initial creation mode this becomes authoritative v1.</label>
            <button type="submit">{data.initialCreationMode ? 'Approve and create v1' : 'Approve and save Living Understanding'}</button>
          </form>
        </div>
      {/if}

      {#if !data.initialCreationMode && remainingRestructureSources().length}
        <div class="continue-chain">
          <h3>Continue from the restructured baseline</h3>
          <p class="muted">The next later source will be compared with this proposed cleaner structure, while the earlier evolution history remains unchanged.</p>
          <form method="POST" action="?/compareLongitudinal" use:enhance>
        <input type="hidden" name="workflowMode" value={data.initialCreationMode ? 'INITIAL' : 'EXPERIMENT'} />
            <input type="hidden" name="baselineSourceInteractionId" value={form.restructuring.latestSourceInteractionId} />
            <input type="hidden" name="longitudinalSeedJson" value={serialiseLongitudinalSeed(form.restructuring.restructuredLongitudinalSeed)} />
            <input type="hidden" name="priorOperationalUnitsJson" value={serialiseOperationalUnits(form.restructuring.priorOperationalUnits)} />
            <input type="hidden" name="chainHistoryJson" value={serialiseChainHistory(form.restructuring.chainHistory)} />
            <input type="hidden" name="draftCheckpointId" value={form.restructuring.draftCheckpointId || form.draftCheckpoint?.id || ''} />
            <label>Next later source
              <select name="nextSourceInteractionId" required>
                <option value="">Choose the next source</option>
                {#each remainingRestructureSources() as source}
                  <option value={source.id}>{new Date(source.at).toLocaleString()} · {source.sourceKind === 'CONVERSATION_EXCERPT' ? `Conversation${source.speaker ? ` - ${source.speaker}` : ''}` : 'Reflection'}</option>
                {/each}
              </select>
            </label>
            <label class="consent"><input name="consent" type="checkbox" value="YES" required /> I authorise sending the next private source and this restructured temporary baseline to the configured AI provider.</label>
            <button type="submit">Continue chain from restructured baseline</button>
          </form>
        </div>
      {/if}

      <p class="muted"><strong>{data.initialCreationMode ? 'Not yet saved:' : 'Read-only:'}</strong> no stored topic, understanding, statement, permission, sharing rule or historical version has been changed unless you complete the explicit approval action above.</p>
    </section>
  {/if}
</main>

<style>
  .experiment { max-width: 980px; margin: 2rem auto; padding: 1rem; }
  .workflow-steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.5rem; margin:1rem 0 1.25rem; }
  .workflow-steps span { border:1px solid var(--border-color,#ddd); border-radius:10px; padding:.75rem; font-size:.9rem; font-weight:600; }
  .production-next-step { background:color-mix(in srgb, var(--background-color,#fff) 94%, #4f46e5 6%); }
  .optional-source { margin-top:1rem; }
  @media (max-width: 720px) { .workflow-steps { grid-template-columns:1fr 1fr; } }
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
  .chain-history { margin-top: 2rem; border-top: 2px solid var(--border-color, #aaa); padding-top: 1rem; }
  .chain-version { border: 1px solid var(--border-color, #aaa); border-radius: 8px; padding: .75rem; margin: .75rem 0; }
  .chain-version summary { cursor: pointer; }
  .chain-topic { border-top: 1px solid var(--border-color, #aaa); padding-top: .65rem; margin-top: .65rem; }
  .chain-topic p { margin-bottom: 0; white-space: pre-wrap; }
  .continue-chain, .restructure-start, .adoption-panel { margin-top: 2rem; border-top: 2px solid var(--border-color, #aaa); padding-top: 1rem; }
  .operational-preview, .longitudinal { margin-top: 1rem; padding-top: .75rem; border-top: 2px solid var(--border-color, #aaa); }
  select { width: 100%; padding: .6rem; margin-top: .35rem; }
</style>
