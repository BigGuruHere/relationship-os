<!-- src/routes/deals/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Render a deal, its state, and the people attached to it.
  // SECURITY: All display data comes from the server.
  export let data: {
    deal: {
      id: string;
      title: string;
      description: string;
      valueInput: string;
      valueLabel: string;
      weightedValueLabel: string;
      currency: string;
      status: string;
      statusLabel: string;
      probability: number | null;
      expectedCloseDate: string | Date | null;
      expectedCloseDateInput: string;
      closedAt: string | Date | null;
      lostReason: string;
      createdAt: string | Date;
      updatedAt: string | Date;
    };
    people: Array<{
      id: string;
      contactId: string;
      name: string;
      company: string;
      email: string;
      phone: string;
      relationshipType: string | null;
      relationshipLabel: string;
      label: string;
      notes: string;
      isPrimary: boolean;
    }>;
    notes: Array<{
      id: string;
      channel: string;
      occurredAt: string | Date;
      preview: string;
      summary: string;
      contactId: string | null;
      contactName: string;
    }>;
    contactOptions: Array<{ id: string; name: string }>;
    statusOptions: Array<{ value: string; label: string }>;
    relationshipOptions: Array<{ value: string; label: string }>;
  };
  export let form;

  let showStateEditor = false;
  let showAddPerson = false;

  function fmtDate(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }
</script>

