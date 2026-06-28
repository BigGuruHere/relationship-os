<script lang="ts">
  // src/routes/search/+page.svelte
  // PURPOSE: Render a scoped search UI and results.
  // SECURITY: No decryption in the client.

  export let data: {
    q: string;
    scope: 'all' | 'contacts' | 'notes' | 'tags' | 'company' | 'deals';
    results: {
      contacts: Array<{ id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[] }>;
      notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: string | Date; preview: string }>;
      tags: Array<{ id: string; name: string; contactCount: number }>;
      deals: Array<{ id: string; title: string; statusLabel: string; valueLabel: string; probability: number | null; preview: string }>;
    };
  };

  let q = data.q || '';
  let scope: 'all' | 'contacts' | 'notes' | 'tags' | 'company' | 'deals' = data.scope || 'all';
</script>

<div class="container">
  <div class="card" style="padding:16px; margin-bottom:12px;">
    <form method="GET" class="search-bar">
      <input type="text" name="q" bind:value={q} placeholder="Search notes, contacts, tags, or deals" class="search-input" aria-label="Search query" />
      <select name="scope" bind:value={scope} aria-label="Search scope" title="Search scope" class="scope-select">
        <option value="all">All</option>
        <option value="contacts">Contacts</option>
        <option value="notes">Notes</option>
        <option value="tags">Tags</option>
        <option value="company">Company</option>
        <option value="deals">Deals</option>
      </select>
      <button class="btn primary" type="submit">Search</button>
    </form>
  </div>

  {#if data.q}
    {#if data.scope === 'all'}
      {#if data.results.deals.length}
        <h3>Deals ({data.results.deals.length})</h3>
        {#each data.results.deals as d}
          <div class="card result-card">
            <a href={`/deals/${d.id}`} class="link strong">◆ {d.title}</a>
            <div class="muted small">{d.statusLabel} - {d.valueLabel}{d.probability === null ? '' : ` - ${d.probability}% chance`}</div>
            {#if d.preview}<div style="margin-top:6px;">{d.preview}</div>{/if}
          </div>
        {/each}
      {/if}

      {#if data.results.contacts.length}
        <h3>Contacts ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card result-card">
            <a href={`/contacts/${c.id}`} class="link strong">{c.name}</a>
            {#if c.company}<div class="muted">{c.company}</div>{/if}
            <div class="muted small">{#if c.email}{c.email}{/if}{#if c.email && c.phone} · {/if}{#if c.phone}{c.phone}{/if}</div>
            {#if c.tags.length > 0}
              <div class="tag-row small" style="margin-top:6px;">
                {#each c.tags as t}<span class="chip chip-static"><span class="chip-text">{t.name}</span></span>{/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      {#if data.results.notes.length}
        <h3>Notes ({data.results.notes.length})</h3>
        {#each data.results.notes as n}
          <div class="card result-card">
            <a href={`/contacts/${n.contactId}`} class="link strong">{n.contactName}</a>
            <div class="muted small">{new Date(n.occurredAt).toLocaleDateString()}</div>
            <div style="margin-top:6px;">{n.preview}</div>
          </div>
        {/each}
      {/if}

      {#if data.results.tags.length}
        <h3>Tags ({data.results.tags.length})</h3>
        {#each data.results.tags as t}
          <div class="card result-card">
            <div class="strong">{t.name}</div>
            <div class="muted small">{t.contactCount} contact{t.contactCount === 1 ? '' : 's'}</div>
          </div>
        {/each}
      {/if}

      {#if !data.results.contacts.length && !data.results.notes.length && !data.results.tags.length && !data.results.deals.length}
        <div class="muted">No results - try another term or switch scope.</div>
      {/if}
    {:else if data.scope === 'deals'}
      {#if data.results.deals.length}
        <h3>Deals ({data.results.deals.length})</h3>
        {#each data.results.deals as d}
          <div class="card result-card">
            <a href={`/deals/${d.id}`} class="link strong">◆ {d.title}</a>
            <div class="muted small">{d.statusLabel} - {d.valueLabel}{d.probability === null ? '' : ` - ${d.probability}% chance`}</div>
            {#if d.preview}<div style="margin-top:6px;">{d.preview}</div>{/if}
          </div>
        {/each}
      {:else}
        <div class="muted">No deals found.</div>
      {/if}
    {:else if data.scope === 'company'}
      {#if data.results.contacts.length}
        <h3>Company matches ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card result-card">
            <a href={`/contacts/${c.id}`} class="link strong">{c.name}</a>
            {#if c.company}<div class="muted">Company: {c.company}</div>{/if}
          </div>
        {/each}
      {:else}
        <div class="muted">No companies found.</div>
      {/if}
    {:else if data.scope === 'contacts'}
      {#if data.results.contacts.length}
        <h3>Contacts ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card result-card">
            <a href={`/contacts/${c.id}`} class="link strong">{c.name}</a>
            {#if c.company}<div class="muted">{c.company}</div>{/if}
            <div class="muted small">{#if c.email}{c.email}{/if}{#if c.email && c.phone} · {/if}{#if c.phone}{c.phone}{/if}</div>
          </div>
        {/each}
      {:else}
        <div class="muted">No contacts found.</div>
      {/if}
    {:else if data.scope === 'notes'}
      {#if data.results.notes.length}
        <h3>Notes ({data.results.notes.length})</h3>
        {#each data.results.notes as n}
          <div class="card result-card">
            <a href={`/contacts/${n.contactId}`} class="link strong">{n.contactName}</a>
            <div class="muted small">{new Date(n.occurredAt).toLocaleDateString()}</div>
            <div style="margin-top:6px;">{n.preview}</div>
          </div>
        {/each}
      {:else}
        <div class="muted">No notes found.</div>
      {/if}
    {:else if data.scope === 'tags'}
      {#if data.results.tags.length}
        <h3>Tags ({data.results.tags.length})</h3>
        {#each data.results.tags as t}
          <div class="card result-card">
            <div class="strong">{t.name}</div>
            <div class="muted small">{t.contactCount} contact{t.contactCount === 1 ? '' : 's'}</div>
          </div>
        {/each}
      {:else}
        <div class="muted">No tags found.</div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .search-bar { display: flex; align-items: center; gap: 8px; }
  .search-input { flex: 1 1 auto; min-width: 160px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 10px; }
  .scope-select { flex: 0 0 auto; max-width: 180px; width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 10px; background: #fff; }
  .result-card { padding: 10px; margin: 6px 0; }
  .strong { font-weight: 700; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  @media (max-width: 520px) {
    .search-bar { flex-wrap: wrap; }
    .scope-select { max-width: 48%; }
  }
</style>
