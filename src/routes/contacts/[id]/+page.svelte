<!-- src/routes/contacts/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show a contact with tags, relationships, deals, reminders, and notes.
  // SECURITY: Data has already been decrypted server side where needed.
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
      reconnectEveryDays?: number | null;
      lastContactedAt?: string | Date | null;
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
    deals?: Array<{
      id: string;
      linkId: string;
      title: string;
      statusLabel: string;
      probability: number | null;
      valueLabel: string;
      expectedCloseDate: string | Date | null;
      relationshipLabel: string;
      notes: string;
      isPrimary: boolean;
    }>;
    dealOptions?: Array<{ id: string; title: string; statusLabel: string }>;
    dealRelationshipOptions?: Array<{ value: string; label: string }>;
    interactions?: any[];
    dealNotes?: Array<{
      id: string;
      channel: string;
      occurredAt: string | Date;
      preview: string;
      dealId: string;
      dealTitle: string;
      dealStatusLabel: string;
    }>;
    reminders?: any[];
  };

  const contact = data?.contact ?? null;
  const tags = contact?.tags ?? [];
  const interactions = data?.interactions ?? [];
  const dealNotes = data?.dealNotes ?? [];
  const reminders = data?.reminders ?? [];
  const relationships = data?.relationships ?? [];
  const contactOptions = data?.contactOptions ?? [];
  const deals = data?.deals ?? [];
  const dealOptions = data?.dealOptions ?? [];
  const dealRelationshipOptions = data?.dealRelationshipOptions ?? [];

  let showCadenceEditor = false;
  let showReminderPanel = false;
  let showAddRelationship = false;
  let showAddDeal = false;

  function fmt(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
  }

  function fmtDate(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString();
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
    <div class="card hero-card">
      <div class="title-row">
        <div>
          <div class="eyebrow">Contact</div>
          <h1>{contact.name}</h1>
        </div>
        <div class="action-row">
          <a class="btn primary" href={`/contacts/${contact.id}/interactions/new`}>Add voice/note</a>
          <a class="btn" href={getVcardUrl()} download aria-label="Download vCard" title="Download vCard">vCard</a>
          <a class="btn" href={`/contacts/${contact.id}/edit`} aria-label="Edit contact" title="Edit contact">Edit</a>
        </div>
      </div>

      <div class="quick-row">
        <button type="button" class="btn" on:click={() => (showCadenceEditor = !showCadenceEditor)}>
          {#if contact.reconnectEveryDays}
            Edit cadence - every {contact.reconnectEveryDays} day{contact.reconnectEveryDays === 1 ? '' : 's'}
          {:else}
            Add cadence
          {/if}
        </button>

        <button type="button" class="btn" on:click={() => (showReminderPanel = !showReminderPanel)}>
          {#if reminders.length > 0}
            {reminders.length} open reminder{reminders.length === 1 ? '' : 's'}
          {:else}
            No open reminders
          {/if}
        </button>

        <form method="post" action="?/markContactedToday" style="display:inline;">
          <button class="btn" title="Set last contacted to now">Mark contacted today</button>
        </form>
      </div>

      <div class="cadence-strip">
        <div>
          <strong>Relationship cadence</strong>
          <div class="muted small">
            {#if contact.reconnectEveryDays}
              Reconnect every {contact.reconnectEveryDays} day{contact.reconnectEveryDays === 1 ? '' : 's'}
              {contact.lastContactedAt ? ` - last contacted ${fmtDate(contact.lastContactedAt)}` : ' - no last contact date'}
            {:else}
              No cadence set yet. Add one to keep this relationship warm.
            {/if}
          </div>
        </div>
        <button type="button" class="btn" on:click={() => (showCadenceEditor = !showCadenceEditor)}>
          {showCadenceEditor ? 'Close cadence' : contact.reconnectEveryDays ? 'Edit cadence' : 'Add cadence'}
        </button>
      </div>

      {#if showCadenceEditor}
        <div class="inline-panel">
          <form method="post" action="?/setCadence" class="cadence-form">
            <div class="field compact grow">
              <label for="days">Reconnect every days</label>
              <input id="days" name="days" type="number" min="1" max="3650" value={contact.reconnectEveryDays ?? ''} placeholder="30" />
            </div>
            <button class="btn primary" type="submit">Save cadence</button>
          </form>

          <div class="preset-row" aria-label="Cadence presets">
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="7" /><button class="btn" type="submit">Weekly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="14" /><button class="btn" type="submit">Fortnightly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="30" /><button class="btn" type="submit">Monthly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="90" /><button class="btn" type="submit">Quarterly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="" /><button class="btn" type="submit">Clear cadence</button></form>
          </div>
        </div>
      {/if}

      {#if showReminderPanel}
        <div class="inline-panel">
          <form method="post" action="?/createReminder" class="reminder-form">
            <div class="field compact">
              <label for="dueAt">Due</label>
              <input id="dueAt" name="dueAt" type="datetime-local" required />
            </div>
            <div class="field compact grow">
              <label for="note">Note</label>
              <input id="note" name="note" placeholder="What should you remember?" />
            </div>
            <button class="btn primary" type="submit">Add reminder</button>
          </form>

          {#if data.reminders?.length}
            <div class="mini-list">
              {#each data.reminders as reminder}
                <div class="mini-row">
                  <span>{fmt(reminder.dueAt)} {reminder.note ? `- ${reminder.note}` : ''}</span>
                  <form method="post" action="?/completeReminder">
                    <input type="hidden" name="reminderId" value={reminder.id} />
                    <button class="btn" type="submit">Done</button>
                  </form>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="content-grid">
      <section class="card panel">
        <h2>Details</h2>
        <div class="grid details">
          <div><strong>Email</strong></div><div>{contact.email || ' - '}</div>
          <div><strong>Phone</strong></div><div>{contact.phone || ' - '}</div>
          <div><strong>Company</strong></div><div>{contact.company || ' - '}</div>
          <div><strong>Position</strong></div><div>{contact.position || ' - '}</div>
          <div><strong>LinkedIn</strong></div><div>{contact.linkedin || ' - '}</div>
          <div><strong>Created</strong></div><div>{fmt(contact.createdAt)}</div>
          <div><strong>Cadence</strong></div><div>{contact.reconnectEveryDays ? `Every ${contact.reconnectEveryDays} days` : 'Not set'}</div>
          <div><strong>Last contacted</strong></div><div>{fmt(contact.lastContactedAt) || 'Not set'}</div>
        </div>

        <div class="section-block">
          <h2>Tags</h2>
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
            <p class="muted">No tags yet.</p>
          {/if}

          <form method="post" action="?/addTag" class="inline-form-row">
            <input name="name" placeholder="Add a tag" aria-label="Tag name" required />
            <button class="btn primary" type="submit">Add</button>
          </form>
        </div>
      </section>

      <section class="card panel">
        <div class="section-head">
          <h2>Deals</h2>
          <div class="action-row">
            <a class="btn" href={`/deals/new`}>New deal</a>
            <button type="button" class="btn" on:click={() => (showAddDeal = !showAddDeal)}>
              {showAddDeal ? 'Cancel' : 'Attach deal'}
            </button>
          </div>
        </div>

        {#if showAddDeal}
          <form method="post" action="?/addDeal" class="nested-form">
            <div class="field">
              <label for="dealId">Deal</label>
              <select id="dealId" name="dealId" required>
                <option value="">Select deal</option>
                {#each dealOptions as deal}
                  <option value={deal.id}>{deal.title} ({deal.statusLabel})</option>
                {/each}
              </select>
            </div>

            <div class="grid two">
              <div class="field">
                <label for="dealRelationshipType">Role in deal</label>
                <select id="dealRelationshipType" name="relationshipType">
                  {#each dealRelationshipOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div class="field">
                <label for="dealLabel">Custom label</label>
                <input id="dealLabel" name="label" placeholder="e.g. introducer, sponsor" />
              </div>
            </div>

            <div class="field">
              <label for="dealNotes">Relationship notes</label>
              <textarea id="dealNotes" name="notes" rows="3"></textarea>
            </div>

            <label class="check-row">
              <input type="checkbox" name="isPrimary" />
              <span>Primary relationship for this deal</span>
            </label>

            <button class="btn primary" type="submit">Attach deal</button>
          </form>
        {/if}

        {#if deals.length === 0}
          <p class="muted">No deals attached yet.</p>
        {:else}
          <div class="deal-list">
            {#each deals as deal}
              <div class="deal-card-inline">
                <div>
                  <div class="deal-title-line">
                    <span class="deal-icon" aria-hidden="true">◆</span>
                    <a href={`/deals/${deal.id}`}>{deal.title}</a>
                    {#if deal.isPrimary}<span class="status-chip">Primary</span>{/if}
                  </div>
                  <div class="muted small">{deal.relationshipLabel} - {deal.statusLabel} - {deal.valueLabel}</div>
                  {#if deal.probability !== null}
                    <div class="muted small">{deal.probability}% chance{deal.expectedCloseDate ? ` - expected ${fmtDate(deal.expectedCloseDate)}` : ''}</div>
                  {/if}
                  {#if deal.notes}<p class="muted preline">{deal.notes}</p>{/if}
                </div>
                <form method="post" action="?/removeDeal" on:submit={(event) => { if (!confirm('Remove this deal relationship?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={deal.linkId} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <section class="card panel">
      <div class="section-head">
        <h2>Connections</h2>
        <button type="button" class="btn" on:click={() => (showAddRelationship = !showAddRelationship)}>
          {showAddRelationship ? 'Cancel' : 'Add connection'}
        </button>
      </div>

      {#if showAddRelationship}
        <form method="post" action="?/addRelationship" class="nested-form">
          <div class="field">
            <label for="otherContactId">Connect to</label>
            <select id="otherContactId" name="otherContactId" required>
              <option value="">Select contact</option>
              {#each contactOptions as opt}
                <option value={opt.id}>{opt.name}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="label">Relationship</label>
            <input id="label" name="label" placeholder="e.g. colleague, friend, spouse" />
          </div>

          <button class="btn primary" type="submit">Add connection</button>
        </form>
      {/if}

      {#if relationships.length === 0}
        <p class="muted">No connections yet.</p>
      {:else}
        <ul class="plain-list">
          {#each relationships as rel}
            <li class="list-row">
              <div>
                <a href={`/contacts/${rel.otherContactId}`} class="strong-link">{rel.otherContactName}</a>
                <span class="muted">({rel.label})</span>
              </div>
              <form method="post" action="?/removeRelationship">
                <input type="hidden" name="relationshipId" value={rel.id} />
                <button class="btn" type="submit">Remove</button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>Recent notes</h2>
        <a class="btn" href={`/contacts/${contact.id}/interactions/new`}>New voice/note</a>
      </div>

      {#if interactions.length === 0}
        <p class="muted">No notes yet. Add the first one.</p>
      {:else}
        <ul class="notes">
          {#each interactions as n}
            <li class="note">
              <div class="note-meta">
                <span class="pill">{n.channel}</span>
                <span class="muted">{fmt(n.occurredAt)}</span>
              </div>
              <a class="note-link" href={`/contacts/${contact.id}/interactions/${n.id}`}>{n.preview || '(empty)'}</a>
            </li>
          {/each}
        </ul>
      {/if}

      {#if dealNotes.length > 0}
        <div class="section-block">
          <h2>Deal notes involving this person</h2>
          <ul class="notes">
            {#each dealNotes as note}
              <li class="note">
                <div class="note-meta">
                  <span class="pill">{note.channel}</span>
                  <span class="muted">{fmt(note.occurredAt)}</span>
                  <span class="muted">on <a href={`/deals/${note.dealId}`}>{note.dealTitle}</a> ({note.dealStatusLabel})</span>
                </div>
                <a class="preline note-link" href={`/deals/${note.dealId}/notes/${note.id}`}>{note.preview || '(empty)'}</a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <div style="display:flex; gap:10px; margin-top:16px;">
      <a class="btn" href="/">Back</a>
    </div>
  </div>
{/if}

<style>
  .container { padding: 12px; }
  .hero-card, .panel { padding: 18px; margin-bottom: 12px; }
  .title-row, .section-head, .deal-card-inline, .list-row, .mini-row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .action-row, .quick-row, .inline-form-row, .reminder-form, .cadence-form, .preset-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .strong-link { font-weight: 700; }
  .content-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
  .grid.details { display: grid; grid-template-columns: 120px 1fr; gap: 8px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .section-block { margin-top: 18px; }
  .inline-form-row { margin-top: 10px; }
  .inline-form-row input { flex: 1 1 180px; }
  .inline-panel, .nested-form, .cadence-strip { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 10px; background: var(--panel); }
  .cadence-strip { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .preset-row { margin-top: 10px; }
  .preset-row form { display: inline-flex; }
  .field.compact { margin-bottom: 0; }
  .grow { flex: 1 1 220px; }
  .mini-list { margin-top: 10px; display: grid; gap: 6px; }
  .deal-list { display: grid; gap: 8px; }
  .deal-card-inline { border-top: 1px solid var(--border); padding: 12px 0; }
  .deal-title-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 700; }
  .deal-icon { color: var(--accent-2); line-height: 1; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
  .check-row input { width: auto; }
  .plain-list, .notes { list-style: none; padding: 0; margin: 0; }
  .list-row { padding: 10px 0; border-top: 1px solid var(--border); align-items: center; }
  .note { padding: 10px 0; border-top: 1px solid var(--border); }
  .note-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
  .preline { white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .title-row, .section-head, .deal-card-inline, .list-row, .cadence-strip { flex-direction: column; align-items: stretch; }
    .content-grid, .grid.two { grid-template-columns: 1fr; }
    .quick-row, .reminder-form { flex-direction: column; align-items: stretch; }
  }
</style>
