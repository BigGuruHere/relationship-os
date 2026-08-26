<!-- src/lib/TaskCommercialLinkPicker.svelte -->
<script lang="ts">
  // PURPOSE: Lazy, scalable Task -> Want/Offer linker. Existing links remain visible while search stays collapsed.
  // SECURITY: Search calls the authenticated tenant-scoped endpoint; the hidden selected id is validated again on save.

  export let kind: 'want' | 'offer';
  export let selectedId = '';
  export let initialSelected: any = null;
  export let contactId = '';
  export let companyId = '';
  export let dealId = '';
  export let projectId = '';
  export let workstreamId = '';

  let query = '';
  let suggestions: any[] = initialSelected ? [initialSelected] : [];
  let loading = false;
  let error = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let detailsEl: HTMLDetailsElement | null = null;
  let searchLoaded = false;
  let lastContextSignature = '';

  $: label = kind === 'want' ? 'Want' : 'Offer';
  $: routeBase = kind === 'want' ? '/wants' : '/offers';
  $: selected = suggestions.find((item: any) => item.id === selectedId) || (initialSelected?.id === selectedId ? initialSelected : null);
  $: contextSignature = [contactId, companyId, dealId, projectId, workstreamId].join('|');

  function buildUrl() {
    const params = new URLSearchParams({ kind, q: query.trim() });
    if (contactId) params.set('contactId', contactId);
    if (companyId) params.set('companyId', companyId);
    if (dealId) params.set('dealId', dealId);
    if (projectId) params.set('projectId', projectId);
    if (workstreamId) params.set('workstreamId', workstreamId);
    if (selectedId) params.set('selectedId', selectedId);
    return `/api/task-commercial-links?${params.toString()}`;
  }

  async function searchNow() {
    loading = true;
    error = '';
    try {
      const response = await fetch(buildUrl(), { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('Search failed');
      const payload = await response.json();
      const next = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      // IT: Keep the currently selected record visible even when a new search does not return it.
      if (selected && !next.some((item: any) => item.id === selected.id)) next.unshift(selected);
      suggestions = next;
      searchLoaded = true;
      lastContextSignature = contextSignature;
    } catch {
      error = `Could not search ${label.toLowerCase()}s.`;
    } finally {
      loading = false;
    }
  }

  function scheduleSearch() {
    // IT: Do not spend server work re-ranking suggestions while the attachment panel is collapsed.
    if (!detailsEl?.open) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(searchNow, 250);
  }

  function handleToggle() {
    if (!detailsEl?.open) return;
    if (!searchLoaded || contextSignature !== lastContextSignature) void searchNow();
  }

  function choose(item: any) {
    selectedId = item.id;
    if (!suggestions.some((candidate: any) => candidate.id === item.id)) suggestions = [item, ...suggestions];
  }

  function clearSelection() {
    selectedId = '';
    scheduleSearch();
  }

  // IT: Context changes only trigger a re-rank if the user has deliberately opened this panel.
  $: if (detailsEl?.open && searchLoaded && contextSignature !== lastContextSignature) scheduleSearch();
</script>

<div class="commercial-picker">
  <input type="hidden" name={`${kind}Id`} value={selectedId} />

  <details bind:this={detailsEl} on:toggle={handleToggle}>
    <summary>
      <span class="summary-label">{label}</span>
      {#if selected}
        <span class="linked-summary">Linked: <strong>{selected.title}</strong></span>
      {:else}
        <span class="linked-summary muted">None linked</span>
      {/if}
      <span class="expand-hint">{selected ? 'Change' : 'Attach'}</span>
    </summary>

    <div class="picker-body">
      {#if selected}
        <div class="selected-row">
          <div>
            <strong>Linked: {selected.title}</strong>
            <div class="muted small">{selected.typeLabel} - {selected.statusLabel}</div>
          </div>
          <div class="row-actions">
            <a class="btn compact" href={`${routeBase}/${selected.id}`} target="_blank" rel="noreferrer">Open</a>
            <button class="btn compact" type="button" on:click={clearSelection}>Clear</button>
          </div>
        </div>
      {/if}

      <p class="hint">Relish ranks likely matches from this task's person, company, project and workstream. Search all {label.toLowerCase()}s if needed.</p>

      <div class="search-row">
        <input id={`${kind}-task-search`} bind:value={query} on:input={scheduleSearch} placeholder={`Search ${label.toLowerCase()} title, criteria, category, geography...`} />
        <button class="btn" type="button" on:click={searchNow}>{loading ? 'Searching...' : 'Search'}</button>
      </div>

      {#if error}<p class="error-text">{error}</p>{/if}
      {#if !loading && searchLoaded && suggestions.length === 0}<p class="muted small">No matching {label.toLowerCase()}s found.</p>{/if}

      {#if suggestions.length > 0}
        <div class="suggestion-list">
          {#each suggestions as item}
            <div class:selectedItem={item.id === selectedId} class="suggestion-row">
              <button class="choose" type="button" on:click={() => choose(item)}>
                <strong>{item.title}</strong>
                <span class="muted small">{item.typeLabel} - {item.statusLabel}</span>
                {#if item.reasons?.length}<span class="reason">{item.reasons.join(' · ')}</span>{/if}
                {#if item.companyName || item.contactName || item.projectTitle || item.workstreamName}
                  <span class="muted tiny">{[item.contactName, item.companyName, item.projectTitle, item.workstreamName].filter(Boolean).join(' · ')}</span>
                {/if}
              </button>
              <a class="btn compact" href={`${routeBase}/${item.id}`} target="_blank" rel="noreferrer">Open</a>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </details>
</div>

<style>
  .commercial-picker { border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
  details > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 9px; padding: 11px 12px; }
  details > summary::-webkit-details-marker { display: none; }
  details > summary::before { content: '▸'; color: var(--muted); transition: transform 0.15s ease; }
  details[open] > summary::before { transform: rotate(90deg); }
  .summary-label { font-weight: 700; min-width: 42px; }
  .linked-summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expand-hint { color: var(--accent); font-size: 0.82rem; font-weight: 700; }
  .picker-body { border-top: 1px solid var(--border); padding: 12px; display: grid; gap: 10px; }
  .search-row, .selected-row, .suggestion-row, .row-actions { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .hint { color: var(--muted); font-size: 0.82rem; margin: 0; }
  .search-row input { flex: 1; }
  .selected-row { background: var(--panel-2); border-radius: 8px; padding: 9px; }
  .suggestion-list { display: grid; gap: 6px; max-height: 340px; overflow: auto; }
  .suggestion-row { border-top: 1px solid var(--border); padding-top: 7px; }
  .suggestion-row.selectedItem { background: var(--panel-2); border-radius: 8px; padding: 7px; border-top-color: transparent; }
  .choose { flex: 1; border: 0; background: transparent; color: inherit; text-align: left; display: grid; gap: 2px; cursor: pointer; padding: 2px; }
  .reason { font-size: 0.78rem; font-weight: 700; }
  .muted { color: var(--muted); }
  .small { font-size: 0.88rem; }
  .tiny { font-size: 0.76rem; }
  .compact { padding: 5px 8px; white-space: nowrap; }
  .error-text { color: var(--danger); margin: 0; }
  @media (max-width: 700px) {
    .search-row, .selected-row, .suggestion-row { align-items: stretch; flex-direction: column; }
    .row-actions { justify-content: flex-start; }
    .linked-summary { white-space: normal; }
  }
</style>
