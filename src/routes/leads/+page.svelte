<!-- src/routes/leads/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';
  import { buildLeadDetailHref } from '$lib/leadListNavigation';

  export let data: any;
  export let form: any;

  let showCreate = Boolean(form?.values);
  let q = data.q || '';
  let type = data.selectedType || '';
  let status = data.selectedStatus || '';
  let sourceFilter = data.selectedSource || '';
  let batchId = data.selectedBatchId || '';
  let contactAttemptStatus = data.selectedContactAttemptStatus || '';
  let buyerStatus = data.selectedBuyerStatus || '';
  let sellerStatus = data.selectedSellerStatus || '';
  let projectId = data.selectedProjectId || '';
  let workstreamId = data.selectedWorkstreamId || '';
  let createSourceChoice = form?.values?.sourceChoice || (form?.values?.leadSourceId ? `custom:${form.values.leadSourceId}` : `builtin:${form?.values?.source || 'MANUAL'}`);
  let filtersExpanded = false;
  let pinnedFilter: { href: string; label: string } | null = null;

  $: activeFilterParts = buildActiveFilterParts();
  $: activeFilterSummary = activeFilterParts.length ? activeFilterParts.join(' · ') : 'All leads';
  $: hasActiveFilters = activeFilterParts.length > 0;
  $: currentFilterHref = buildCurrentFilterHref();
  $: currentFilterIsPinned = Boolean(pinnedFilter && pinnedFilter.href === currentFilterHref);

  onMount(() => {
    try {
      const raw = localStorage.getItem(data.pinStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.href === 'string' && parsed.href.startsWith('/leads') && typeof parsed.label === 'string') {
        pinnedFilter = { href: parsed.href, label: parsed.label };
      }
    } catch {
      pinnedFilter = null;
    }
  });

  function labelFor(options: any[], value: string) {
    return options?.find((option: any) => option.value === value || option.id === value)?.label
      || options?.find((option: any) => option.value === value || option.id === value)?.name
      || value;
  }

  function buildActiveFilterParts() {
    // IT: Pin only the filter that has actually been applied by the server, not unsaved edits in an open filter form.
    const appliedQ = String(data.q || '').trim();
    const appliedType = data.selectedType || '';
    const appliedStatus = data.selectedStatus || '';
    const appliedSource = data.selectedSource || '';
    const appliedBatch = data.selectedBatchId || '';
    const appliedAttempt = data.selectedContactAttemptStatus || '';
    const appliedBuyer = data.selectedBuyerStatus || '';
    const appliedSeller = data.selectedSellerStatus || '';
    const appliedProject = data.selectedProjectId || '';
    const appliedWorkstream = data.selectedWorkstreamId || '';
    const parts: string[] = [];
    if (appliedQ) parts.push(`Search: ${appliedQ}`);
    if (appliedType) parts.push(labelFor(data.leadTypes, appliedType));
    if (appliedStatus) parts.push(labelFor(data.leadStatuses, appliedStatus));
    if (appliedSource) parts.push(`Source: ${labelFor(data.leadSourceOptions, appliedSource)}`);
    if (appliedBatch) parts.push(`Batch: ${labelFor(data.importBatches, appliedBatch)}`);
    if (appliedAttempt) parts.push(labelFor(data.contactAttemptStatuses, appliedAttempt));
    if (appliedBuyer) parts.push(`Buyer: ${labelFor(data.buyerQualificationStatuses, appliedBuyer)}`);
    if (appliedSeller) parts.push(`Seller: ${labelFor(data.sellerQualificationStatuses, appliedSeller)}`);
    if (appliedProject) parts.push(`Project: ${labelFor(data.projects, appliedProject)}`);
    if (appliedWorkstream) parts.push(`Workstream: ${labelFor(data.workstreams, appliedWorkstream)}`);
    return parts;
  }

  function buildCurrentFilterHref() {
    const params = new URLSearchParams();
    const appliedQ = String(data.q || '').trim();
    if (appliedQ) params.set('q', appliedQ);
    if (data.selectedType) params.set('type', data.selectedType);
    if (data.selectedStatus) params.set('status', data.selectedStatus);
    if (data.selectedSource) params.set('source', data.selectedSource);
    if (data.selectedBatchId) params.set('batch', data.selectedBatchId);
    if (data.selectedContactAttemptStatus) params.set('contactAttemptStatus', data.selectedContactAttemptStatus);
    if (data.selectedBuyerStatus) params.set('buyerStatus', data.selectedBuyerStatus);
    if (data.selectedSellerStatus) params.set('sellerStatus', data.selectedSellerStatus);
    if (data.selectedProjectId) params.set('projectId', data.selectedProjectId);
    if (data.selectedWorkstreamId) params.set('workstreamId', data.selectedWorkstreamId);
    const query = params.toString();
    return query ? `/leads?${query}` : '/leads';
  }

  function pinCurrentFilter() {
    if (!hasActiveFilters) return;
    const next = { href: currentFilterHref, label: activeFilterSummary };
    pinnedFilter = next;
    try { localStorage.setItem(data.pinStorageKey, JSON.stringify(next)); } catch { /* Browser storage can be unavailable. */ }
  }

  function unpinFilter() {
    pinnedFilter = null;
    try { localStorage.removeItem(data.pinStorageKey); } catch { /* Browser storage can be unavailable. */ }
  }
