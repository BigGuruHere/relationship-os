<!-- src/routes/offers/+page.svelte -->
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
      <div class="eyebrow">Market supply</div>
      <h1>Offers</h1>
      <p class="muted">Track seller opportunities, available assets, introductions, services, and things people can make available.</p>
    </div>
    <button class="btn primary" type="button" on:click={() => (showCreate = !showCreate)}>{showCreate ? 'Close' : 'New offer'}</button>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="summary-grid">
    <a class="card stat" href="/offers"><span>Open</span><strong>{data.summary.openCount}</strong></a>
    <a class="card stat" href="/offers?status=AVAILABLE"><span>Available</span><strong>{data.summary.available}</strong></a>
    <a class="card stat" href="/offers?status=WATCHING_INTEREST"><span>Watching interest</span><strong>{data.summary.watching}</strong></a>
    <a class="card stat" href="/offers?status=MATCHED"><span>Matched</span><strong>{data.summary.matched}</strong></a>
  </div>

  {#if showCreate}
    <section class="card panel">
      <h2>Create offer</h2>
      <form method="post" action="?/create" class="create-form">
        <div class="grid three">
          <div class="field"><label for="offerType">Type</label><select id="offerType" name="offerType">{#each data.offerTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.offerStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="direction">Direction</label><select id="direction" name="direction">{#each data.offerDirections as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="category">Category</label><input id="category" name="category" placeholder="e.g. mortgage book, aged care licence, introduction" /></div>
        <div class="field"><label for="offerTitle">Title</label><input id="offerTitle" name="offerTitle" placeholder="e.g. Owner may sell mortgage book" required /></div>
        <VoiceTextField id="offerDescription" textName="offerDescription" summaryName="offerSummary" label="Description" placeholder="Record the offer in plain English." rows={4} bind:value={description} bind:summary={summary} contextLabel="offer" />
        <div class="field"><label for="terms">Terms</label><textarea id="terms" name="terms" rows="3" placeholder="Terms, constraints, availability, owner intent, timing, exclusions"></textarea></div>
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
          <div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each data.offerUrgencies as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="timeHorizon">Time horizon</label><select id="timeHorizon" name="timeHorizon">{#each data.offerTimeHorizons as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="confidence">Confidence</label><select id="confidence" name="confidence">{#each data.offerConfidences as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="geography">Geography</label><input id="geography" name="geography" placeholder="e.g. Victoria" /></div>
          <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value="AUD" maxlength="3" /></div>
        </div>
        <div class="grid four">
          <div class="field"><label for="valueMin">Minimum value ($m)</label><input id="valueMin" name="valueMin" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" /></div>
          <div class="field"><label for="valueMax">Maximum value ($m)</label><input id="valueMax" name="valueMax" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" /></div>
          <div class="field"><label for="reviewAt">Review</label><input id="reviewAt" name="reviewAt" type="date" on:change={closeDatePickerOnChange} /></div>
          <div class="field"><label for="expiresAt">Expiry</label><input id="expiresAt" name="expiresAt" type="date" on:change={closeDatePickerOnChange} /></div>
        </div>
        <button class="btn primary" type="submit">Save offer</button>
      </form>
    </section>
  {/if}

  <section class="card filters">
    <form method="get" class="filter-row">
      <input name="q" placeholder="Search offers" value={data.q} />
      <select name="offerType"><option value="">All types</option>{#each data.offerTypes as opt}<option value={opt.value} selected={data.selectedType === opt.value}>{opt.label}</option>{/each}</select>
      <select name="status"><option value="">Open statuses</option>{#each data.offerStatuses as opt}<option value={opt.value} selected={data.selectedStatus === opt.value}>{opt.label}</option>{/each}</select>
      <select name="projectId"><option value="">All projects</option>{#each data.projects as p}<option value={p.id} selected={data.selectedProjectId === p.id}>{p.title}</option>{/each}</select>
      <select name="workstreamId"><option value="">All workstreams</option>{#each data.workstreams as ws}<option value={ws.id} selected={data.selectedWorkstreamId === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select>
      <select name="sort" aria-label="Sort"><option value="attention" selected={data.selectedSort === 'attention'}>Attention</option>{#each data.sortOptions.filter((opt) => opt.value !== 'attention') as opt}<option value={opt.value} selected={data.selectedSort === opt.value}>{opt.label}</option>{/each}</select>
      <button class="btn primary" type="submit">Filter</button>
    </form>
  </section>

  {#if data.offers.length === 0}
    <section class="card empty"><h2>No offers found</h2><p class="muted">Create an offer when someone may sell, provide, introduce, or make something available.</p></section>
  {:else}
    <div class="offer-list">
      {#each data.offers as offer}
        <a class="card offer-card" href={`/offers/${offer.id}`}>
          <div class="topline">
            <div><h2>{offer.title}</h2><div class="muted small">{offer.offerTypeLabel} - {offer.statusLabel} - {offer.directionLabel} - {offer.urgencyLabel} - {offer.timeHorizonLabel}</div></div>
            <div class="chip-row"><span class="status-chip">Importance {offer.importance}/5</span><span class="status-chip">{offer.confidenceLabel}</span></div>
          </div>
          <div class="muted small">{offer.contact?.name || ''}{offer.contact && offer.company ? ' - ' : ''}{offer.company?.name || ''}</div>
          {#if offer.project || offer.workstream}<div class="muted small">{offer.project?.title || ''}{offer.workstream ? ` - ${offer.workstream.name}` : ''}</div>{/if}
          {#if offer.category || offer.geography || valueRange(offer)}<div class="muted small">{offer.category}{offer.category && offer.geography ? ' - ' : ''}{offer.geography}{(offer.category || offer.geography) && valueRange(offer) ? ' - ' : ''}{valueRange(offer)}</div>{/if}
          {#if offer.descriptionPreview}<p>{offer.descriptionPreview}</p>{/if}
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
  .offer-list { display:grid; gap:10px; }
  .offer-card { display:block; padding:14px; color:var(--text); text-decoration:none; }
  .offer-card:hover { border-color:var(--accent); text-decoration:none; }
  .chip-row { display:flex; gap:6px; flex-wrap:wrap; }
  .status-chip { border:1px solid var(--border); background:var(--panel); border-radius:999px; padding:3px 8px; font-size:0.82rem; color:var(--muted); }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg, #21c7b6, #0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  @media (max-width: 860px) { .page-head, .topline, .filter-row { flex-direction:column; align-items:stretch; } .grid.two, .grid.three, .grid.four, .summary-grid { grid-template-columns:1fr; } }
</style>
