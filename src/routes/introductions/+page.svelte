<script lang="ts">
  export let data: any;
  export let form: any;

  let showCreate = false;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  function partyLabel(party: any) {
    if (!party) return 'Unknown party';
    return [party.contact?.name, party.company?.name].filter(Boolean).join(' - ') || 'Unknown party';
  }
</script>

<svelte:head><title>Introductions - Relish</title></svelte:head>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Relationship Core</div>
      <h1>Introductions</h1>
      <p class="muted">Record real connections and what happened so future matching is learned from evidence rather than assumptions.</p>
    </div>
    <button class="btn primary" type="button" on:click={() => (showCreate = !showCreate)}>{showCreate ? 'Cancel' : 'Record introduction'}</button>
  </div>

  {#if form?.error}<section class="card error-card">{form.error}</section>{/if}

  {#if showCreate}
    <section class="card panel">
      <h2>Record introduction</h2>
      <form method="post" action="?/create">
        <div class="grid three">
          <div class="field"><label for="occurredAt">Date/time</label><input id="occurredAt" name="occurredAt" type="datetime-local" /></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.introductionStatuses as opt}<option value={opt.value} selected={opt.value === 'INTRODUCED'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="facilitatorContactId">Facilitator</label><select id="facilitatorContactId" name="facilitatorContactId"><option value="">Me / this workspace</option>{#each data.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
        </div>

        <div class="party-grid">
          <fieldset class="party-card">
            <legend>Party A</legend>
            <div class="field"><label for="partyAContactId">Contact</label><select id="partyAContactId" name="partyAContactId"><option value="">No contact</option>{#each data.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
            <div class="field"><label for="partyACompanyId">Company</label><select id="partyACompanyId" name="partyACompanyId"><option value="">No company</option>{#each data.companies as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
            <div class="field"><label for="partyARole">Role/context</label><input id="partyARole" name="partyARole" placeholder="e.g. buyer, mentor, candidate" /></div>
          </fieldset>

          <fieldset class="party-card">
            <legend>Party B</legend>
            <div class="field"><label for="partyBContactId">Contact</label><select id="partyBContactId" name="partyBContactId"><option value="">No contact</option>{#each data.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
            <div class="field"><label for="partyBCompanyId">Company</label><select id="partyBCompanyId" name="partyBCompanyId"><option value="">No company</option>{#each data.companies as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
            <div class="field"><label for="partyBRole">Role/context</label><input id="partyBRole" name="partyBRole" placeholder="e.g. seller, adviser, employer" /></div>
          </fieldset>
        </div>

        <div class="field"><label for="reason">Reason / context</label><textarea id="reason" name="reason" rows="4" required placeholder="Why did these two sides matter to each other?"></textarea></div>
        <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes" rows="3" placeholder="Anything operational or contextual about the introduction"></textarea></div>

        <div class="grid three">
          <div class="field"><label for="authority">Authority</label><select id="authority" name="authority">{#each data.knowledgeAuthorities as opt}<option value={opt.value} selected={opt.value === 'WORKSPACE_RECORDED'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceType">Source</label><select id="sourceType" name="sourceType">{#each data.knowledgeSourceTypes as opt}<option value={opt.value} selected={opt.value === 'MANUAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="evidence">Source / evidence note</label><input id="evidence" name="evidence" placeholder="e.g. I made the introduction by email" /></div>
        </div>

        <button class="btn primary" type="submit">Save introduction</button>
      </form>
    </section>
  {/if}

  {#if data.introductions.length === 0}
    <section class="card empty"><h2>No introductions recorded</h2><p class="muted">Start with real connections you make manually. Their outcomes will inform the future matching model.</p></section>
  {:else}
    <div class="intro-list">
      {#each data.introductions as intro}
        <a class="card intro-card" href={`/introductions/${intro.id}`}>
          <div class="topline">
            <div>
              <h2>{partyLabel(intro.partyA)} ↔ {partyLabel(intro.partyB)}</h2>
              <div class="muted small">{fmt(intro.occurredAt)} - {intro.statusLabel}</div>
            </div>
            <span class="status-chip">{intro.outcomes.length} outcome{intro.outcomes.length === 1 ? '' : 's'}</span>
          </div>
          {#if intro.reason}<p>{intro.reason}</p>{/if}
          <div class="muted small">{intro.authorityLabel} - {intro.sourceTypeLabel}</div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container { padding:12px; }
  .page-head, .topline { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
  h1, h2 { margin:0; } h2 { font-size:1.1rem; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; }
  .muted { color:var(--muted); } .small { font-size:0.9rem; }
  .panel, .empty, .error-card { padding:14px; margin-bottom:12px; }
  .error-card { color:var(--danger); }
  .grid.three { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
  .party-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; margin-bottom:12px; }
  .party-card { border:1px solid var(--border); border-radius:14px; padding:12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field input, .field select, .field textarea { padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .intro-list { display:grid; gap:10px; }
  .intro-card { display:block; padding:14px; color:var(--text); text-decoration:none; }
  .intro-card:hover { border-color:var(--accent); text-decoration:none; }
  .status-chip { border:1px solid var(--border); background:var(--panel); border-radius:999px; padding:3px 8px; font-size:0.82rem; color:var(--muted); white-space:nowrap; }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg, #21c7b6, #0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  @media (max-width:860px) { .page-head, .topline { flex-direction:column; } .grid.three, .party-grid { grid-template-columns:1fr; } }
</style>
