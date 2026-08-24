<!-- src/routes/wants/+page.svelte -->
<script lang="ts">
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  let showCreate = Boolean(form?.error);
  let description = '';
  let summary = '';

  function valueRange(item: any) {
    if (item.valueMinLabel && item.valueMaxLabel) return `${item.valueMinLabel} to ${item.valueMaxLabel}`;
    if (item.valueMinLabel) return `From ${item.valueMinLabel}`;
    if (item.valueMaxLabel) return `Up to ${item.valueMaxLabel}`;
    return '';
  }
</script>

<div class="container">
  <header class="page-head">
    <div>
      <div class="eyebrow">Market demand</div>
      <h1>Wants</h1>
      <p class="muted">Track buyer mandates, acquisition criteria, search briefs, and “keep an eye out” requests.</p>
    </div>
    <button class="btn primary" type="button" on:click={() => (showCreate = !showCreate)}>{showCreate ? 'Close' : 'New want'}</button>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="summary-grid">
    <a class="card stat" href="/wants"><span>Open</span><strong>{data.summary.openCount}</strong></a>
    <a class="card stat" href="/wants?status=ACTIVE_MANDATE"><span>Active mandates</span><strong>{data.summary.active}</strong></a>
    <a class="card stat" href="/wants?status=WATCHING_MARKET"><span>Watching market</span><strong>{data.summary.watching}</strong></a>
    <a class="card stat" href="/wants?status=MATCHED"><span>Matched</span><strong>{data.summary.matched}</strong></a>
  </div>

  {#if showCreate}
    <section class="card panel">
      <h2>Create want</h2>
      <form method="post" action="?/create" class="create-form">
        <div class="grid three">
          <div class="field"><label for="wantType">Type</label><select id="wantType" name="wantType">{#each data.wantTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.wantStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="category">Category</label><input id="category" name="category" placeholder="e.g. RTO, aged care, mortgage book" /></div>
        </div>
        <div class="field"><label for="wantTitle">Title</label><input id="wantTitle" name="wantTitle" placeholder="e.g. Centre of Excellence wants RTO acquisition opportunities" required /></div>
        <VoiceTextField id="wantDescription" textName="wantDescription" summaryName="wantSummary" label="Description" placeholder="Record the want in plain English." rows={4} bind:value={description} bind:summary={summary} contextLabel="want" />
        <div class="field"><label for="criteria">Criteria</label><textarea id="criteria" name="criteria" rows="3" placeholder="Specific criteria, exclusions, preferred size, sector, geography, timing"></textarea></div>
        <div class="grid three">
          <div class="field"><label for="contactId">Contact</label><select id="contactId" name="contactId"><option value="">No contact</option>{#each data.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="companyId">Company</label><select id="companyId" name="companyId"><option value="">No company</option>{#each data.companies as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="dealId">Deal</label><select id="dealId" name="dealId"><option value="">No deal</option>{#each data.deals as deal}<option value={deal.id}>{deal.title}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="projectId">Project</label><select id="projectId" name="projectId"><option value="">No project</option>{#each data.projects as p}<option value={p.id}>{p.title}</option>{/each}</select></div>
          <div class="field"><label for="workstreamId">Workstream</label><select id="workstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="importance">Importance</label><select id="importance" name="importance"><option value="1">1 - Low</option><option value="2">2 - Useful</option><option value="3" selected>3 - Important</option><option value="4">4 - High value</option><option value="5">5 - Critical</option></select></div>
          <div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each data.wantUrgencies as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="timeHorizon">Time horizon</label><select id="timeHorizon" name="timeHorizon">{#each data.wantTimeHorizons as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="confidence">Confidence</label><select id="confidence" name="confidence">{#each data.wantConfidences as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="geography">Geography</label><input id="geography" name="geography" placeholder="e.g. Victoria" /></div>
          <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value="AUD" maxlength="3" /></div>
        </div>
        <div class="grid four">
          <div class="field"><label for="valueMin">Value min</label><input id="valueMin" name="valueMin" inputmode="decimal" /></div>
          <div class="field"><label for="valueMax">Value max</label><input id="valueMax" name="valueMax" inputmode="decimal" /></div>
          <div class="field"><label for="reviewAt">Review</label><input id="reviewAt" name="reviewAt" type="date" on:change={closeDatePickerOnChange} /></div>
          <div class="field"><label for="expiresAt">Expiry</label><input id="expiresAt" name="expiresAt" type="date" on:change={closeDatePickerOnChange} /></div>
        </div>
        <button class="btn primary" type="submit">Save want</button>
      </form>
    </section>
  {/if}

  <section class="card filters">
    <form method="get" class="filter-row">
      <input name="q" placeholder="Search wants" value={data.q} />
      <select name="wantType"><option value="">All types</option>{#each data.wantTypes as opt}<option value={opt.value} selected={data.selectedType === opt.value}>{opt.label}</option>{/each}</select>
      <select name="status"><option value="">Open statuses</option>{#each data.wantStatuses as opt}<option value={opt.value} selected={data.selectedStatus === opt.value}>{opt.label}</option>{/each}</select>
      <select name="projectId"><option value="">All projects</option>{#each data.projects as p}<option value={p.id} selected={data.selectedProjectId === p.id}>{p.title}</option>{/each}</select>
      <select name="workstreamId"><option value="">All workstreams</option>{#each data.workstreams as ws}<option value={ws.id} selected={data.selectedWorkstreamId === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select>
      <button class="btn primary" type="submit">Filter</button>
    </form>
  </section>

  {#if data.wants.length === 0}
    <section class="card empty"><h2>No wants found</h2><p class="muted">Create a want when someone asks you to keep an eye out for something or gives acquisition/search criteria.</p></section>
  {:else}
    <div class="want-list">
      {#each data.wants as want}
        <a class="card want-card" href={`/wants/${want.id}`}>
          <div class="topline">
            <div><h2>{want.title}</h2><div class="muted small">{want.wantTypeLabel} - {want.statusLabel} - {want.urgencyLabel} - {want.timeHorizonLabel}</div></div>
            <div class="chip-row"><span class="status-chip">Importance {want.importance}/5</span><span class="status-chip">{want.confidenceLabel}</span></div>
          </div>
          <div class="muted small">{want.contact?.name || ''}{want.contact && want.company ? ' - ' : ''}{want.company?.name || ''}</div>
          {#if want.project || want.workstream}<div class="muted small">{want.project?.title || ''}{want.workstream ? ` - ${want.workstream.name}` : ''}</div>{/if}
          {#if want.category || want.geography || valueRange(want)}<div class="muted small">{want.category}{want.category && want.geography ? ' - ' : ''}{want.geography}{(want.category || want.geography) && valueRange(want) ? ' - ' : ''}{valueRange(want)}</div>{/if}
          {#if want.descriptionPreview}<p>{want.descriptionPreview}</p>{/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container { padding: 12px; }
  .page-head, .topline, .filter-row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .filter-row { align-items:center; flex-wrap:wrap; }
  h1, h2 { margin:0; } h2 { font-size:1.1rem; }
  .eyebrow { color: var(--accent); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; }
  .muted { color:var(--muted); } .small { font-size:0.9rem; }
  .panel, .filters, .empty, .error-card { padding:14px; margin-bottom:12px; }
  .error-card { color:var(--danger); }
  .summary-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; margin-bottom:12px; }
  .stat { padding:12px; display:grid; gap:4px; text-decoration:none; color:var(--text); } .stat span { color:var(--muted); font-size:0.9rem; } .stat strong { font-size:1.5rem; }
  .grid.two { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
  .grid.three { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
  .grid.four { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field input, .field select, .field textarea, .filter-row input, .filter-row select { padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .want-list { display:grid; gap:10px; }
  .want-card { display:block; padding:14px; color:var(--text); text-decoration:none; }
  .want-card:hover { border-color:var(--accent); text-decoration:none; }
  .chip-row { display:flex; gap:6px; flex-wrap:wrap; }
  .status-chip { border:1px solid var(--border); background:var(--panel); border-radius:999px; padding:3px 8px; font-size:0.82rem; color:var(--muted); }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { font-weight:700; }
  @media (max-width: 860px) { .page-head, .topline, .filter-row { flex-direction:column; align-items:stretch; } .grid.two, .grid.three, .grid.four, .summary-grid { grid-template-columns:1fr; } }
</style>
