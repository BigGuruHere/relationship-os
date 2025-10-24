<script lang="ts">
  // src/routes/search/+page.svelte
  // PURPOSE: Render a scoped search UI and results.
  // SECURITY: No decryption in the client - server returns safe display strings only.

  // SvelteKit provides data from +page.server.ts
  export let data: {
    q: string;
    scope: 'all' | 'contacts' | 'notes' | 'tags';
    results: {
      contacts: Array<{ id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[] }>;
      notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: string | Date; preview: string }>;
      tags: Array<{ id: string; name: string; contactCount: number }>;
    };
  };

  // IT: local bindings for the form controls - initialized from server data so the UI reflects the URL
  let q = data.q || '';
  let scope: 'all' | 'contacts' | 'notes' | 'tags' = (data.scope || 'all') as any;

  // IT: submit handler - we use plain GET so the URL is shareable - no work needed here
  function submit(_evt: Event) {}
</script>

<div class="container">
  <div class="card" style="padding:16px; margin-bottom:12px;">
    <!-- Search controls row - input grows, dropdown has a max width, button is content sized -->
    <form method="GET" on:submit={submit} class="search-bar">
      <input
        type="text"
        name="q"
        bind:value={q}
        placeholder="Search notes, contacts, or tags"
        class="search-input"
        aria-label="Search query"
      />

<!-- PURPOSE: Add a Company-only scope option -->
<select
  name="scope"
  bind:value={scope}
  aria-label="Search scope"
  title="Search scope"
  class="scope-select"
>
  <option value="all">All</option>
  <option value="contacts">Contacts</option>
  <option value="notes">Notes</option>
  <option value="tags">Tags</option>
  <option value="company">Company</option> <!-- IT: new option -->
