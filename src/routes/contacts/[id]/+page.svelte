<!-- src/routes/contacts/[id]/+page.svelte -->
<script lang="ts">
  // Page data comes from +page.server.ts. We guard all optional fields.
  export let data: {
    contact?: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      createdAt: string | Date;
      tags?: { name: string; slug: string }[];
    };
    interactions?: {
      id: string;
      channel: string;
      occurredAt: string | Date | null;
      preview: string;
      tags: { name: string; slug: string }[];
    }[];
  };

  // Safe fallbacks so template never hits undefined.length
  const contact = data?.contact ?? null;
  const tags = contact?.tags ?? [];
  const interactions = data?.interactions ?? [];
  let showCadenceEditor = false;


  // Simple date formatting helper
  function fmt(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString();
  }
</script>

{#if !contact}
  <div class="container">
    <div class="card" style="padding:20px; max-width:680px; margin:0 auto;">
      <h1 style="margin-top:0;">Contact not found</h1>
      <p>Head back to the <a href="/">home page</a>.</p>
    </div>
  </div>
{:else}
  <div class="container">
    <div class="card" style="padding:20px; max-width:820px; margin:0 auto;">
      <h1 style="margin-top:0;">{contact.name}</h1>





      <div style="padding-bottom:20px;">

    <!-- Header row with a small pill that shows current cadence - click to expand -->

      <button
        type="button"
        class="btn"
        on:click={() => (showCadenceEditor = !showCadenceEditor)}
        aria-expanded={showCadenceEditor}
        aria-controls="cadence-editor"
        title="Edit cadence"
      >
        {#if data.contact.reconnectEveryDays}
          Every {data.contact.reconnectEveryDays} day{data.contact.reconnectEveryDays === 1 ? '' : 's'}
        {:else}
          No cadence
        {/if}
      </button>

      <!-- IT: quick action to mark as contacted today - posts to ?/markContactedToday -->
<form method="post" action="?/markContactedToday" style="display:inline;">
  <button class="btn" title="Set last contacted to now">Mark contacted today</button>
</form>


  
    {#if showCadenceEditor}
      <div id="cadence-editor" style="margin-top:10px;">
        <p class="muted" style="margin:0 0 8px 0;">
          Set how often you want to reconnect with this contact. Leave empty to clear.
        </p>
  
        <!-- IT: set or clear cadence - posts to ?/setCadence -->
        <form method="post" action="?/setCadence" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label for="cadenceDays" style="min-width:120px;">Every N days</label>
          <input
            id="cadenceDays"
            name="days"
            type="number"
            min="1"
            max="3650"
            placeholder="e.g. 60"
            value={data.contact.reconnectEveryDays ?? ''}
            style="width:120px;"
          />
          <button class="btn primary">Save</button>
          <button class="btn" name="days" value="" title="Clear cadence">Clear</button>
          <button type="button" class="btn" on:click={() => (showCadenceEditor = false)}>Close</button>
        </form>
      </div>
    {/if}
  </div>

  


      <div class="grid">
        <div><strong>Email</strong></div>
        <div>{contact.email ?? ' - '}</div>

        <div><strong>Phone</strong></div>
        <div>{contact.phone ?? ' - '}</div>

        <div><strong>Created</strong></div>
        <div>{fmt(contact.createdAt)}</div>
      </div>

      <!-- Tags section - styling comes from app.css -->
      <div style="margin-top:12px;">
        <strong>Tags</strong>
        {#if tags.length > 0}
          <div class="tag-row">
            {#each tags as t}
              <form method="post" action="?/removeTag">
                <input type="hidden" name="slug" value={t.slug} />
                <button class="chip" title="Remove tag">
                  <span class="chip-text">{t.name}</span>
                  <span class="chip-x" aria-hidden="true">×</span>
                </button>
              </form>
            {/each}
          </div>
        {:else}
          <p class="muted" style="margin-top:8px;">No tags yet.</p>
        {/if}

        <!-- Add tag -->
        <form method="post" action="?/addTag" class="tag-add" style="margin-top:10px; display:flex; gap:8px;">
          <input
            name="name"
            placeholder="Add a tag"
            aria-label="Tag name"
            required
            style="flex:1; padding:8px; border:1px solid var(--border); border-radius:8px;"
          />
          <button class="btn primary" type="submit">Add</button>
        </form>
      </div>

      <!-- Recent notes list - also styled by app.css -->
      <div style="margin-top:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>Recent notes</strong>
          <a class="btn" href={`/contacts/${contact.id}/interactions/new`}>New note</a>
        </div>

        {#if interactions.length === 0}
          <p class="muted" style="margin-top:8px;">No notes yet. Add the first one.</p>
        {:else}
          <ul class="notes">
            {#each interactions as n}
              <li class="note">
                <div class="note-meta">
                  <span class="pill">{n.channel}</span>
                  <span class="muted">{fmt(n.occurredAt)}</span>
                </div>
                <a class="note-link" href={`/contacts/${contact.id}/interactions/${n.id}`}>
                  {n.preview || '(empty)'}
                </a>
                {#if n.tags.length > 0}
                  <div class="tag-row small" style="margin-top:6px;">
                    {#each n.tags as t}
                      <span class="chip chip-static">
                        <span class="chip-text">{t.name}</span>
                      </span>
                    {/each}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div style="display:flex; gap:10px; margin-top:16px;">
        <a class="btn" href="/">Back</a>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Layout helpers - no colors set here so theme controls them */
  .container { padding: 12px; }
  .grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; margin-bottom: 8px; }
  .muted { color: var(--muted-foreground, #666); }
  .btn {
    display: inline-block;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border, #ddd);
    text-decoration: none;
    background: transparent;
    color: inherit;
  }
  .btn.primary {
    border-color: transparent;
    background: var(--primary, #111);
    color: #fff;
  }

  /* reuse your existing btn styles - this tweaks size to stay compact */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
  }
  .btn:hover { background: var(--surface-3); }
  .btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(0.95); }
  .muted { color: var(--muted); }
</style>
