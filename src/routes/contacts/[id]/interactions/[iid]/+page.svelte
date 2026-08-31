<!-- src/routes/contacts/[id]/interactions/[iid]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Interaction evidence view plus one-step reviewed Relationship Intelligence capture.
  // UX: The human reviews meaning once. Core still persists Interaction -> Claim/Evidence -> structured record separately.
  import { page } from '$app/stores';
  import { KNOWLEDGE_AUTHORITIES } from '$lib/provenance';
  import { KNOWLEDGE_CLAIM_KINDS, KNOWLEDGE_CONFIDENCES } from '$lib/knowledge';

  export let data: any;
  export let form: any;
  const interaction = data.interaction;
  const claims = data.claims ?? [];

  let editingSummary = false;
  let editingText = false;
  let showCapture = false;
  let summaryDraft: string = interaction.summary ?? '';
  let textDraft: string = interaction.text ?? '';
  let captureKind = 'FACT';
  // IT: Prefill from the evidence so the user edits meaning rather than retyping the note.
  let statementDraft = String(interaction.summary || interaction.text || '').trim();

  $: captureButtonLabel = captureKind === 'WANT'
    ? 'Create want'
    : captureKind === 'OFFER'
      ? 'Create offer'
      : captureKind === 'OBJECTIVE'
        ? 'Create objective'
        : 'Save claim';

  function fmt(d: string | Date | null) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
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
    <div class="header-row">
      <div>
        <h1>{interaction.contactName}</h1>
        <p class="muted">{fmt(interaction.occurredAt)} - {interaction.sourceTypeLabel}</p>
      </div>
      <div class="pill">{interaction.channel}</div>
    </div>

    {#if form?.error}<div class="error-box">{form.error}</div>{/if}

    <div class="card inner-card">
      <div class="block-head">
        <h3>Summary</h3>
        {#if !editingSummary}<button type="button" class="btn" on:click={() => { editingSummary = true; summaryDraft = interaction.summary ?? '' }}>Edit summary</button>{/if}
      </div>
      {#if editingSummary}
        <form method="post" action="?/editSummary" class="stack">
          <textarea name="summary" rows="6" bind:value={summaryDraft} class="area"></textarea>
          <div class="actions"><button class="btn primary">Save summary</button><button type="button" class="btn" on:click={() => { editingSummary = false; summaryDraft = interaction.summary ?? '' }}>Cancel</button></div>
        </form>
      {:else if interaction.summary}
        <pre>{interaction.summary}</pre>
      {:else}
        <p class="muted">No summary yet.</p>
      {/if}
    </div>

    <div class="card inner-card">
      <div class="block-head">
        <h3>Notes / source evidence</h3>
        {#if !editingText}<button type="button" class="btn" on:click={() => { editingText = true; textDraft = interaction.text ?? '' }}>Edit note</button>{/if}
      </div>
      {#if editingText}
        <form method="post" action="?/editText" class="stack">
          <textarea name="text" rows="10" bind:value={textDraft} class="area"></textarea>
          <div class="actions"><button class="btn primary">Save note</button><button type="button" class="btn" on:click={() => { editingText = false; textDraft = interaction.text ?? '' }}>Cancel</button></div>
        </form>
      {:else if interaction.text}
        <pre>{interaction.text}</pre>
      {:else}
        <p class="muted">No note text.</p>
      {/if}
    </div>

    <section class="card inner-card intelligence">
      <div class="block-head">
        <div>
          <h3>Relationship intelligence</h3>
          <p class="muted small">Review the meaning once. Relish keeps the note as evidence and creates the Claim plus Want, Offer or Objective automatically when selected.</p>
        </div>
        <button type="button" class="btn primary" on:click={() => (showCapture = !showCapture)}>{showCapture ? 'Close' : 'Add relationship intelligence'}</button>
      </div>

      {#if showCapture}
        <form method="post" action="?/captureKnowledge" class="capture-form">
          <div class="field">
            <label for="kind">What is this?</label>
            <select id="kind" name="kind" bind:value={captureKind}>
              {#each KNOWLEDGE_CLAIM_KINDS as opt}<option value={opt.value}>{opt.label}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="statement">Relationship intelligence</label>
            <textarea id="statement" name="statement" rows="4" bind:value={statementDraft} required placeholder="e.g. Looking to acquire a profitable education business within 12 months"></textarea>
            <p class="muted tiny">Edit the note into the concise meaning you want Relish to remember. This becomes the structured title automatically where needed.</p>
          </div>

          <details class="advanced">
            <summary>Advanced provenance</summary>
            <div class="grid two advanced-grid">
              <div class="field"><label for="authority">Authority</label><select id="authority" name="authority">{#each KNOWLEDGE_AUTHORITIES as opt}<option value={opt.value} selected={opt.value === 'WORKSPACE_RECORDED'}>{opt.label}</option>{/each}</select></div>
              <div class="field"><label for="confidence">Confidence</label><select id="confidence" name="confidence">{#each KNOWLEDGE_CONFIDENCES as opt}<option value={opt.value} selected={opt.value === 'MEDIUM'}>{opt.label}</option>{/each}</select></div>
            </div>
            <div class="field"><label for="evidenceNote">Evidence note (optional)</label><textarea id="evidenceNote" name="evidenceNote" rows="2" placeholder="Nuance about why this interaction supports the statement"></textarea></div>
          </details>

          <button class="btn primary" type="submit">{captureButtonLabel}</button>
        </form>
      {/if}

      {#if claims.length === 0}
        <p class="muted">No structured relationship intelligence has been captured from this interaction yet.</p>
      {:else}
        <div class="claim-list">
          {#each claims as claim}
            <div class="claim-row">
              <div class="claim-main">
                <div class="title-line">
                  <span class="pill">{claim.kindLabel}</span>
                  <a class="claim-link" href={`/knowledge/${claim.id}`}><strong>{claim.statement}</strong></a>
                  <span class="pill">{claim.statusLabel}</span>
                  {#if claim.status === 'ACTIVE' && !claim.hasActiveEvidence}<span class="warning-pill">No active evidence</span>{/if}
                </div>
                <div class="muted small">{claim.authorityLabel} - {claim.confidenceLabel} - {claim.activeEvidenceCount}/{claim.evidenceCount} active evidence source{claim.evidenceCount === 1 ? '' : 's'}</div>
                {#if claim.target}<div class="small">Structured record: <a href={targetHref(claim.target)}>{claim.target.title}</a></div>{/if}
              </div>

              <div class="claim-actions">
                {#if claim.status === 'ACTIVE' && !claim.target && ['OBJECTIVE','WANT','OFFER'].includes(claim.kind)}
                  <form method="post" action="?/promoteClaim">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="target" value={claim.kind} />
                    <button class="btn primary" type="submit">Create {claim.kind.toLowerCase()}</button>
                  </form>
                {/if}
                <a class="btn" href={`/knowledge/${claim.id}`}>Open claim</a>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <div class="actions footer-actions">
      <a class="btn" href={`/contacts/${interaction.contactId}`}>Back to contact</a>
      <a data-sveltekit-reload href={`/contacts/${$page.params.id}/interactions/${$page.params.iid}/delete`} class="btn danger-hover" aria-label="Delete this note">Delete note</a>
    </div>
  </div>
</div>

<style>
  .page-card { padding:16px; max-width:1000px; margin:0 auto; }
  .header-row,.block-head,.claim-row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .header-row h1,.block-head h3 { margin:0; }
  .muted { color:var(--muted); } .small{font-size:.9rem}.tiny{font-size:.8rem;margin:0}
  .pill,.warning-pill { padding:2px 9px; border-radius:9999px; font-size:12px; border:1px solid var(--border); }
  .warning-pill { border-color:#d97706; color:#b45309; }
  .inner-card { padding:12px; margin-top:12px; }
  pre { white-space:pre-wrap; margin:8px 0 0; font:inherit; }
  .area,.field input,.field select,.field textarea { width:100%; border:1px solid var(--border); border-radius:10px; padding:9px 11px; background:var(--surface); color:var(--text); font:inherit; }
  .stack,.capture-form { display:grid; gap:10px; margin-top:10px; }
  .actions,.title-line,.claim-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .grid { display:grid; gap:10px; }.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.field{display:grid;gap:5px}
  .advanced { border:1px solid var(--border); border-radius:10px; padding:9px 11px; }.advanced summary{cursor:pointer;font-weight:600}.advanced-grid{margin-top:10px}.advanced .field{margin-top:10px}
  .claim-list { display:grid; gap:10px; margin-top:12px; }.claim-row{border-top:1px solid var(--border);padding-top:10px}.claim-main{flex:1}.claim-actions{justify-content:flex-end}.claim-link{color:inherit;text-decoration:none}.claim-link:hover{text-decoration:underline}
  .btn { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:var(--surface-2); color:var(--text); text-decoration:none; border:1px solid var(--border); cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg,#21c7b6,#0fa7a0);border-color:#0f9b92;color:white;font-weight:700}.btn.danger-hover:hover{background:#dc2626;border-color:#b91c1c;color:white}
  .footer-actions{margin-top:16px}.error-box{margin-top:12px;padding:10px 12px;border:1px solid #dc2626;border-radius:10px}
  @media(max-width:760px){.header-row,.block-head,.claim-row{flex-direction:column}.grid.two{grid-template-columns:1fr}.claim-actions{justify-content:flex-start}}
</style>
