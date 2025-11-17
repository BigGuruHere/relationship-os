<!-- src/routes/contacts/[id]/+page.svelte -->
<script lang="ts">
  export let data: {
    contact: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      position: string | null;
      linkedin: string | null;
      createdAt: string | Date;
      tags?: { name: string; slug: string }[];
    };
    relationships?: Array<{
      id: string;
      otherContactId: string;
      otherContactName: string;
      type: string | null;
      label: string;
      isDirectional: boolean;
      direction: 'incoming' | 'outgoing';
    }>;
    contactOptions?: Array<{ id: string; name: string }>;
    interactions?: any[];
    reminders?: any[];
  };

  // IT: safe fallbacks
  const contact = data?.contact ?? null;
  const tags = contact?.tags ?? [];
  const interactions = data?.interactions ?? [];
  const relationships = data?.relationships ?? [];
  const contactOptions = data?.contactOptions ?? [];

  // IT: UI state
  let showCadenceEditor = false;
  let showReminderPanel = false;
  let showAddRelationship = false; // NEW

  function fmt(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString();
  }

  function getVcardUrl() {
    if (!contact) return '';
    const params = new URLSearchParams();
    params.set('name', contact.name || 'Contact');
    if (contact.company) params.set('org', contact.company);
    if (contact.position) params.set('title', contact.position);
    if (contact.email) params.set('email', contact.email);
    if (contact.phone) params.set('phone', contact.phone);
    if (contact.linkedin) params.set('link', contact.linkedin);
    return `/api/vcard?${params.toString()}`;
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
    <div class="card" style="padding:20px; max-width:820px; margin:auto;">

      <!-- Title row with Edit and Download vCard buttons -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <h1 style="margin-top:0;">{contact.name}</h1>
        
<!-- IT: action buttons row -->
<div style="display:flex; gap:8px; align-items:center;">

  <!-- IT: download vCard button -->
  <a
    class="btn"
    href={getVcardUrl()}
    download
    aria-label="Download vCard"
    title="Download vCard"
    style="display:inline-flex;align-items:center;justify-content:center;padding:8px 10px;"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7z" fill="currentColor" />
      <path d="M5 18v2h14v-2H5z" fill="currentColor" />
    </svg>
  </a>

  <!-- IT: edit contact button -->
  <a
    class="btn"
    href={"/contacts/" + data.contact.id + "/edit"}
    aria-label="Edit contact"
    title="Edit contact"
    style="display:inline-flex;align-items:center;justify-content:center;padding:8px 10px;"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
      <path d="M20.71 7.04c.39-.39.39-1.03 0-1.42l-2.34-2.34c-.39-.39-1.03-.39-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor" />
    </svg>
  </a>

</div>

      </div>

      <!-- Cadence and Reminders pills -->
      <div style="padding-bottom:5px;">
        <button
          type="button"
          class="btn"
          on:click={() => (showCadenceEditor = !showCadenceEditor)}
        >
          {#if data.contact.reconnectEveryDays}
            Cadence Every {data.contact.reconnectEveryDays} day{data.contact.reconnectEveryDays === 1 ? '' : 's'}
          {:else}
            No cadence
          {/if}
        </button>

        <button
          type="button"
          class="btn"
          on:click={() => (showReminderPanel = !showReminderPanel)}
        >
          {#if (data.reminders?.length || 0) > 0}
            {data.reminders.length} open reminder{data.reminders.length === 1 ? '' : 's'}
          {:else}
            No open reminders
          {/if}
        </button>

        <form method="post" action="?/markContactedToday" style="display:inline;">
          <button class="btn" title="Set last contacted to now">Mark contacted today</button>
        </form>
      </div>

      <!-- Cadence editor (existing) -->
      {#if showCadenceEditor}
        <div id="cadence-editor" style="margin-top:10px;">
          <!-- ... existing cadence editor code ... -->
        </div>
      {/if}

      <!-- Reminder panel (existing) -->
      {#if showReminderPanel}
        <div id="reminder-panel" style="margin-top:10px;">
          <!-- ... existing reminder panel code ... -->
        </div>
      {/if}
    </div>

    <!-- Contact details -->
    <div style="margin-top:12px;margin-left:12px">
      <div class="grid">
        <div><strong>Email</strong></div>
        <div>{contact.email ?? ' - '}</div>

        <div><strong>Phone</strong></div>
        <div>{contact.phone ?? ' - '}</div>

        <div><strong>Company</strong></div>
        <div>{contact.company ?? ' - '}</div>

        <div><strong>Position</strong></div>
        <div>{contact.position ?? ' - '}</div>

        <div><strong>LinkedIn</strong></div>
        <div>{contact.linkedin ?? ' - '}</div>

        <div><strong>Created</strong></div>
        <div>{fmt(contact.createdAt)}</div>
      </div>

      <!-- Tags section (existing) -->
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

      <!-- NEW: Relationships section -->
      <div style="margin-top:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>Connections</strong>
          <button
            type="button"
            class="btn"
            on:click={() => (showAddRelationship = !showAddRelationship)}
          >
            {showAddRelationship ? 'Cancel' : 'Add Connection'}
          </button>
        </div>

        {#if showAddRelationship}
          <form method="post" action="?/addRelationship" class="card" style="padding:12px; margin-bottom:12px;">
            <div class="field">
              <label for="otherContactId">Connect to</label>
              <select id="otherContactId" name="otherContactId" required>
                <option value="">Select contact...</option>
                {#each contactOptions as opt}
                  <option value={opt.id}>{opt.name}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="label">Relationship (optional)</label>
              <input
                id="label"
                name="label"
                placeholder="e.g., colleague, friend, spouse"
              />
            </div>

            <button class="btn primary" type="submit">Add Connection</button>
          </form>
        {/if}

        {#if relationships.length === 0}
          <p class="muted">No connections yet.</p>
        {:else}
          <ul style="list-style:none; padding:0; margin:0;">
            {#each relationships as rel}
              <li class="card" style="padding:10px; margin:6px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <a href={"/contacts/" + rel.otherContactId} class="link" style="font-weight:600;">
                    {rel.otherContactName}
                  </a>
                  <span class="muted" style="margin-left:8px; font-size:0.9rem;">
                    ({rel.label})
                  </span>
                </div>

                <form method="post" action="?/removeRelationship" style="display:inline;">
                  <input type="hidden" name="relationshipId" value={rel.id} />
                  <button class="btn" type="submit" title="Remove connection">
                    Remove
                  </button>
                </form>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Recent notes list (existing) -->
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
  .container { padding: 12px; }
  .grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; margin-bottom: 8px; }
  .muted { color: var(--muted); }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
  }
  .btn:hover { background: var(--panel); }
  .btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(0.95); }
  .muted { color: var(--muted); }
  .field { margin-bottom: 12px; }
  label { display: block; margin-bottom: 6px; color: var(--muted); }
  input, select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
</style>