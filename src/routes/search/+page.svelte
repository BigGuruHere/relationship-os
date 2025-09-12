<script lang="ts">
    // PURPOSE: Search UI. Submits to server, shows ranked results.
    export let data;
    export let form;
  
  </script>
  
  <div class="container">
    <div class="card" style="padding:18px;">
      <form method="post" action="?/search" style="display:flex; gap:8px; align-items:center;">
        <input
          name="q"
          placeholder="Search people or notes... try fundraising in March"
          value={data.q}
          aria-label="Search"
        />
        <button class="btn primary">Search</button>
      </form>
    </div>
  
    <div class="card" style="padding:18px; margin-top:14px;">
      <h2 style="margin:0 0 10px;">Results</h2>
  
      {#if !data.q}
        <p style="color:var(--muted);">Type a query above to search your memory.</p>
      {:else if data.results.length === 0}
        <p>No results for <strong>{data.q}</strong>.</p>
        <p style="color:var(--muted); font-size:0.95rem;">Tip: try a broader phrase like investor update or parenting or skiing.</p>
      {:else}
        <ul style="list-style:none; padding:0; margin:0; display:grid; gap:12px;">
          {#each data.results as r}
            <li class="card" style="padding:14px;">
              <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                <div>
                  <a class="btn" href={"/contacts/" + r.contactId} title="Open contact">{r.contactName}</a>
                  <small style="color:var(--muted); margin-left:8px;">
                    {new Date(r.occurredAt).toLocaleString()} - {r.channel}
                  </small>
                </div>
                <a class="btn" href={"/contacts/" + r.contactId + "/interactions/" + r.id} title="Open note">Open note</a>
              </div>
  
              {#if r.summary}
                <div style="margin-top:10px;">
                  <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">{r.summary}</pre>
                </div>
              {/if}
  
              <!-- tags as chips -->
              <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                {#if r.tags.length === 0}
                  <span style="color:var(--muted);">No tags</span>
                {:else}
                  {#each r.tags as t}
                    <span class="btn" style="padding:6px 10px; cursor:default;">#{t.name}</span>
                  {/each}
                {/if}
              </div>
  
              <!-- score for debugging relevance -->
              <div style="margin-top:8px; color:var(--muted); font-size:0.9rem;">
                score: {r.score.toFixed(4)}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  