<!-- src/routes/agents/runs/[id]/+page.svelte -->
<script lang="ts">
  export let data: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function pretty(value: unknown) {
    if (value === null || value === undefined) return '';
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }

  function entityHref(type: string | null | undefined, id: string | null | undefined) {
    if (!type || !id) return '';
    if (type === 'contact') return `/contacts/${id}`;
    if (type === 'company') return `/companies/${id}`;
    if (type === 'deal') return `/deals/${id}`;
    if (type === 'project') return `/projects/${id}`;
    if (type === 'task') return `/tasks/${id}/edit`;
    return '';
  }

  function riskLabel(value: number | null | undefined) {
    if (value === null || value === undefined) return '-';
    if (value >= 70) return `${value} high`;
    if (value >= 45) return `${value} moderate`;
    return `${value} low`;
  }
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Agent run</div>
      <h1>{data.run.agentDefinition.name}</h1>
      <div class="meta">
        <span class="status">{data.run.status}</span>
        <span>{fmt(data.run.createdAt)}</span>
        <span>{data.run.agentDefinition.defaultModelProvider} / {data.run.agentDefinition.defaultModelName}</span>
        {#if data.run.promptVersion}<span>Prompt v{data.run.promptVersion.version}</span>{/if}
      </div>
      {#if data.run.errorMessage}<p class="error">{data.run.errorMessage}</p>{/if}
    </div>
    <div class="actions">
      {#if entityHref(data.run.triggerEntityType, data.run.triggerEntityId)}
        <a class="btn" href={entityHref(data.run.triggerEntityType, data.run.triggerEntityId)}>Open source record</a>
      {/if}
      <a class="btn" href="/agents/runs">All runs</a>
    </div>
  </div>

  {#if data.artifacts?.length}
    <section class="card panel">
      <h2>Artifacts</h2>
      {#each data.artifacts as artifact}
        <article class="artifact">
          <div class="meta"><span>{artifact.artifactType}</span><span>{fmt(artifact.createdAt)}</span></div>
          <h3>{artifact.title}</h3>
          {#if artifact.summary}<p class="summary">{artifact.summary}</p>{/if}
          {#if artifact.content}<pre class="content">{artifact.content}</pre>{/if}
        </article>
      {/each}
    </section>
  {/if}




  {#if data.contactEnrichments?.length}
    <section class="card panel">
      <h2>Data enrichments</h2>
      <p class="muted">Stage 5.1 enrichments are field-level proposals. Review evidence before applying anything to CRM.</p>
      <div class="candidate-list">
        {#each data.contactEnrichments as item}
          <article class="candidate">
            <div class="candidate-head">
              <div>
                <div class="meta">
                  <span>{item.status}</span>
                  <span>{item.conflictStatus || 'NEW'}</span>
                  <span>{item.evidenceType || 'UNKNOWN'}</span>
                  <span>Confidence {item.confidence}/100</span>
                  <span>{fmt(item.createdAt)}</span>
                </div>
                <h3>{item.fieldLabel || item.fieldKey || item.targetName || item.fullName || item.companyName || 'Proposed enrichment'}</h3>
                {#if item.targetName}<p class="muted">Target: {item.targetName}</p>{/if}
                {#if item.companyName}<p class="muted">Company: {item.companyName}</p>{/if}
              </div>
              <div class="score"><strong>{item.confidence}</strong><span>confidence</span></div>
            </div>

            {#if item.fieldKey}
              <div class="score-grid">
                <span>Field: {item.fieldKey}</span>
                {#if item.proposedValue}<span>Proposed: {item.proposedValue}</span>{/if}
                {#if item.existingValue}<span>Existing: {item.existingValue}</span>{/if}
                <span>{item.isApplyable ? 'Applyable' : 'Not applyable'}</span>
              </div>
            {:else}
              <div class="score-grid">
                {#if item.fullName}<span>Name: {item.fullName}</span>{/if}
                {#if item.email}<span>Email: {item.email}</span>{/if}
                {#if item.phone}<span>Phone: {item.phone}</span>{/if}
                {#if item.linkedin}<span>LinkedIn: {item.linkedin}</span>{/if}
                {#if item.website}<span>Website: {item.website}</span>{/if}
              </div>
            {/if}

            {#if item.sourceUrl}<p class="muted">Source: <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel || item.sourceUrl}</a></p>{/if}
            {#if item.evidence}<p><strong>Evidence:</strong> {item.evidence}</p>{/if}
            {#if item.notes}<p class="muted">{item.notes}</p>{/if}
            {#if item.appliedAt}<p class="success">Applied to {item.appliedEntityType}. {#if entityHref(item.appliedEntityType, item.appliedEntityId)}<a href={entityHref(item.appliedEntityType, item.appliedEntityId)}>Open record</a>{/if}</p>{/if}

            <div class="actions small-actions">
              {#if item.status !== 'APPROVED' && item.status !== 'APPLIED' && item.status !== 'NO_CHANGE'}
                <form method="post" action="?/approveEnrichment"><input type="hidden" name="enrichmentId" value={item.id} /><button class="btn" type="submit">Approve</button></form>
              {/if}
              {#if item.status !== 'REJECTED' && item.status !== 'APPLIED'}
                <form method="post" action="?/rejectEnrichment"><input type="hidden" name="enrichmentId" value={item.id} /><button class="btn danger" type="submit">Reject</button></form>
              {/if}
              {#if item.isApplyable && item.status === 'APPROVED'}
                <form method="post" action="?/applyEnrichment">
                  <input type="hidden" name="enrichmentId" value={item.id} />
                  <label class="inline-check"><input type="checkbox" name="overwrite" /> Overwrite existing fields</label>
                  <button class="btn primary" type="submit">Apply to CRM</button>
                </form>
              {:else if !item.isApplyable && item.status !== 'APPLIED'}
                <span class="muted">Not applyable - verify manually or reject.</span>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.opportunityScores?.length}
    <section class="card panel">
      <h2>Opportunity scorecards</h2>
      <p class="muted">Stage 4 scorecards are advisory. Use them to prioritise review, not as proof of fit.</p>
      <div class="scorecard-list">
        {#each data.opportunityScores as score}
          <article class="scorecard">
            <div class="candidate-head">
              <div>
                <div class="meta"><span>v{score.scoreVersion}</span><span>{score.scoreLabel}</span><span>{score.priority}</span><span>{fmt(score.createdAt)}</span></div>
                <h3>Score {score.totalScore}/100</h3>
                {#if score.recommendedAction}<p><strong>Recommended action:</strong> {score.recommendedAction}</p>{/if}
              </div>
              <div class="score">
                <strong>{score.totalScore}</strong>
                <span>{score.scoreLabel}</span>
              </div>
            </div>

            <div class="score-grid">
              <span>Sector {score.displayScores?.sectorFitScore ?? score.sectorFitScore ?? '-'}</span>
              <span>Owner-led {score.displayScores?.ownerLedScore ?? score.ownerLedScore ?? '-'}</span>
              <span>Deal likelihood {score.displayScores?.dealLikelihoodScore ?? score.dealLikelihoodScore ?? '-'}</span>
              <span>Outreach {score.displayScores?.outreachFitScore ?? score.outreachFitScore ?? '-'}</span>
              <span>Timing {score.displayScores?.timingScore ?? score.timingScore ?? '-'}</span>
              <span>Evidence {score.displayScores?.evidenceQualityScore ?? score.evidenceQualityScore ?? score.confidenceScore ?? '-'}</span>
              <span>Value {score.displayScores?.valuePotentialScore ?? score.valuePotentialScore ?? '-'}</span>
              <span>Risk level {riskLabel(score.displayScores?.riskScore ?? score.riskScore)}</span>
            </div>

            {#if score.factors?.length}
              <details class="detail" open>
                <summary>Score factors</summary>
                <div class="factor-list">
                  {#each score.factors as factor}
                    <div class="factor-row">
                      <div>
                        <strong>{factor.criterionLabel}</strong>
                        <div class="meta"><span>{String(factor.criterionKey || factor.criterionLabel || '').toLowerCase().includes('risk') ? 'risk factor' : factor.polarity}</span><span>Weight {factor.weight}</span><span>Confidence {factor.confidence}/100</span></div>
                        {#if factor.rationale}<p>{factor.rationale}</p>{/if}
                        {#if factor.evidence}<p class="muted">Evidence: {factor.evidence}</p>{/if}
                        {#if factor.sourceUrl}<p><a href={factor.sourceUrl} target="_blank" rel="noreferrer">Open source</a></p>{/if}
                      </div>
                      <strong>{factor.score}/100</strong>
                    </div>
                  {/each}
                </div>
              </details>
            {/if}

            {#if score.rationaleJson}<details class="detail"><summary>Full rationale JSON</summary><pre>{pretty(score.rationaleJson)}</pre></details>{/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.researchSources?.length}
    <section class="card panel">
      <h2>Research sources</h2>
      <p class="muted">Logged evidence from Stage 3 research. These sources support staged candidates, but nothing is imported into CRM until reviewed.</p>
      <div class="source-list">
        {#each data.researchSources as source}
          <article class="source-row">
            <div class="meta"><span>{source.sourceType}</span><span>{source.provider}</span><span>Confidence {source.confidence}/100</span></div>
            <h3>{source.title}</h3>
            {#if source.url}<p><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></p>{/if}
            {#if source.query}<p class="muted">Query: {source.query}</p>{/if}
            {#if source.snippet}<p>{source.snippet}</p>{/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}


  {#if data.candidates?.length}
    <section class="card panel">
      <h2>Outreach candidates</h2>
      <p class="muted">These are staged records only. Approve/reject them here, then import useful candidates into CRM when you are ready.</p>
      <div class="candidate-list">
        {#each data.candidates as candidate}
          <article class="candidate">
            <div class="candidate-head">
              <div>
                <div class="meta"><span>{candidate.entityType}</span><span>{candidate.status}</span><span>Confidence {candidate.confidence}/100</span></div>
                <h3>{candidate.name}</h3>
                {#if candidate.structuredJson?.roleTitle}<p class="muted">Role/title: {candidate.structuredJson.roleTitle}</p>{/if}
                {#if candidate.structuredJson?.companyName}<p class="muted">Company: {candidate.structuredJson.companyName}</p>{/if}
                {#if candidate.website}<p><a href={candidate.website} target="_blank" rel="noreferrer">{candidate.website}</a></p>{/if}
                {#if candidate.sourceUrl}<p class="muted">Source: <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">{candidate.sourceLabel || candidate.sourceUrl}</a></p>{/if}
              </div>
              <div class="score">
                <strong>{candidate.score?.totalScore ?? 0}</strong>
                <span>score</span>
              </div>
            </div>

            {#if candidate.notes}<p>{candidate.notes}</p>{/if}
            {#if candidate.score?.recommendedAction}<p><strong>Recommended action:</strong> {candidate.score.recommendedAction}</p>{/if}
            {#if candidate.score?.factors?.length}
              <details class="detail"><summary>Score factors</summary>
                {#each candidate.score.factors as factor}
                  <div class="factor-row"><span>{factor.criterionLabel}</span><strong>{factor.score}/100</strong></div>
                {/each}
              </details>
            {/if}
            {#if candidate.score?.rationaleJson}<details class="detail"><summary>Score rationale</summary><pre>{pretty(candidate.score.rationaleJson)}</pre></details>{/if}

            {#if candidate.createdEntityType && candidate.createdEntityId}
              <p class="success">Imported as {candidate.createdEntityType}.
                {#if entityHref(candidate.createdEntityType, candidate.createdEntityId)}<a href={entityHref(candidate.createdEntityType, candidate.createdEntityId)}>Open record</a>{/if}
              </p>
            {/if}

            <div class="actions small-actions">
              {#if candidate.status !== 'APPROVED' && candidate.status !== 'IMPORTED'}
                <form method="post" action="?/approveCandidate"><input type="hidden" name="candidateId" value={candidate.id} /><button class="btn" type="submit">Approve</button></form>
              {/if}
              {#if candidate.status !== 'REJECTED' && candidate.status !== 'IMPORTED'}
                <form method="post" action="?/rejectCandidate"><input type="hidden" name="candidateId" value={candidate.id} /><button class="btn danger" type="submit">Reject</button></form>
              {/if}
              {#if candidate.status === 'APPROVED'}
                <form method="post" action="?/importCandidate"><input type="hidden" name="candidateId" value={candidate.id} /><button class="btn primary" type="submit">Import to CRM</button></form>
              {/if}
              <form method="post" action="?/createReviewTask"><input type="hidden" name="candidateId" value={candidate.id} /><button class="btn" type="submit">Create review task</button></form>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  <section class="card panel">
    <h2>Steps</h2>
    <div class="list">
      {#each data.run.steps as step}
        <details class="detail" open>
          <summary><strong>{step.stepName}</strong> <span>{step.status}</span></summary>
          {#if step.errorMessage}<p class="error">{step.errorMessage}</p>{/if}
          <div class="grid two">
            <div><h4>Input</h4><pre>{pretty(step.inputJson)}</pre></div>
            <div><h4>Output</h4><pre>{pretty(step.outputJson)}</pre></div>
          </div>
        </details>
      {/each}
    </div>
  </section>

  <section class="grid two cols">
    <div class="card panel">
      <h2>Tool calls</h2>
      {#if !data.run.toolCalls?.length}<p class="muted">No tool calls.</p>{/if}
      {#each data.run.toolCalls as call}
        <details class="detail">
          <summary><strong>{call.toolKey}</strong> <span>{call.status}</span></summary>
          {#if call.errorMessage}<p class="error">{call.errorMessage}</p>{/if}
          <pre>{pretty(call.outputJson || call.inputJson)}</pre>
        </details>
      {/each}
    </div>

    <div class="card panel">
      <h2>Model calls</h2>
      {#if !data.run.modelInvocations?.length}<p class="muted">No model calls.</p>{/if}
      {#each data.run.modelInvocations as call}
        <details class="detail">
          <summary><strong>{call.provider} / {call.model}</strong> <span>{call.status}</span></summary>
          <div class="meta"><span>{call.purpose}</span><span>{call.inputTokens || 0} in</span><span>{call.outputTokens || 0} out</span></div>
          {#if call.errorMessage}<p class="error">{call.errorMessage}</p>{/if}
          <pre>{pretty(call.structuredOutputJson || call.responseJsonRedacted)}</pre>
        </details>
      {/each}
    </div>
  </section>

  <section class="grid two cols">
    <div class="card panel">
      <h2>Linked records</h2>
      {#if !data.run.entities?.length}<p class="muted">No linked records.</p>{/if}
      {#each data.run.entities as entity}
        <div class="mini-row">
          <span>{entity.role}: {entity.entityType}</span>
          {#if entityHref(entity.entityType, entity.entityId)}<a href={entityHref(entity.entityType, entity.entityId)}>Open</a>{/if}
        </div>
      {/each}
    </div>

    <div class="card panel">
      <h2>Approvals</h2>
      {#if !data.run.approvals?.length}<p class="muted">No approval requests.</p>{/if}
      {#each data.run.approvals as approval}
        <div class="mini-row"><span>{approval.actionType}</span><span>{approval.status}</span></div>
      {/each}
    </div>
  </section>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1, h2, h3, h4 { margin: 0; }
  h4 { margin-bottom: 4px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta, .actions, .mini-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta { color: var(--muted); font-size: 0.9rem; margin-top: 4px; }
  .status { font-weight: 700; color: var(--accent); }
  .panel { padding: 14px; margin-bottom: 12px; }
  .artifact { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 10px; }
  .summary { font-weight: 600; }
  .content, pre { white-space: pre-wrap; word-break: break-word; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 10px; overflow: auto; }
  .detail { border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin-top: 8px; }
  .detail summary { cursor: pointer; display: flex; justify-content: space-between; gap: 10px; }
  .grid.two, .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .mini-row { justify-content: space-between; border-bottom: 1px solid var(--border); padding: 8px 0; }
  .muted { color: var(--muted); }
  .error { color: var(--danger); }
  .success { color: var(--success, #138a36); font-weight: 700; }
  .candidate-list, .source-list, .scorecard-list { display: grid; gap: 12px; margin-top: 10px; }
  .candidate, .source-row, .scorecard { border: 1px solid var(--border); border-radius: 14px; padding: 12px; }
  .candidate-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .score { border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; text-align: center; min-width: 70px; background: var(--surface-2); }
  .score strong { display: block; font-size: 1.4rem; }
  .score-grid { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
  .score-grid span { border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px; background: var(--surface-2); }
  .factor-list { display: grid; gap: 8px; margin-top: 8px; }
  .factor-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); padding: 8px 0; }
  .score span { color: var(--muted); font-size: 0.8rem; }
  .small-actions { margin-top: 10px; }
  .inline-check { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.9rem; }
  .btn.danger { border-color: var(--danger); color: var(--danger); }
  @media (max-width: 760px) { .header, .grid.two, .cols { display: grid; grid-template-columns: 1fr; } }
</style>
