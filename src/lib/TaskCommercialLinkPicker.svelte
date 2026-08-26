<!-- src/lib/TaskCommercialLinkPicker.svelte -->
<script lang="ts">
  // PURPOSE: Search and rank a task's likely Want or Offer without rendering every record in one dropdown.
  // SECURITY: Search calls the authenticated server endpoint; the hidden selected id is still validated on save.
  import { onMount } from 'svelte';

  export let kind: 'want' | 'offer';
  export let selectedId = '';
  export let initialSuggestions: any[] = [];
  export let contactId = '';
  export let companyId = '';
  export let dealId = '';
  export let projectId = '';
  export let workstreamId = '';

  let query = '';
  let suggestions = initialSuggestions || [];
  let loading = false;
  let error = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mounted = false;
  let lastContextSignature = '';

  $: label = kind === 'want' ? 'Want' : 'Offer';
  $: routeBase = kind === 'want' ? '/wants' : '/offers';
  $: selected = suggestions.find((item: any) => item.id === selectedId) || null;
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
      suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    } catch {
      error = `Could not search ${label.toLowerCase()}s.`;
    } finally {
      loading = false;
    }
  }

  function scheduleSearch() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(searchNow, 250);
  }

  function choose(item: any) {
    selectedId = item.id;
    // IT: Keep the chosen row in the current suggestion set so its context remains visible after selection.
    if (!suggestions.some((candidate: any) => candidate.id === item.id)) suggestions = [item, ...suggestions];
  }

  function clearSelection() {
    selectedId = '';
    scheduleSearch();
  }

  onMount(() => {
    mounted = true;
    lastContextSignature = contextSignature;
  });

  // IT: Re-rank suggestions whenever the task's person/company/project/workstream context changes.
  $: if (mounted && contextSignature !== lastContextSignature) {
    lastContextSignature = contextSignature;
    scheduleSearch();
  }
</script>

<div class="commercial-picker">
  <input type="hidden" name={`${kind}Id`} value={selectedId} />
  <div class="picker-head">
    <div>
      <label for={`${kind}-task-search`}>Attach {label.toLowerCase()}</label>
      <p class="hint">Relish ranks likely matches from this task's person, company, project and workstream. Search all {label.toLowerCase()}s if needed.</p>
    </div>
    {#if selectedId}<button class="btn compact" type="button" on:click={clearSelection}>Clear</button>{/if}
  </div>

  {#if selected}
    <div class="selected-row">
      <div>
        <strong>Linked: {selected.title}</strong>
        <div class="muted small">{selected.typeLabel} - {selected.statusLabel}</div>
      </div>
      <a class="btn compact" href={`${routeBase}/${selected.id}`} target="_blank" rel="noreferrer">Open</a>
    </div>
  {/if}

  <div class="search-row">
    <input id={`${kind}-task-search`} bind:value={query} on:input={scheduleSearch} placeholder={`Search ${label.toLowerCase()} title, criteria, category, geography...`} />
    <button class="btn" type="button" on:click={searchNow}>{loading ? 'Searching...' : 'Search'}</button>
  </div>

  {#if error}<p class="error-text">{error}</p>{/if}
  {#if !loading && suggestions.length === 0}<p class="muted small">No matching {label.toLowerCase()}s found.</p>{/if}

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

<style>
  .commercial-picker { border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: grid; gap: 10px; }
  .picker-head, .search-row, .selected-row, .suggestion-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .picker-head label { font-weight: 700; }
  .hint { color: var(--muted); font-size: 0.82rem; margin: 3px 0 0; }
  .search-row input { flex: 1; }
  .selected-row { background: var(--panel); border-radius: 8px; padding: 9px; }
  .suggestion-list { display: grid; gap: 6px; max-height: 340px; overflow: auto; }
  .suggestion-row { border-top: 1px solid var(--border); padding-top: 7px; }
  .suggestion-row.selectedItem { background: var(--panel); border-radius: 8px; padding: 7px; border-top-color: transparent; }
  .choose { flex: 1; border: 0; background: transparent; color: inherit; text-align: left; display: grid; gap: 2px; cursor: pointer; padding: 2px; }
  .reason { font-size: 0.78rem; font-weight: 700; }
  .muted { color: var(--muted); }
  .small { font-size: 0.88rem; }
  .tiny { font-size: 0.76rem; }
  .compact { padding: 5px 8px; white-space: nowrap; }
  .error-text { color: var(--danger); margin: 0; }
  @media (max-width: 700px) { .picker-head, .search-row, .selected-row, .suggestion-row { align-items: stretch; flex-direction: column; } }
</style>
