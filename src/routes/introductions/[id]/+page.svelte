<script lang="ts">
  export let data: any;
  export let form: any;
  let showOutcome = false;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }

  function partyLabel(party: any) {
    if (!party) return 'Unknown party';
    return [party.contact?.name, party.company?.name].filter(Boolean).join(' - ') || 'Unknown party';
  }

  function yn(value: boolean | null | undefined) {
    return value === true ? 'Yes' : value === false ? 'No' : 'Unknown';
  }
</script>

<svelte:head><title>Introduction - Relish</title></svelte:head>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Introduction</div>
      <h1>{partyLabel(data.introduction.partyA)} ↔ {partyLabel(data.introduction.partyB)}</h1>
      <p class="muted">{fmt(data.introduction.occurredAt)} - {data.introduction.statusLabel}</p>
    </div>
    <a class="btn" href="/introductions">Back to introductions</a>
  </div>

  {#if form?.error}<section class="card error-card">{form.error}</section>{/if}

  <section class="card panel">
    <div class="grid details">
      <strong>Party A</strong><div>{partyLabel(data.introduction.partyA)}{#if data.introduction.partyA?.role}<span class="muted"> - {data.introduction.partyA.role}</span>{/if}</div>
      <strong>Party B</strong><div>{partyLabel(data.introduction.partyB)}{#if data.introduction.partyB?.role}<span class="muted"> - {data.introduction.partyB.role}</span>{/if}</div>
      <strong>Facilitator</strong><div>{data.introduction.facilitatorContact?.name || 'Me / this workspace'}</div>
      <strong>Authority</strong><div>{data.introduction.authorityLabel}</div>
      <strong>Source</strong><div>{data.introduction.sourceTypeLabel}</div>
    </div>
    <div class="text-block"><h2>Reason / context</h2><p>{data.introduction.reason || 'No reason recorded.'}</p></div>
    {#if data.introduction.notes}<div class="text-block"><h2>Notes</h2><p>{data.introduction.notes}</p></div>{/if}
    {#if data.introduction.evidence}<div class="text-block"><h2>Source / evidence</h2><p>{data.introduction.evidence}</p></div>{/if}

    <form method="post" action="?/updateStatus" class="inline-form">
      <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.introductionStatuses as opt}<option value={opt.value} selected={data.introduction.status === opt.value}>{opt.label}</option>{/each}</select></div>
      <button class="btn primary" type="submit">Update status</button>
    </form>
  </section>

  <section class="card panel">
    <div class="section-head"><div><h2>Outcomes</h2><p class="muted small">Append what happened over time. Do not overwrite earlier evidence.</p></div><button class="btn primary" type="button" on:click={() => (showOutcome = !showOutcome)}>{showOutcome ? 'Cancel' : 'Record outcome'}</button></div>

    {#if showOutcome}
      <form method="post" action="?/addOutcome" class="outcome-form">
        <div class="grid three">
          <div class="field"><label for="outcomeOccurredAt">Date/time</label><input id="outcomeOccurredAt" name="occurredAt" type="datetime-local" /></div>
          <div class="field"><label for="outcomeStatus">Status</label><select id="outcomeStatus" name="status">{#each data.outcomeStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="commerciality">Result type</label><select id="commerciality" name="commerciality">{#each data.outcomeCommerciality as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="useful">Was it useful?</label><select id="useful" name="useful">{#each data.yesNoUnknown as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="continued">Did the relationship continue?</label><select id="continued" name="continued">{#each data.yesNoUnknown as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="value">Commercial value ($m, optional)</label><input id="value" name="value" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" /></div>
        </div>
        <div class="field"><label for="result">Result</label><textarea id="result" name="result" rows="3" placeholder="What happened?"></textarea></div>
        <div class="field"><label for="outcomeNotes">Notes</label><textarea id="outcomeNotes" name="notes" rows="3"></textarea></div>
        <div class="grid three">
          <div class="field"><label for="outcomeAuthority">Authority</label><select id="outcomeAuthority" name="authority">{#each data.knowledgeAuthorities as opt}<option value={opt.value} selected={opt.value === 'WORKSPACE_RECORDED'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="outcomeSourceType">Source</label><select id="outcomeSourceType" name="sourceType">{#each data.knowledgeSourceTypes as opt}<option value={opt.value} selected={opt.value === 'MANUAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="outcomeEvidence">Source / evidence</label><input id="outcomeEvidence" name="evidence" /></div>
        </div>
        <input type="hidden" name="currency" value="AUD" />
        <button class="btn primary" type="submit">Save outcome</button>
      </form>
    {/if}

    {#if data.introduction.outcomes.length === 0}
      <p class="muted">No outcome recorded yet.</p>
    {:else}
      <div class="outcome-list">
        {#each data.introduction.outcomes as outcome}
          <article class="outcome-card">
            <div class="topline"><strong>{outcome.statusLabel}</strong><span class="muted small">{fmt(outcome.occurredAt)}</span></div>
            <div class="chip-row">
              <span class="status-chip">Useful: {yn(outcome.useful)}</span>
              <span class="status-chip">Continued: {yn(outcome.continued)}</span>
              <span class="status-chip">{outcome.commercialityLabel}</span>
              {#if outcome.valueLabel}<span class="status-chip">{outcome.valueLabel}</span>{/if}
            </div>
            {#if outcome.result}<p>{outcome.result}</p>{/if}
            {#if outcome.notes}<p class="muted">{outcome.notes}</p>{/if}
            <div class="muted small">{outcome.authorityLabel} - {outcome.sourceTypeLabel}{#if outcome.evidence} - {outcome.evidence}{/if}</div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .container { padding:12px; }
  .page-head, .section-head, .topline { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
  h1, h2 { margin:0; } h2 { font-size:1.1rem; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; }
  .muted { color:var(--muted); } .small { font-size:0.9rem; }
  .panel, .error-card { padding:14px; margin-bottom:12px; }
  .error-card { color:var(--danger); }
  .grid.details { display:grid; grid-template-columns:180px 1fr; gap:8px 12px; }
  .grid.three { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field input, .field select, .field textarea { padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .text-block { border-top:1px solid var(--border); margin-top:12px; padding-top:12px; }
  .text-block p { white-space:pre-wrap; }
  .inline-form { display:flex; gap:10px; align-items:flex-end; margin-top:14px; }
  .inline-form .field { margin:0; min-width:220px; }
  .outcome-form { border-top:1px solid var(--border); margin-top:12px; padding-top:12px; }
  .outcome-list { display:grid; gap:10px; margin-top:12px; }
  .outcome-card { border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .chip-row { display:flex; gap:6px; flex-wrap:wrap; }
  .status-chip { border:1px solid var(--border); background:var(--panel); border-radius:999px; padding:3px 8px; font-size:0.82rem; color:var(--muted); }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg, #21c7b6, #0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  @media (max-width:860px) { .page-head, .section-head, .topline, .inline-form { flex-direction:column; align-items:stretch; } .grid.details, .grid.three { grid-template-columns:1fr; } }
</style>
