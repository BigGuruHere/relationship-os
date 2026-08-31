<!-- src/routes/objectives/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Editable Objective view with transparent KnowledgeClaim support state.
  import { OBJECTIVE_STATUSES } from '$lib/objectives';
  export let data: any;
  export let form: any;
  const objective = data.objective;
</script>

<div class="container">
  <div class="card page-card">
    <div class="section-head">
      <div>
        <div class="eyebrow">Objective</div>
        <h1>{objective.title}</h1>
        <div class="muted small">{objective.authorityLabel} - {objective.confidenceLabel} - {objective.sourceTypeLabel}</div>
      </div>
      {#if objective.contactId}<a class="btn" href={`/contacts/${objective.contactId}`}>Back to contact</a>{/if}
    </div>

    {#if form?.error}<div class="error-box">{form.error}</div>{/if}
    {#if objective.claimCount > 0 && objective.activeClaimCount === 0}
      <div class="warning-box"><strong>No active supporting claims.</strong><div class="small">The Objective still exists, but all linked claims are superseded or rejected. Review the claims below or update the Objective deliberately.</div></div>
    {:else if objective.activeClaimCount > 0 && objective.activeSupportedClaimCount === 0}
      <div class="warning-box"><strong>Active claims have no active evidence.</strong><div class="small">Review the evidence supporting the claims below.</div></div>
    {/if}

    <form method="post" action="?/save" class="form-grid">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" name="title" value={objective.title} required />
      </div>
      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" name="description" rows="6">{objective.description}</textarea>
      </div>
      <div class="grid two">
        <div class="field">
          <label for="status">Status</label>
          <select id="status" name="status">
            {#each OBJECTIVE_STATUSES as option}
              <option value={option.value} selected={option.value === objective.status}>{option.label}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="importance">Importance</label>
          <select id="importance" name="importance">
            {#each [1,2,3,4,5] as n}<option value={n} selected={n === objective.importance}>{n}</option>{/each}
          </select>
        </div>
      </div>
      <button class="btn primary" type="submit">Save objective</button>
    </form>

    <div class="meta-card">
      <strong>Supporting relationship intelligence</strong>
      <div class="muted small">{objective.activeClaimCount} of {objective.claimCount} linked claims are active.</div>
      {#if objective.claims?.length}
        <div class="claim-list">
          {#each objective.claims as claim}
            <a class="claim-row" href={`/knowledge/${claim.id}`}>
              <div class="title-line"><span class="chip">{claim.kindLabel}</span><strong>{claim.statement}</strong><span class="chip">{claim.statusLabel}</span>{#if claim.status === 'ACTIVE' && !claim.hasActiveEvidence}<span class="warning-chip">No active evidence</span>{/if}</div>
              <div class="muted small">{claim.authorityLabel} - {claim.confidenceLabel}</div>
            </a>
          {/each}
        </div>
      {:else if objective.sourceInteractionId && objective.contactId}
        <div><a href={`/contacts/${objective.contactId}/interactions/${objective.sourceInteractionId}`}>Open source interaction</a></div>
      {:else}
        <div class="muted small">No KnowledgeClaims are linked to this Objective.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .page-card { padding:18px; max-width:900px; margin:0 auto; }
  .section-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .section-head h1 { margin:2px 0 4px; }
  .eyebrow { text-transform:uppercase; letter-spacing:.08em; font-size:.76rem; color:var(--muted); }
  .muted { color:var(--muted); }.small { font-size:.9rem; }
  .form-grid { display:grid; gap:12px; margin-top:18px; }.field { display:grid; gap:6px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .grid { display:grid; gap:12px; }.grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg,#21c7b6,#0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  .meta-card { border-top:1px solid var(--border); margin-top:18px; padding-top:14px; display:grid; gap:8px; }
  .error-box,.warning-box { margin-top:12px; padding:10px 12px; border-radius:10px; }.error-box{border:1px solid #dc2626}.warning-box{border:1px solid #d97706;background:rgba(217,119,6,.07)}
  .claim-list{display:grid;gap:8px;margin-top:4px}.claim-row{display:block;border:1px solid var(--border);border-radius:10px;padding:10px;color:inherit;text-decoration:none}.claim-row:hover{border-color:#0f9b92}.title-line{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.chip,.warning-chip{border:1px solid var(--border);border-radius:999px;padding:2px 8px;font-size:.82rem}.warning-chip{border-color:#d97706;color:#b45309}
  @media (max-width:700px){ .section-head{flex-direction:column}.grid.two{grid-template-columns:1fr} }
</style>
