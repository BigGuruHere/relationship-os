<!-- src/lib/RelationshipIntelligencePanel.svelte -->
<script lang="ts">
  // PURPOSE: Show persistent Objectives and active KnowledgeClaims separately from operational notes.
  // UX: Every claim is clickable, including Facts, so relationship intelligence is never a dead-end record.
  export let objectives: any[] = [];
  export let claims: any[] = [];
  export let history: any[] = [];
  export let contactId = '';

</script>

<section class="card panel intelligence-panel">
  <div class="section-head">
    <div>
      <h2>Relationship intelligence</h2>
      <p class="muted small">Structured meaning captured from interactions. Notes remain evidence; these records are the current relationship understanding.</p>
    </div>
  </div>

  <div class="subsection">
    <h3>Objectives</h3>
    {#if objectives.length === 0}
      <p class="muted small">No persistent objectives captured yet.</p>
    {:else}
      <div class="item-list">
        {#each objectives as item}
          <div class="item">
            <div>
              <div class="title-line">
                <span class="chip">Objective</span>
                <a href={`/objectives/${item.id}`}><strong>{item.title}</strong></a>
                <span class="chip">{item.statusLabel}</span>
                {#if item.claimCount > 0 && item.activeClaimCount === 0}<span class="warning-chip">No active supporting claims</span>{/if}
                {#if item.activeClaimCount > 0 && item.activeSupportedClaimCount === 0}<span class="warning-chip">Claims have no active evidence</span>{/if}
              </div>
              {#if item.description}<p class="preline small">{item.description}</p>{/if}
              <div class="muted small meta">
                <span>{item.authorityLabel}</span>
                <span>{item.confidenceLabel}</span>
                <span>Importance {item.importance}/5</span>
                {#if item.claimCount}<span>{item.activeClaimCount}/{item.claimCount} active claim{item.claimCount === 1 ? '' : 's'}</span>{/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="subsection">
    <h3>Active knowledge</h3>
    {#if claims.length === 0}
      <p class="muted small">No structured claims yet. Open a recent note and use <strong>Add relationship intelligence</strong>.</p>
    {:else}
      <div class="item-list">
        {#each claims as claim}
          <a class="item claim-item" href={`/knowledge/${claim.id}`}>
            <div>
              <div class="title-line">
                <span class="chip">{claim.kindLabel}</span>
                <strong>{claim.statement}</strong>
                {#if !claim.hasActiveEvidence}<span class="warning-chip">No active evidence</span>{/if}
              </div>
              <div class="muted small meta">
                <span>{claim.authorityLabel}</span>
                <span>{claim.confidenceLabel}</span>
                <span>{claim.activeEvidenceCount}/{claim.evidenceCount} active evidence source{claim.evidenceCount === 1 ? '' : 's'}</span>
                {#if claim.target}
                  <span>Structured {claim.target.type.toLowerCase()}: {claim.target.title}</span>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  {#if history.length > 0}
    <details class="history-section">
      <summary>Knowledge history ({history.length})</summary>
      <p class="muted small">Superseded and rejected claims remain available as relationship history and can be restored if needed.</p>
      <div class="item-list">
        {#each history as claim}
          <a class="item claim-item" href={`/knowledge/${claim.id}`}>
            <div class="title-line">
              <span class="chip">{claim.kindLabel}</span>
              <strong>{claim.statement}</strong>
              <span class="chip">{claim.statusLabel}</span>
            </div>
            <div class="muted small meta">
              <span>{claim.authorityLabel}</span>
              <span>{claim.confidenceLabel}</span>
              <span>{claim.activeEvidenceCount}/{claim.evidenceCount} active evidence</span>
            </div>
          </a>
        {/each}
      </div>
    </details>
  {/if}
</section>

<style>
  .intelligence-panel { padding:16px; }
  .section-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .section-head h2, .subsection h3 { margin:0; }
  .subsection { margin-top:16px; }
  .item-list { display:grid; gap:10px; margin-top:8px; }
  .item { border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .claim-item { color:inherit; text-decoration:none; display:block; }
  .claim-item:hover { border-color:#0f9b92; }
  .title-line, .meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .chip,.warning-chip { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:0.82rem; }
  .warning-chip { border-color:#d97706; color:#b45309; }
  .muted { color:var(--muted); }
  .small { font-size:0.9rem; }
  .preline { white-space:pre-wrap; }
  .meta { margin-top:6px; }
  .history-section { margin-top:16px; border-top:1px solid var(--border); padding-top:12px; }
  .history-section summary { cursor:pointer; font-weight:700; }
</style>