</script>

<div class="container">
  <header class="page-head">
    <div>
      <div class="eyebrow">Market-making</div>
      <h1>Leads</h1>
      <p class="muted">Capture unconfirmed buyers, sellers, companies, contacts, mandates, assets, and referrers before they become CRM truth.</p>
    </div>
    <div class="head-actions">
      <a class="btn" href="/leads/import">Import leads</a>
      <button class="btn primary" type="button" on:click={() => (showCreate = !showCreate)}>{showCreate ? 'Close' : 'New lead'}</button>
    </div>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="summary-grid">
    <div class="card stat"><span>Open</span><strong>{data.summary.openCount}</strong></div>
    <div class="card stat"><span>New</span><strong>{data.summary.newCount}</strong></div>
    <div class="card stat"><span>Qualified</span><strong>{data.summary.qualified}</strong></div>
    <div class="card stat"><span>Converted</span><strong>{data.summary.converted}</strong></div>
  </div>

  {#if showCreate}
    <section class="card panel">
      <h2>Create lead</h2>
      <form method="post" action="?/create" class="create-form">
        <div class="grid two">
          <div class="field"><label for="title">Lead title</label><input id="title" name="title" placeholder="e.g. VIC mortgage book buyer mandate" value={form?.values?.title || ''} /></div>
          <div class="field"><label for="typeCreate">Lead type</label><select id="typeCreate" name="type">{#each data.leadTypes as opt}<option value={opt.value} selected={(form?.values?.type || 'OTHER') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="statusCreate">Status</label><select id="statusCreate" name="status">{#each data.leadStatuses as opt}<option value={opt.value} selected={(form?.values?.status || 'NEW') === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceChoiceCreate">Source</label><select id="sourceChoiceCreate" name="sourceChoice" bind:value={createSourceChoice}>{#each data.leadSourceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="commCreate">Usual communication</label><select id="commCreate" name="usualCommunicationMethod">{#each data.communicationMethods as opt}<option value={opt.value} selected={(form?.values?.usualCommunicationMethod || '') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        {#if createSourceChoice === 'CUSTOM'}
          <div class="field"><label for="newLeadSourceCreate">Custom source</label><input id="newLeadSourceCreate" name="newLeadSource" placeholder="e.g. Sam spreadsheet, MFAA list" value={form?.values?.newLeadSource || ''} /></div>
        {/if}
        <div class="grid three">
          <div class="field"><label for="contactAttemptCreate">Contact attempt</label><select id="contactAttemptCreate" name="contactAttemptStatus">{#each data.contactAttemptStatuses as opt}<option value={opt.value} selected={(form?.values?.contactAttemptStatus || 'NOT_CONTACTED') === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="buyerStatusCreate">Buyer status</label><select id="buyerStatusCreate" name="buyerStatus">{#each data.buyerQualificationStatuses as opt}<option value={opt.value} selected={(form?.values?.buyerStatus || 'NOT_ASKED') === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sellerStatusCreate">Seller status</label><select id="sellerStatusCreate" name="sellerStatus">{#each data.sellerQualificationStatuses as opt}<option value={opt.value} selected={(form?.values?.sellerStatus || 'NOT_ASKED') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="lastContactedAtCreate">Last contacted</label><input id="lastContactedAtCreate" name="lastContactedAt" type="datetime-local" value={form?.values?.lastContactedAt || ''} on:change={closeDatePickerOnChange} /></div>
        <div class="grid two"><div class="field"><label for="projectIdCreate">Project</label><select id="projectIdCreate" name="projectId"><option value="">Standalone lead</option>{#each data.projects as project}<option value={project.id} selected={(form?.values?.projectId || '') === project.id}>{project.title}</option>{/each}</select></div><div class="field"><label for="workstreamIdCreate">Workstream</label><select id="workstreamIdCreate" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id} selected={(form?.values?.workstreamId || '') === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div></div>
        <div class="grid two">
          <div class="field"><label for="name">Person name</label><input id="name" name="name" value={form?.values?.name || ''} /></div>
          <div class="field"><label for="companyName">Company name</label><input id="companyName" name="companyName" value={form?.values?.companyName || ''} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value={form?.values?.email || ''} /></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value={form?.values?.phone || ''} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="website">Website</label><input id="website" name="website" placeholder="https://..." value={form?.values?.website || ''} /></div>
          <div class="field"><label for="linkedin">LinkedIn</label><input id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/..." value={form?.values?.linkedin || ''} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="roleTitle">Role/title</label><input id="roleTitle" name="roleTitle" value={form?.values?.roleTitle || ''} /></div>
          <div class="field"><label for="geography">Geography</label><input id="geography" name="geography" placeholder="e.g. Melbourne, Victoria" value={form?.values?.geography || ''} /></div>
        </div>
        <div class="field"><label for="address">Address</label><input id="address" name="address" value={form?.values?.address || ''} /></div>
        <div class="grid three">
          <div class="field"><label for="priority">Priority 1-5</label><input id="priority" name="priority" type="number" min="1" max="5" value={form?.values?.priority || 3} /></div>
          <div class="field"><label for="confidence">Confidence 0-100</label><input id="confidence" name="confidence" type="number" min="0" max="100" value={form?.values?.confidence || 50} /></div>
          <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value={form?.values?.currency || 'AUD'} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="valueMin">Minimum value ($m)</label><input id="valueMin" name="valueMin" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={form?.values?.valueMin || ''} /></div>
          <div class="field"><label for="valueMax">Maximum value ($m)</label><input id="valueMax" name="valueMax" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={form?.values?.valueMax || ''} /></div>
        </div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{form?.values?.description || ''}</textarea></div>
        <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes" rows="3">{form?.values?.notes || ''}</textarea></div>
        <div class="grid two">
          <div class="field"><label for="sourceUrl">Source URL</label><input id="sourceUrl" name="sourceUrl" value={form?.values?.sourceUrl || ''} /></div>
          <div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={form?.values?.nextAction || ''} /></div>
        </div>
        <button class="btn primary" type="submit">Save lead</button>
      </form>
    </section>
  {/if}

  {#if pinnedFilter}
    <section class="card pinned-filter" aria-label="Pinned lead filter">
      <div>
        <div class="eyebrow">Pinned working list</div>
        <strong>{pinnedFilter.label}</strong>
      </div>
      <div class="pinned-actions">
        <a class="btn primary" href={pinnedFilter.href}>Open</a>
        <button class="btn" type="button" on:click={unpinFilter}>Unpin</button>
      </div>
    </section>
  {/if}

  <section class="card filters">
    <div class="filter-head">
      <button class="btn filter-toggle" type="button" on:click={() => (filtersExpanded = !filtersExpanded)} aria-expanded={filtersExpanded}>
        {filtersExpanded ? 'Hide filters' : 'Filters'} {filtersExpanded ? '▲' : '▼'}
      </button>
      {#if hasActiveFilters}<span class="muted small current-filter">{activeFilterSummary}</span>{/if}
      {#if hasActiveFilters}
        <button class="btn" type="button" on:click={pinCurrentFilter} disabled={currentFilterIsPinned}>{currentFilterIsPinned ? 'Pinned' : 'Pin current filter'}</button>
      {/if}
    </div>
    {#if filtersExpanded}
      <form method="GET" class="filter-row">
        <input name="q" bind:value={q} placeholder="Search leads, people, companies, phone, email, sector" />
        <select name="type" bind:value={type}><option value="">All types</option>{#each data.leadTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        <select name="status" bind:value={status}><option value="">All statuses</option>{#each data.leadStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        <select name="source" bind:value={sourceFilter}><option value="">All sources</option>{#each data.leadSourceOptions as opt}{#if opt.value !== 'CUSTOM'}<option value={opt.value}>{opt.label}</option>{/if}{/each}</select>
        <select name="batch" bind:value={batchId}><option value="">All batches</option>{#each data.importBatches as batch}<option value={batch.id}>{batch.name}</option>{/each}</select>
        <select name="contactAttemptStatus" bind:value={contactAttemptStatus}><option value="">All contact attempts</option>{#each data.contactAttemptStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        <select name="buyerStatus" bind:value={buyerStatus}><option value="">All buyer statuses</option>{#each data.buyerQualificationStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        <select name="sellerStatus" bind:value={sellerStatus}><option value="">All seller statuses</option>{#each data.sellerQualificationStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        <select name="projectId" bind:value={projectId}><option value="">All projects</option>{#each data.projects as project}<option value={project.id}>{project.title}</option>{/each}</select>
        <select name="workstreamId" bind:value={workstreamId}><option value="">All workstreams</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select>
        <button class="btn primary" type="submit">Apply filters</button>
        <a class="btn" href="/leads">Clear</a>
      </form>
    {/if}
  </section>

  {#if data.leads.length === 0}
    <section class="card empty"><h2>No leads yet</h2><p class="muted">Capture weak signals here before deciding whether they deserve a contact, company, deal, want, or offer.</p></section>
  {:else}
    <div class="lead-list" id="lead-list">
      {#each data.leads as lead}
        <a class="card lead-card" href={buildLeadDetailHref(lead.id, data.currentPath || '/leads')}>
          <div class="topline">
            <div><h2>{lead.title}</h2><div class="muted small">{lead.typeLabel} - {lead.statusLabel} - {lead.sourceLabel}</div><div class="muted small">Contact: {lead.contactAttemptStatusLabel} - Buyer: {lead.buyerStatusLabel} - Seller: {lead.sellerStatusLabel}</div></div>
            <div class="chip-row"><span class="status-chip">Priority {lead.priority}</span><span class="status-chip">{lead.confidence}/100</span><span class="status-chip">{lead.contactAttemptStatusLabel}</span></div>
          </div>
          {#if lead.name || lead.companyName || lead.roleTitle}<div class="muted small">{lead.name}{lead.roleTitle ? ` - ${lead.roleTitle}` : ''}{lead.companyName ? ` - ${lead.companyName}` : ''}</div>{/if}
          {#if lead.workstream}<div class="muted small">Workstream: {lead.workstream.name}</div>{/if}
          {#if lead.email || lead.phone || lead.website}<div class="muted small">{lead.email}{lead.email && lead.phone ? ' - ' : ''}{lead.phone}{(lead.email || lead.phone) && lead.website ? ' - ' : ''}{lead.website}</div>{/if}
          {#if lead.descriptionPreview}<p>{lead.descriptionPreview}</p>{/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container { padding: 12px; }
  .page-head, .topline, .filter-row, .head-actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .filter-row { align-items: center; flex-wrap: wrap; }
  .head-actions { align-items:center; flex-wrap:wrap; }
  h1, h2 { margin: 0; } h2 { font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); } .small { font-size: 0.9rem; }
  .panel, .filters, .empty, .error-card, .pinned-filter { padding: 14px; margin-bottom: 12px; }
  .pinned-filter, .filter-head, .pinned-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .pinned-actions { justify-content: flex-end; flex-wrap: wrap; }
  .filter-head { flex-wrap: wrap; }
  .filter-toggle { min-width: 110px; }
  .current-filter { flex: 1 1 280px; }
  .error-card { color: var(--danger); }
  .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { padding: 12px; display: grid; gap: 4px; } .stat span { color: var(--muted); font-size: 0.9rem; } .stat strong { font-size: 1.5rem; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .lead-list { display: grid; gap: 10px; }
  .lead-card { display: block; padding: 14px; color: var(--text); text-decoration: none; }
  .lead-card:hover { border-color: var(--accent); text-decoration: none; }
  .chip-row { display:flex; gap:6px; flex-wrap:wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 8px; font-size: 0.82rem; color: var(--muted); }
  @media (max-width: 860px) { .page-head, .topline, .filter-row, .pinned-filter, .filter-head { flex-direction: column; align-items: stretch; } .grid.two, .grid.three, .grid.four, .summary-grid { grid-template-columns: 1fr; } }
</style>
