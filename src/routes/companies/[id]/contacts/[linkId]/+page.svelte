<!-- src/routes/companies/[id]/contacts/[linkId]/+page.svelte -->
<script lang="ts">
  import ExchangeItemsPanel from '$lib/ExchangeItemsPanel.svelte';
  import WantsPanel from '$lib/WantsPanel.svelte';
  import NotesPanel from '$lib/NotesPanel.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showAddNote = false;
  let showLinkDeal = false;
  let dealSearch = '';

  $: filteredDealOptions = (data.dealOptions || []).filter((deal: any) => {
    const q = dealSearch.trim().toLowerCase();
    if (!q) return true;
    return `${deal.title || ''} ${deal.statusLabel || ''}`.toLowerCase().includes(q);
  });

  function closeContainingDetails(event: Event) {
    const details = (event.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
  }
</script>

<div class="container">
  <header class="relationship-header card">
    <div>
      <div class="eyebrow">Contact-company relationship</div>
      <h1><a href={`/contacts/${data.relationship.contactId}`}>{data.relationship.contactName}</a> at <a href={`/companies/${data.relationship.companyId}`}>{data.relationship.companyName}</a></h1>
      <div class="meta-row">
        <span class="status-chip">{data.relationship.statusLabel}</span>
        {#if data.relationship.isPrimary}<span class="status-chip">Primary</span>{/if}
        {#if data.relationship.title}<span>{data.relationship.title}</span>{/if}
        {#if data.relationship.department}<span>{data.relationship.department}</span>{/if}
      </div>
      <div class="muted small">
        {#if data.relationship.contactEmail}<span>{data.relationship.contactEmail}</span>{/if}
        {#if data.relationship.contactPhone}<span> · {data.relationship.contactPhone}</span>{/if}
      </div>
    </div>
    <div class="header-actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Cancel edit' : 'Edit relationship'}</button>
      <button class="btn" type="button" on:click={() => (showAddNote = !showAddNote)}>{showAddNote ? 'Cancel note' : 'Add note'}</button>
      <a class="btn" href={`/contacts/${data.relationship.contactId}`}>Open contact</a>
      <a class="btn" href={`/companies/${data.relationship.companyId}`}>Back to company</a>
    </div>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  {#if showEdit}
    <section class="card panel">
      <h2>Edit relationship</h2>
      <form method="post" action="?/updateRelationship" class="nested-form">
        <div class="grid three">
          <div class="field"><label for="title">Role/title at company</label><input id="title" name="title" value={data.relationship.title} /></div>
          <div class="field"><label for="department">Department / context</label><input id="department" name="department" value={data.relationship.department} /></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.companyContactStatuses as opt}<option value={opt.value} selected={data.relationship.status === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="notes">Relationship notes</label><textarea id="notes" name="notes" rows="3">{data.relationship.notes}</textarea></div>
        <label class="check-row"><input type="checkbox" name="isPrimary" checked={data.relationship.isPrimary} /><span>Primary contact at this company</span></label>
        <button class="btn primary" type="submit">Save relationship</button>
      </form>
    </section>
  {/if}

  <div class="grid two main-grid">
    <section class="card panel">
      <h2>Relationship context</h2>
      {#if data.relationship.notes}<p class="preline">{data.relationship.notes}</p>{:else}<p class="muted">No relationship notes yet.</p>{/if}
      <div class="info-grid">
        <div><span class="muted small">Company</span><a href={`/companies/${data.relationship.companyId}`}>{data.relationship.companyName}</a></div>
        <div><span class="muted small">Contact</span><a href={`/contacts/${data.relationship.contactId}`}>{data.relationship.contactName}</a></div>
        {#if data.relationship.companyWebsite}<div><span class="muted small">Company website</span><span>{data.relationship.companyWebsite}</span></div>{/if}
        {#if data.relationship.contactLinkedin}<div><span class="muted small">Contact LinkedIn</span><span>{data.relationship.contactLinkedin}</span></div>{/if}
      </div>
    </section>

    <section class="card panel">
      <h2>Quick use</h2>
      <p class="muted">Use this page when your context is specifically this person at this company. General person notes still belong on the contact. General organisation notes still belong on the company.</p>
      <ul class="small">
        <li>Add relationship-specific notes from calls, emails or meetings.</li>
        <li>Add tasks where the next action is about this person-company context.</li>
        <li>Link deals where this person is involved as the company contact.</li>
        <li>Record wants/offers attached to this specific relationship.</li>
      </ul>
    </section>
  </div>

  <section class="card panel">
    <div class="section-head"><h2>Relationship notes</h2><button class="btn" type="button" on:click={() => (showAddNote = !showAddNote)}>{showAddNote ? 'Cancel note' : 'Add note'}</button></div>
    {#if showAddNote}
      <form method="post" action="?/createNote" class="nested-form">
        <div class="grid two">
          <div class="field"><label for="noteChannel">Channel</label><select id="noteChannel" name="channel">{#each data.noteChannels as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="occurredAt">Note date</label><input id="occurredAt" name="occurredAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
        </div>
        <div class="field"><label for="body">Note</label><textarea id="body" name="body" rows="4" required></textarea></div>
        <div class="field"><label for="summary">Summary</label><input id="summary" name="summary" /></div>
        <button class="btn primary" type="submit">Save note</button>
      </form>
    {/if}

    <NotesPanel notes={data.notes} emptyMessage="No relationship notes yet.">
      <svelte:fragment slot="actions" let:note>
        <details class="edit-box">
          <summary>Edit note</summary>
          <form method="post" action="?/updateNote" class="nested-form">
            <input type="hidden" name="noteId" value={note.id} />
            <div class="grid two">
              <div class="field"><label for={`channel-${note.id}`}>Channel</label><select id={`channel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
              <div class="field"><label for={`occurred-${note.id}`}>Note date</label><input id={`occurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} on:change={closeDatePickerOnChange} /></div>
            </div>
            <div class="field"><label for={`body-${note.id}`}>Note</label><textarea id={`body-${note.id}`} name="body" rows="4" required>{note.body}</textarea></div>
            <div class="field"><label for={`summary-${note.id}`}>Summary</label><input id={`summary-${note.id}`} name="summary" value={note.summary} /></div>
            <div class="row-actions"><button class="btn primary" type="submit">Save note</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
          </form>
        </details>
        <form method="post" action="?/deleteNote" on:submit={(event) => { if (!confirm('Delete this relationship note?')) event.preventDefault(); }}>
          <input type="hidden" name="noteId" value={note.id} />
          <button class="btn" type="submit">Delete note</button>
        </form>
      </svelte:fragment>
    </NotesPanel>
  </section>

  <TasksPanel
    tasks={data.tasks}
    heading="Relationship tasks"
    emptyMessage="No tasks attached to this relationship."
    taskTypeOptions={data.taskTypes}
    taskStatusOptions={data.taskStatuses}
    taskUrgencyOptions={data.taskUrgencies}
    taskImportanceOptions={data.taskImportances}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/companies/${data.relationship.companyId}/contacts/${data.relationship.id}`}
    lockedContactId={data.relationship.contactId}
    lockedCompanyId={data.relationship.companyId}
    contactOptions={data.taskContactOptions}
    companyOptions={data.taskCompanyOptions}
    dealOptions={data.dealOptions}
    projectOptions={data.projectOptions}
    workstreamOptions={data.taskWorkstreamOptions}
    marketLeadOptions={data.taskMarketLeadOptions}
    dealContactOptions={data.taskDealContactOptions}
    dealCompanyOptions={data.taskDealCompanyOptions}
  />

  <section class="card panel">
    <div class="section-head"><h2>Deals involving this relationship</h2><button class="btn" type="button" on:click={() => (showLinkDeal = !showLinkDeal)}>{showLinkDeal ? 'Cancel link' : 'Link deal'}</button></div>
    {#if showLinkDeal}
      <form method="post" action="?/linkDeal" class="nested-form">
        <div class="field"><label for="dealSearch">Search deals</label><input id="dealSearch" bind:value={dealSearch} placeholder="Type a deal name" /></div>
        <div class="field"><label for="dealId">Deal</label><select id="dealId" name="dealId" required size={Math.min(8, Math.max(3, filteredDealOptions.length || 3))}><option value="">Select deal</option>{#each filteredDealOptions as d}<option value={d.id}>{d.title} - {d.statusLabel}</option>{/each}</select></div>
        <div class="grid three">
          <div class="field"><label for="relationshipType">Role in deal</label><select id="relationshipType" name="relationshipType">{#each data.dealRelationshipTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="dealLabel">Label</label><input id="dealLabel" name="label" placeholder="e.g. buyer contact, seller contact" /></div>
        </div>
        <div class="field"><label for="dealNotes">Notes</label><textarea id="dealNotes" name="notes" rows="2"></textarea></div>
        <button class="btn primary" type="submit">Link deal</button>
      </form>
    {/if}

    {#if data.dealContacts.length === 0}<p class="muted">No deals linked to this person-company relationship yet.</p>{:else}
      <div class="mini-list">
        {#each data.dealContacts as link}
          <div class="mini-row">
            <div>
              <div class="title-line"><a href={`/deals/${link.dealId}`}>{link.dealTitle}</a><span class="status-chip">{link.dealStatusLabel}</span><span class="status-chip">{link.relationshipLabel}</span></div>
              {#if link.notes}<p class="preline small">{link.notes}</p>{/if}
            </div>
            <form method="post" action="?/unlinkDeal" on:submit={(event) => { if (!confirm('Remove this relationship link from the deal? The deal itself will not be deleted.')) event.preventDefault(); }}>
              <input type="hidden" name="dealContactId" value={link.id} />
              <button class="btn" type="submit">Unlink</button>
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <WantsPanel items={data.wants ?? []} entityLabel={`${data.relationship.contactName} at ${data.relationship.companyName}`} title="Wants for this relationship" />

  <ExchangeItemsPanel items={data.exchangeItems ?? []} entityLabel={`${data.relationship.contactName} at ${data.relationship.companyName}`} title="Offers for this relationship" />
</div>

<style>
  .container { max-width:1180px; margin:0 auto; padding:18px; display:grid; gap:16px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:16px; box-shadow:var(--shadow); }
  .relationship-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
  .header-actions, .row-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .eyebrow { text-transform:uppercase; font-size:0.78rem; letter-spacing:.08em; color:var(--muted); font-weight:700; }
  h1, h2 { margin:0; }
  .panel { display:grid; gap:12px; }
  .muted { color:var(--muted); }
  .small { font-size:0.9rem; }
  .meta-row, .title-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .status-chip { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:0.82rem; }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
  .btn.primary { font-weight:700; }
  .grid { display:grid; gap:12px; }
  .grid.two { grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .grid.three { grid-template-columns:repeat(3, minmax(0, 1fr)); }
  .nested-form { display:grid; gap:12px; }
  .field { display:grid; gap:6px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .check-row { display:flex; gap:8px; align-items:center; }
  .preline { white-space:pre-wrap; }
  .info-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; margin-top:10px; }
  .info-grid > div { display:grid; gap:4px; border:1px solid var(--border); border-radius:12px; padding:10px; background:var(--surface); }
  .mini-list { display:grid; gap:10px; }
  .mini-row { border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .mini-row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .edit-box { margin-top:10px; }
  .edit-box summary { cursor:pointer; color:var(--muted); }
  .error-card { border-color:#ef4444; color:#b91c1c; }

  @media (max-width: 800px) {
    .relationship-header, .mini-row { flex-direction:column; }
    .grid.two, .grid.three, .info-grid { grid-template-columns:1fr; }
  }
</style>
