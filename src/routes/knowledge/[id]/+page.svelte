<!-- src/routes/knowledge/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Universal relationship-intelligence detail page. Claim status and Evidence status are intentionally independent.
  export let data: any;
  export let form: any;
  const claim = data.claim;

  function fmt(value: string | Date | null) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function targetHref(target: any) {
    if (!target) return '';
    if (target.type === 'OBJECTIVE') return `/objectives/${target.id}`;
    if (target.type === 'WANT') return `/wants/${target.id}`;
    if (target.type === 'OFFER') return `/offers/${target.id}`;
    return '';
  }
</script>

<div class="container">
  <div class="card page-card">
    <div class="section-head">
      <div>
        <div class="eyebrow">{claim.kindLabel} claim</div>
        <h1>{claim.statement}</h1>
        <div class="meta muted small">
          <span>{claim.authorityLabel}</span>
          <span>{claim.confidenceLabel}</span>
          <span>Claim status: {claim.statusLabel}</span>
        </div>
      </div>
      {#if claim.contactId}<a class="btn" href={`/contacts/${claim.contactId}`}>Back to contact</a>{/if}
    </div>

    {#if form?.error}<div class="error-box">{form.error}</div>{/if}

    {#if claim.status === 'ACTIVE' && !claim.hasActiveEvidence}
      <div class="warning-box">
        <strong>This active claim has no active supporting evidence.</strong>
        <div class="small">Either restore valid evidence below, supersede/reject the claim, or deliberately keep it active if it has been confirmed independently.</div>
      </div>
    {/if}

    <section class="card inner-card">
      <div class="block-head">
        <div>
          <h2>Claim status</h2>
          <p class="muted small">This controls whether the relationship intelligence itself is current. It is separate from the status of individual evidence sources.</p>
        </div>
        <span class="chip">{claim.statusLabel}</span>
      </div>
      <div class="actions">
        {#if claim.status !== 'ACTIVE'}
          <form method="post" action="?/setClaimStatus"><input type="hidden" name="status" value="ACTIVE" /><button class="btn primary">Restore claim</button></form>
        {/if}
        {#if claim.status !== 'SUPERSEDED'}
          <form method="post" action="?/setClaimStatus"><input type="hidden" name="status" value="SUPERSEDED" /><button class="btn">Supersede claim</button></form>
        {/if}
        {#if claim.status !== 'REJECTED'}
          <form method="post" action="?/setClaimStatus"><input type="hidden" name="status" value="REJECTED" /><button class="btn danger-hover">Reject claim</button></form>
        {/if}
      </div>
    </section>

    <section class="card inner-card">
      <div class="block-head">
        <div>
          <h2>Structured record</h2>
          <p class="muted small">The Claim is the meaning; a Want, Offer or Objective is the longer-lived structured record created from it.</p>
        </div>
      </div>
      {#if claim.target}
        <a href={targetHref(claim.target)}><strong>{claim.target.type}: {claim.target.title}</strong></a>
      {:else if claim.status === 'ACTIVE' && ['OBJECTIVE','WANT','OFFER'].includes(claim.kind)}
        <form method="post" action="?/promote">
          <input type="hidden" name="target" value={claim.kind} />
          <button class="btn primary">Create {claim.kind.toLowerCase()}</button>
        </form>
      {:else}
        <p class="muted small">This claim type does not require a separate structured record.</p>
      {/if}
    </section>

    <section class="card inner-card">
      <div class="block-head">
        <div>
          <h2>Evidence</h2>
          <p class="muted small">{claim.activeEvidenceCount} of {claim.evidenceCount} evidence sources are active. Retiring evidence does not automatically retire the Claim.</p>
        </div>
      </div>

      {#if claim.evidence.length === 0}
        <p class="muted">No evidence is attached to this claim.</p>
      {:else}
        <div class="evidence-list">
          {#each claim.evidence as item}
            <div class="evidence-item">
              <div class="evidence-main">
                <div class="title-line">
                  <span class="chip">Evidence status: {item.statusLabel}</span>
                  <strong>{item.sourceTypeLabel}</strong>
                  <span class="muted small">{fmt(item.observedAt)}</span>
                </div>
                <div class="muted small">{item.authorityLabel} - {item.confidenceLabel}</div>
                {#if item.note}<p class="preline small">{item.note}</p>{/if}
                {#if item.sourceInteraction?.id && item.sourceInteraction?.contactId}
                  <a href={`/contacts/${item.sourceInteraction.contactId}/interactions/${item.sourceInteraction.id}`}>Open source interaction</a>
                {/if}
              </div>
              <div class="actions evidence-actions">
                {#if item.status !== 'ACTIVE'}
                  <form method="post" action="?/setEvidenceStatus"><input type="hidden" name="evidenceId" value={item.id} /><input type="hidden" name="status" value="ACTIVE" /><button class="btn">Restore evidence</button></form>
                {/if}
                {#if item.status !== 'SUPERSEDED'}
                  <form method="post" action="?/setEvidenceStatus"><input type="hidden" name="evidenceId" value={item.id} /><input type="hidden" name="status" value="SUPERSEDED" /><button class="btn">Supersede evidence</button></form>
                {/if}
                {#if item.status !== 'REJECTED'}
                  <form method="post" action="?/setEvidenceStatus"><input type="hidden" name="evidenceId" value={item.id} /><input type="hidden" name="status" value="REJECTED" /><button class="btn danger-hover">Reject evidence</button></form>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .page-card{padding:18px;max-width:1000px;margin:0 auto}.section-head,.block-head,.evidence-item{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.section-head h1,.block-head h2{margin:2px 0 4px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.76rem;color:var(--muted)}.muted{color:var(--muted)}.small{font-size:.9rem}.meta,.title-line,.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.inner-card{padding:14px;margin-top:14px}.chip{border:1px solid var(--border);border-radius:999px;padding:2px 8px;font-size:.82rem}.btn{border:1px solid var(--border);border-radius:10px;padding:8px 12px;background:var(--surface);color:var(--text);text-decoration:none;cursor:pointer}.btn.primary{background:linear-gradient(180deg,#21c7b6,#0fa7a0);border-color:#0f9b92;color:#fff;font-weight:700}.btn.danger-hover:hover{background:#dc2626;border-color:#b91c1c;color:#fff}.warning-box,.error-box{margin-top:14px;padding:12px;border-radius:10px}.warning-box{border:1px solid #d97706;background:rgba(217,119,6,.07)}.error-box{border:1px solid #dc2626}.evidence-list{display:grid;gap:12px;margin-top:10px}.evidence-item{border-top:1px solid var(--border);padding-top:12px}.evidence-main{flex:1}.evidence-actions{justify-content:flex-end}.preline{white-space:pre-wrap}@media(max-width:760px){.section-head,.block-head,.evidence-item{flex-direction:column}.evidence-actions{justify-content:flex-start}}
</style>