<div class="container">
  <div class="card deal-header">
    <div class="header-main">
      <span class="deal-icon" aria-hidden="true">◆</span>
      <div>
        <div class="eyebrow">Deal</div>
        <h1>{data.deal.title}</h1>
        <div class="meta-row">
          <span>{data.deal.statusLabel}</span>
          <span>{data.deal.valueLabel}</span>
          <span>{data.deal.probability === null ? 'No probability' : `${data.deal.probability}% chance`}</span>
          <span>{data.deal.weightedValueLabel}</span>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" type="button" on:click={() => (showStateEditor = !showStateEditor)}>
        {showStateEditor ? 'Close state' : 'Update state'}
      </button>
      <a class="btn" href={`/deals/${data.deal.id}/notes/new`}>Add voice/note</a>
      <a class="btn" href={`/deals/${data.deal.id}/edit`}>Edit</a>
    </div>
  </div>

  {#if form?.error}
    <div class="card error-card">{form.error}</div>
  {/if}

  {#if showStateEditor}
    <div class="card panel">
      <h2>Deal state</h2>
      <form method="post" action="?/updateState">
        <div class="grid three">
          <div class="field">
            <label for="status">State</label>
            <select id="status" name="status">
              {#each data.statusOptions as opt}
                <option value={opt.value} selected={data.deal.status === opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div class="field">
            <label for="probability">Chance of closing %</label>
            <input id="probability" name="probability" type="number" min="0" max="100" value={data.deal.probability ?? ''} />
          </div>
          <div class="field">
            <label for="expectedCloseDate">Expected close</label>
            <input id="expectedCloseDate" name="expectedCloseDate" type="date" value={data.deal.expectedCloseDateInput} />
          </div>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="value">Estimated value</label>
            <input id="value" name="value" inputmode="decimal" value={data.deal.valueInput} />
          </div>
          <div class="field">
            <label for="currency">Currency</label>
            <input id="currency" name="currency" maxlength="3" value={data.deal.currency} />
          </div>
        </div>

        <div class="field">
          <label for="lostReason">Lost reason</label>
          <input id="lostReason" name="lostReason" placeholder="Only used if state is Lost" value={data.deal.lostReason} />
        </div>

        <button class="btn primary" type="submit">Save state</button>
      </form>
    </div>
  {/if}

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Notes</h2>
      {#if data.deal.description}
        <p class="preline">{data.deal.description}</p>
      {:else}
        <p class="muted">No deal notes yet.</p>
      {/if}
      <div class="detail-list">
        <div><strong>Expected close</strong><span>{fmtDate(data.deal.expectedCloseDate) || 'Not set'}</span></div>
        <div><strong>Closed at</strong><span>{fmtDate(data.deal.closedAt) || 'Not closed'}</span></div>
        {#if data.deal.lostReason}
          <div><strong>Lost reason</strong><span>{data.deal.lostReason}</span></div>
        {/if}
      </div>
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>People in this deal</h2>
        <button class="btn" type="button" on:click={() => (showAddPerson = !showAddPerson)}>
          {showAddPerson ? 'Cancel' : 'Add person'}
        </button>
      </div>

      {#if showAddPerson}
        <form method="post" action="?/addContact" class="add-person">
          <div class="field">
            <label for="contactId">Contact</label>
            <select id="contactId" name="contactId" required>
              <option value="">Select contact</option>
              {#each data.contactOptions as contact}
                <option value={contact.id}>{contact.name}</option>
              {/each}
            </select>
          </div>

          <div class="grid two">
            <div class="field">
              <label for="relationshipType">Role</label>
              <select id="relationshipType" name="relationshipType">
                {#each data.relationshipOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
            <div class="field">
              <label for="label">Custom label</label>
              <input id="label" name="label" placeholder="e.g. sponsor, gatekeeper" />
            </div>
          </div>

          <div class="field">
            <label for="notes">Relationship notes</label>
            <textarea id="notes" name="notes" rows="3" placeholder="Why this person matters to the deal"></textarea>
          </div>

          <label class="check-row">
            <input type="checkbox" name="isPrimary" />
            <span>Primary relationship for this deal</span>
          </label>

          <button class="btn primary" type="submit">Attach person</button>
        </form>
      {/if}

      {#if data.people.length === 0}
        <p class="muted">No people are attached yet.</p>
      {:else}
        <div class="people-list">
          {#each data.people as person}
            <div class="person-card">
              <div>
                <div class="person-title">
                  <a href={`/contacts/${person.contactId}`}>{person.name}</a>
                  {#if person.isPrimary}<span class="status-chip">Primary</span>{/if}
                </div>
                <div class="muted">{person.relationshipLabel}</div>
                {#if person.company}<div class="muted small">{person.company}</div>{/if}
                {#if person.notes}<p class="preline small">{person.notes}</p>{/if}
              </div>
              <div class="person-actions">
                {#if !person.isPrimary}
                  <form method="post" action="?/makePrimary">
                    <input type="hidden" name="linkId" value={person.id} />
                    <button class="btn" type="submit">Make primary</button>
                  </form>
                {/if}
                <form method="post" action="?/removeContact" on:submit={(event) => { if (!confirm('Remove this person from the deal?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={person.id} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <section class="card panel">
    <div class="section-head">
      <h2>Recent deal notes</h2>
      <a class="btn" href={`/deals/${data.deal.id}/notes/new`}>New voice/note</a>
    </div>

    {#if data.notes.length === 0}
      <p class="muted">No deal notes yet. Add a typed note or record a voice note.</p>
    {:else}
      <ul class="notes-list">
        {#each data.notes as note}
          <li class="note-row">
            <div class="note-meta">
              <span class="status-chip">{note.channel}</span>
              <span class="muted">{fmtDate(note.occurredAt)}</span>
              {#if note.contactId}
                <span class="muted">with <a href={`/contacts/${note.contactId}`}>{note.contactName}</a></span>
              {/if}
            </div>
            <a class="preline note-preview note-link" href={`/deals/${data.deal.id}/notes/${note.id}`}>{note.preview || '(empty)'}</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>


  <div class="bottom-actions">
    <a class="btn" href="/deals">Back to deals</a>
  </div>
</div>

<style>
  .deal-header { padding: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .header-main { display: flex; gap: 12px; align-items: flex-start; }
  .deal-icon { color: var(--accent-2); font-size: 1.8rem; line-height: 1; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .meta-row, .actions, .bottom-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta-row { margin-top: 8px; color: var(--muted); }
  .panel { padding: 16px; margin-bottom: 12px; }
  .main-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .preline { white-space: pre-wrap; }
  .detail-list { display: grid; gap: 8px; margin-top: 12px; }
  .detail-list div { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
  .section-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .add-person { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
  .check-row input { width: auto; }
  .people-list, .notes-list { display: grid; gap: 8px; }
  .notes-list { list-style: none; padding: 0; margin: 0; }
  .note-row { border-top: 1px solid var(--border); padding: 12px 0; }
  .note-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
  .note-preview { margin: 0; display: block; color: inherit; text-decoration: none; }
  .note-link:hover { text-decoration: underline; }
  .person-card { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .person-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 700; }
  .person-actions { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .error-card { padding: 12px; color: var(--danger); margin-bottom: 12px; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .deal-header, .person-card, .section-head { flex-direction: column; }
    .main-grid, .grid.two, .grid.three { grid-template-columns: 1fr; }
    .actions, .bottom-actions { align-items: stretch; }
  }
</style>
