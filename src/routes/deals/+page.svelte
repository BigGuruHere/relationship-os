<!-- src/routes/deals/+page.svelte -->
<script lang="ts">
  // PURPOSE: List and filter relationship-driven deals.
  // SECURITY: This page renders only server-prepared display values.
  export let data: {
    q: string;
    selectedStatus: string;
    statusOptions: Array<{ value: string; label: string }>;
    summary: { total: number; open: number; won: number; lost: number };
    deals: Array<{
      id: string;
      title: string;
      preview: string;
      valueLabel: string;
      weightedValueLabel: string;
      status: string;
      statusLabel: string;
      probability: number | null;
      expectedCloseDate: string | Date | null;
      updatedAt: string | Date;
      contacts: Array<{ contactId: string; name: string; label: string; isPrimary: boolean }>;
    }>;
  };

  let q = data.q || '';
  let status = data.selectedStatus || '';

  function fmtDate(value: string | Date | null | undefined) {
    if (!value) return 'No close date';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'No close date';
    return date.toLocaleDateString();
  }
</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Relationship pipeline</div>
      <h1>Deals</h1>
      <p class="muted">Track opportunities that come from people, introductions, and relationships.</p>
    </div>
    <a class="btn primary" href="/deals/new">＋ New deal</a>
  </div>

  <div class="summary-grid">
    <div class="card stat"><span>Total</span><strong>{data.summary.total}</strong></div>
    <div class="card stat"><span>Open</span><strong>{data.summary.open}</strong></div>
    <div class="card stat"><span>Won</span><strong>{data.summary.won}</strong></div>
    <div class="card stat"><span>Lost</span><strong>{data.summary.lost}</strong></div>
  </div>

  <div class="card filters">
    <form method="GET" class="filter-row">
      <input name="q" bind:value={q} placeholder="Search deal title or notes" aria-label="Search deals" />
      <select name="status" bind:value={status} aria-label="Deal status">
        <option value="">All states</option>
        {#each data.statusOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <button class="btn primary" type="submit">Explore</button>
    </form>
  </div>

  {#if data.deals.length === 0}
    <div class="card empty">
      <div class="deal-icon" aria-hidden="true">◆</div>
      <h2>No deals yet</h2>
      <p class="muted">Create a deal, then attach the people involved and the role they play.</p>
      <a class="btn primary" href="/deals/new">Create first deal</a>
    </div>
  {:else}
    <div class="deal-list">
      {#each data.deals as deal}
        <a class="card deal-card" href={`/deals/${deal.id}`}>
          <div class="deal-topline">
            <div class="deal-title-row">
              <span class="deal-icon" aria-hidden="true">◆</span>
              <h2>{deal.title}</h2>
            </div>
            <span class="status-chip">{deal.statusLabel}</span>
          </div>

          {#if deal.preview}
            <p class="preview">{deal.preview}</p>
          {/if}

          <div class="deal-meta">
            <span>{deal.valueLabel}</span>
            <span>{deal.probability === null ? 'No probability' : `${deal.probability}% chance`}</span>
            <span>{deal.weightedValueLabel}</span>
            <span>{fmtDate(deal.expectedCloseDate)}</span>
          </div>

          {#if deal.contacts.length > 0}
            <div class="people-row">
              {#each deal.contacts.slice(0, 4) as person}
                <span class="chip chip-static">{person.name}{person.label ? `: ${person.label}` : ''}</span>
              {/each}
              {#if deal.contacts.length > 4}
                <span class="chip chip-static">+{deal.contacts.length - 4} more</span>
              {/if}
            </div>
          {:else}
            <div class="muted small">No relationships attached yet.</div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 14px;
  }
  h1 { margin: 0; }
  h2 { margin: 0; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat span { color: var(--muted); font-size: 0.9rem; }
  .stat strong { font-size: 1.5rem; }
  .filters { padding: 12px; margin-bottom: 14px; }
  .filter-row { display: flex; gap: 8px; align-items: center; }
  .filter-row input { flex: 1 1 auto; }
  .filter-row select { flex: 0 0 180px; }
  .deal-list { display: grid; gap: 10px; }
  .deal-card { display: block; padding: 14px; color: var(--text); text-decoration: none; }
  .deal-card:hover { text-decoration: none; border-color: var(--accent); }
  .deal-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .deal-title-row { display: flex; align-items: center; gap: 10px; }
  .deal-icon { color: var(--accent-2); font-size: 1.1rem; line-height: 1; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; white-space: nowrap; }
  .preview { color: var(--muted); margin: 8px 0; }
  .deal-meta, .people-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
  .deal-meta span { color: var(--muted); font-size: 0.9rem; }
  .empty { padding: 28px; text-align: center; display: grid; gap: 8px; justify-items: center; }
  @media (max-width: 720px) {
    .page-head, .filter-row { flex-direction: column; align-items: stretch; }
    .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .filter-row select { flex-basis: auto; }
  }
</style>
