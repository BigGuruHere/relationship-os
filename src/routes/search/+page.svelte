<!-- src/routes/search/+page.svelte -->
<script lang="ts">
  // PURPOSE: Simple semantic search UI - GET form, list results, no diagnostics.
  export let data: {
    q: string;
    results: Array<{
      id: string;
      contactId: string;
      contactName: string;
      channel: string;
      occurredAt: string | Date | null;
      score: number;
      preview: string;
    }>;
  };

  // Format timestamp safely for display.
  function fmt(d: string | Date | null) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString();
  }
</script>

<div class="container">
  <!-- Page header -->
  <div class="card" style="padding:20px; margin-bottom:20px;">
    <h1 style="margin:0; font-size:1.8rem; font-weight:600;">Search Notes</h1>
  </div>

  <!-- Search form -->
  <div class="card" style="padding:16px; margin-bottom:16px;">
    <!-- GET keeps q in the URL so server load reads it reliably -->
    <form method="get" style="display:flex; gap:10px; align-items:center;">
      <input
        name="q"
        value={data.q}
        placeholder="Search your notes - try a word or a phrase"
        aria-label="Search notes"
      />
      <button class="btn primary" type="submit">Search</button>
    </form>
  </div>

  {#if data.q && data.results.length === 0}
    <div class="card" style="padding:16px; margin-bottom:16px;">
      <h3 style="margin-top:0;">No results for {data.q}.</h3>
      <p class="muted" style="margin:8px 0 0;">Try a longer phrase for a stronger match.</p>
    </div>
  {/if}

  {#if data.results.length > 0}
    <div class="card" style="padding:16px;">
      <h3 style="margin-top:0;">Results</h3>
      <ul style="list-style:none; margin:0; padding:0; display:grid; gap:12px;">
        {#each data.results as r}
          <li class="card" style="padding:12px;">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:baseline;">
              <div>
                <a href={`/contacts/${r.contactId}/interactions/${r.id}`} class="note-link">
                  <strong>{r.contactName}</strong>
                </a>
                <span class="pill" style="margin-left:8px;">{r.channel}</span>
                <span class="muted" style="margin-left:8px;">{fmt(r.occurredAt)}</span>
              </div>
              <!-- keep score visible for a bit while validating - easy to remove later -->
              <div class="pill" title="Cosine similarity score">score {r.score.toFixed(3)}</div>
            </div>
            <div style="margin-top:8px;">
              <span class="muted">{r.preview}</span>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  /* local helpers that align with your theme tokens */
  .muted { color: var(--muted); }
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--muted);
    font-size: 12px;
  }
  .note-link { color: var(--text); text-decoration: none; }
  .note-link:hover { text-decoration: underline; }
</style>