</select>


      <button class="btn primary" type="submit">Search</button>
    </form>
  </div>

  {#if data.q}
    {#if data.scope === 'all'}
      {#if data.results.contacts.length}
        <h3 style="margin:12px 0 6px 0;">Contacts ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card" style="padding:10px; margin:6px 0;">
            <a href={"/contacts/" + c.id} class="link" style="font-weight:600;">{c.name}</a>
            {#if c.company}<div style="color:#666;">{c.company}</div>{/if}
            <div style="color:#666; font-size:0.9rem;">
              {#if c.email}{c.email}{/if}{#if c.email && c.phone} · {/if}{#if c.phone}{c.phone}{/if}
            </div>
            {#if c.tags.length > 0}
              <div class="tag-row small" style="margin-top:6px;">
                {#each c.tags as t}
                  <span class="chip chip-static"><span class="chip-text">{t.name}</span></span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      {#if data.results.notes.length}
        <h3 style="margin:12px 0 6px 0;">Notes ({data.results.notes.length})</h3>
        {#each data.results.notes as n}
          <div class="card" style="padding:10px; margin:6px 0;">
            <a href={"/contacts/" + n.contactId} class="link" style="font-weight:600;">{n.contactName}</a>
            <div style="color:#666; font-size:0.9rem;">{new Date(n.occurredAt).toLocaleDateString()}</div>
            <div style="margin-top:6px;">{n.preview}</div>
          </div>
        {/each}
      {/if}

      {#if data.results.tags.length}
        <h3 style="margin:12px 0 6px 0;">Tags ({data.results.tags.length})</h3>
        {#each data.results.tags as t}
          <div class="card" style="padding:10px; margin:6px 0;">
            <div style="font-weight:600;">{t.name}</div>
            <div style="color:#666; font-size:0.9rem;">{t.contactCount} contact{t.contactCount === 1 ? '' : 's'}</div>
          </div>
        {/each}
      {/if}

      {#if !data.results.contacts.length && !data.results.notes.length && !data.results.tags.length}
        <div style="color:#666;">No results - try another term or switch scope.</div>
      {/if}
      {:else if data.scope === 'company'}
      {#if data.results.contacts.length}
        <h3 style="margin:12px 0 6px 0;">Company matches ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card" style="padding:10px; margin:6px 0;">
            <a href={"/contacts/" + c.id} class="link" style="font-weight:600;">{c.name}</a>
            {#if c.company}
              <div style="color:#666;">Company: {c.company}</div>
            {/if}
            <div style="color:#666; font-size:0.9rem;">
              {#if c.email}{c.email}{/if}{#if c.email && c.phone} · {/if}{#if c.phone}{c.phone}{/if}
            </div>
            {#if c.tags.length > 0}
              <div class="tag-row small" style="margin-top:6px;">
                {#each c.tags as t}
                  <span class="chip chip-static"><span class="chip-text">{t.name}</span></span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <div style="color:#666;">No companies found.</div>
      {/if}
  
  
    {:else if data.scope === 'contacts'}
      {#if data.results.contacts.length}
        <h3 style="margin:12px 0 6px 0;">Contacts ({data.results.contacts.length})</h3>
        {#each data.results.contacts as c}
          <div class="card" style="padding:10px; margin:6px 0;">
            <a href={"/contacts/" + c.id} class="link" style="font-weight:600;">{c.name}</a>
            {#if c.company}<div style="color:#666;">{c.company}</div>{/if}
            <div style="color:#666; font-size:0.9rem;">
              {#if c.email}{c.email}{/if}{#if c.email && c.phone} · {/if}{#if c.phone}{c.phone}{/if}
            </div>
            {#if c.tags.length > 0}
              <div class="tag-row small" style="margin-top:6px;">
                {#each c.tags as t}
                  <span class="chip chip-static"><span class="chip-text">{t.name}</span></span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <div style="color:#666;">No contacts found.</div>
      {/if}
    {:else if data.scope === 'notes'}
      {#if data.results.notes.length}
        <h3 style="margin:12px 0 6px 0;">Notes ({data.results.notes.length})</h3>
        {#each data.results.notes as n}
          <div class="card" style="padding:10px; margin:6px 0;">
            <a href={"/contacts/" + n.contactId} class="link" style="font-weight:600;">{n.contactName}</a>
            <div style="color:#666; font-size:0.9rem;">{new Date(n.occurredAt).toLocaleDateString()}</div>
            <div style="margin-top:6px;">{n.preview}</div>
          </div>
        {/each}
      {:else}
        <div style="color:#666;">No notes found.</div>
      {/if}
    {:else if data.scope === 'tags'}
      {#if data.results.tags.length}
        <h3 style="margin:12px 0 6px 0;">Tags ({data.results.tags.length})</h3>
        {#each data.results.tags as t}
          <div class="card" style="padding:10px; margin:6px 0;">
            <div style="font-weight:600;">{t.name}</div>
            <div style="color:#666; font-size:0.9rem;">{t.contactCount} contact{t.contactCount === 1 ? '' : 's'}</div>
          </div>
        {/each}
      {:else}
        <div style="color:#666;">No tags found.</div>
      {/if}
    
      {/if}
  {/if}
</div>

<style>
  /* IT: horizontal layout with gaps - input flexes, others size to content */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* IT: input takes remaining space */
  .search-input {
    flex: 1 1 auto;                 /* grow to fill rest of the row */
    min-width: 160px;               /* do not get too tiny on narrow screens */
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
  }

  /* IT: scope dropdown has a cap so it never eats the row */
  .scope-select {
    flex: 0 0 auto;                 /* do not grow */
    max-width: 180px;               /* cap width - tweak to taste */
    width: 100%;                    /* allow smaller on narrow screens */
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
  }

  /* Optional - keep button from shrinking too much */
  .btn.primary {
    flex: 0 0 auto;
  }

  /* Mobile polish - wrap if space is too tight */
  @media (max-width: 420px) {
    .search-bar {
      flex-wrap: wrap;              /* wrap to next line if needed */
    }
    .scope-select {
      max-width: 48%;               /* keep reasonable width when wrapped */
    }
    .btn.primary {
      width: auto;
    }
  }
</style>
