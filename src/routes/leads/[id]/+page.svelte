<!-- src/routes/leads/[id]/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';
  import { buildLeadListReturnHref } from '$lib/leadListNavigation';

  export let data: any;
  export let form: any;

  const lead = data.lead;
  let showEdit = false;
  let leadNoteText = '';
  let leadNoteSummary = '';
  let editSourceChoice = lead.sourceChoice || (lead.leadSourceId ? `custom:${lead.leadSourceId}` : `builtin:${lead.source || 'MANUAL'}`);
  let companySearch = '';
  // IT: Keep a local priority value so the Details-row control can autosave without a page reload.
  let quickPriority = lead.priority;
  let prioritySaving = false;
  let prioritySaved = false;
  let priorityError = '';

  // IT: Operational lead fields are editable in place so calling-list work does not require
  // opening the full edit form. Identity/contact details remain edit-form only.
  let quickCommunicationMethod = lead.usualCommunicationMethod || '';
  let quickContactAttemptStatus = lead.contactAttemptStatus || 'NOT_CONTACTED';
  let quickLastContactedAt = lead.lastContactedAtInput || '';
  let quickBuyerStatus = lead.buyerStatus || 'NOT_ASKED';
  let quickSellerStatus = lead.sellerStatus || 'NOT_ASKED';
  let quickConfidence = lead.confidence ?? 50;
  let quickNextAction = lead.nextAction || '';
  let quickSavingField = '';
  let quickSavedField = '';
  let quickFieldError = '';

  function applyQuickFieldValue(field: string, value: unknown) {
    switch (field) {
      case 'usualCommunicationMethod': quickCommunicationMethod = String(value ?? ''); break;
      case 'contactAttemptStatus': quickContactAttemptStatus = String(value ?? 'NOT_CONTACTED'); break;
      case 'lastContactedAt': quickLastContactedAt = String(value ?? ''); break;
      case 'buyerStatus': quickBuyerStatus = String(value ?? 'NOT_ASKED'); break;
      case 'sellerStatus': quickSellerStatus = String(value ?? 'NOT_ASKED'); break;
      case 'confidence': quickConfidence = Number(value ?? 50); break;
      case 'nextAction': quickNextAction = String(value ?? ''); break;
    }
  }

  function enhanceQuickField(field: string) {
    // IT: Return a SubmitFunction. Saving state must begin on submit, not while Svelte renders the action.
    return () => {
      quickSavingField = field;
      quickSavedField = '';
      quickFieldError = '';

      return async ({ result }: any) => {
        if (result.type === 'success') {
          applyQuickFieldValue(field, result.data?.value);
          quickSavingField = '';
          quickSavedField = field;
          window.setTimeout(() => { if (quickSavedField === field) quickSavedField = ''; }, 900);
          return;
        }

        quickSavingField = '';
        quickFieldError = result.data?.quickFieldError || 'Could not update lead.';
      };
    };
  }

  function submitQuickControl(event: Event) {
    (event.currentTarget as HTMLInputElement | HTMLSelectElement).form?.requestSubmit();
  }

  function submitQuickTextOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    // IT: blur fires the input's change event once, avoiding a duplicate autosave.
    (event.currentTarget as HTMLInputElement).blur();
  }

  function enhancePriority() {
    prioritySaving = true;
    prioritySaved = false;
    priorityError = '';

    return async ({ result }: any) => {
      prioritySaving = false;
      if (result.type === 'success') {
        const savedPriority = Number(result.data?.priority);
        if (Number.isFinite(savedPriority)) quickPriority = savedPriority;
        prioritySaved = true;
        window.setTimeout(() => (prioritySaved = false), 900);
        return;
      }

      priorityError = result.data?.error || 'Could not update priority.';
    };
  }

  $: filteredCompanies = (data.companies || []).filter((company: any) => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return true;
    return `${company.name || ''} ${company.phone || ''} ${company.website || ''}`.toLowerCase().includes(q);
  });

  function optionLabel(options: readonly { value: string; label: string }[], value: string, fallback: string) {
    return options.find((option) => option.value === value)?.label || fallback;
  }

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleString();
  }

  function closeContainingDetails(event: Event) {
    const details = (event.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
  }


</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Lead</div>
      <h1>{lead.title}</h1>
      <p class="muted">{lead.typeLabel} - {lead.statusLabel} - {lead.sourceLabel}</p>
      <p class="muted small">Contact: {optionLabel(data.contactAttemptStatuses, quickContactAttemptStatus, 'Not contacted')} - Buyer: {optionLabel(data.buyerQualificationStatuses, quickBuyerStatus, 'Not asked')} - Seller: {optionLabel(data.sellerQualificationStatuses, quickSellerStatus, 'Not asked')}</p>
    </div>
    <div class="actions">
      <a class="btn primary" href={buildLeadListReturnHref(data.returnTo)}>Return to list</a>
      <a class="btn" href="/leads">All leads</a>
      {#if lead.projectId}<a class="btn" href={`/projects/${lead.projectId}`}>Open project</a>{/if}
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Close edit' : 'Edit lead'}</button>
    </div>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="grid two">
    <section class="card panel">
      <h2>Details</h2>
      <div class="details-grid">
        <strong>Person</strong><span>{lead.name || ' - '}</span>
        <strong>Role/title</strong><span>{lead.roleTitle || ' - '}</span>
        <strong>Company</strong><span>{lead.companyName || ' - '}</span>
        {#if lead.externalIdentifiers?.length}
          <strong>External ID</strong><span>{#each lead.externalIdentifiers as identifier, index}{#if index > 0}<br />{/if}<span class="status-chip">{identifier.scheme}</span> {identifier.value}{#if identifier.sourceUrl} <a href={identifier.sourceUrl} target="_blank" rel="noreferrer">source</a>{/if}{/each}</span>
        {/if}
        <strong>Email</strong><span>{lead.email || ' - '}</span>
        <strong>Phone</strong><span>{lead.phone || ' - '}</span>
        <strong>Website</strong><span>{lead.website || ' - '}</span>
        <strong>LinkedIn</strong><span>{lead.linkedin || ' - '}</span>
        <strong>Geography</strong><span>{lead.geography || ' - '}</span>
        <strong>Address</strong><span>{lead.address || ' - '}</span>
        <strong>Usual communication</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('usualCommunicationMethod')}>
          <input type="hidden" name="field" value="usualCommunicationMethod" />
          <select name="value" class="quick-select" bind:value={quickCommunicationMethod} on:change={submitQuickControl} aria-label="Usual communication">{#each data.communicationMethods as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          {#if quickSavingField === 'usualCommunicationMethod'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'usualCommunicationMethod'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Contact attempt</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('contactAttemptStatus')}>
          <input type="hidden" name="field" value="contactAttemptStatus" />
          <select name="value" class="quick-select" bind:value={quickContactAttemptStatus} on:change={submitQuickControl} aria-label="Contact attempt">{#each data.contactAttemptStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          {#if quickSavingField === 'contactAttemptStatus'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'contactAttemptStatus'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Last contacted</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('lastContactedAt')}>
          <input type="hidden" name="field" value="lastContactedAt" />
          <input name="value" class="quick-date" type="datetime-local" bind:value={quickLastContactedAt} on:change={(event) => { closeDatePickerOnChange(event); submitQuickControl(event); }} aria-label="Last contacted" />
          {#if quickSavingField === 'lastContactedAt'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'lastContactedAt'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Buyer status</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('buyerStatus')}>
          <input type="hidden" name="field" value="buyerStatus" />
          <select name="value" class="quick-select" bind:value={quickBuyerStatus} on:change={submitQuickControl} aria-label="Buyer status">{#each data.buyerQualificationStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          {#if quickSavingField === 'buyerStatus'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'buyerStatus'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Seller status</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('sellerStatus')}>
          <input type="hidden" name="field" value="sellerStatus" />
          <select name="value" class="quick-select" bind:value={quickSellerStatus} on:change={submitQuickControl} aria-label="Seller status">{#each data.sellerQualificationStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          {#if quickSavingField === 'sellerStatus'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'sellerStatus'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Priority</strong><div class="priority-inline-wrap">
          <form method="post" action="?/quickPriority" class="priority-stepper" use:enhance={enhancePriority}>
            <button class="priority-step" type="submit" name="delta" value="-1" disabled={prioritySaving || quickPriority <= 1} aria-label="Lower lead priority" title="Lower priority">▼</button>
            <strong class="priority-value">{quickPriority}<span>/5</span></strong>
            <button class="priority-step" type="submit" name="delta" value="1" disabled={prioritySaving || quickPriority >= 5} aria-label="Raise lead priority" title="Raise priority">▲</button>
            {#if prioritySaving}<span class="priority-feedback muted">Saving...</span>{:else if prioritySaved}<span class="priority-feedback saved">Saved</span>{/if}
          </form>
          {#if priorityError}<span class="priority-error" role="alert">{priorityError}</span>{/if}
        </div>
        <strong>Confidence</strong><form method="post" action="?/quickField" class="quick-inline-form" use:enhance={enhanceQuickField('confidence')}>
          <input type="hidden" name="field" value="confidence" />
          <span class="quick-number-wrap"><input name="value" class="quick-number" type="number" min="0" max="100" step="1" bind:value={quickConfidence} on:change={submitQuickControl} aria-label="Confidence" /><span>/100</span></span>
          {#if quickSavingField === 'confidence'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'confidence'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
        <strong>Project</strong><span>{#if lead.projectId}<a href={`/projects/${lead.projectId}`}>{lead.linkedProjectTitle || 'Open project'}</a>{:else}Standalone lead{/if}</span>
        <strong>Workstream</strong><span>{lead.linkedWorkstreamTitle || ' - '}</span>
        <strong>Next action</strong><form method="post" action="?/quickField" class="quick-inline-form quick-action-form" use:enhance={enhanceQuickField('nextAction')}>
          <input type="hidden" name="field" value="nextAction" />
          <input name="value" class="quick-text" bind:value={quickNextAction} on:change={submitQuickControl} on:keydown={submitQuickTextOnEnter} placeholder="Add next action" aria-label="Next action" />
          {#if quickSavingField === 'nextAction'}<span class="quick-feedback muted">Saving...</span>{:else if quickSavedField === 'nextAction'}<span class="quick-feedback saved">Saved</span>{/if}
        </form>
      </div>
      {#if quickFieldError}<div class="quick-field-error" role="alert">{quickFieldError}</div>{/if}
      {#if lead.description}<h3>Description</h3><p class="preline">{lead.description}</p>{/if}
      {#if lead.notes}<h3>Original notes</h3><p class="preline">{lead.notes}</p>{/if}
    </section>

    <section class="card panel">
      <h2>Convert or link</h2>
      <p class="muted small">Conversions create stronger CRM records while keeping this lead, notes, and tasks as history.</p>
      <div class="button-grid">
        {#if lead.contactId}
          <a class="chip" href={`/contacts/${lead.contactId}`}>Contact exists</a>
        {:else}
          <form method="post" action="?/convertToContact"><button class="btn primary" type="submit">Convert to contact</button></form>
        {/if}
        {#if lead.companyId}
          <a class="chip" href={`/companies/${lead.companyId}`}>Company exists</a>
        {:else}
          <form method="post" action="?/convertToCompany"><button class="btn primary" type="submit">Convert to company</button></form>
        {/if}
        <form method="post" action="?/convertToDeal"><button class="btn" type="submit">Convert to deal</button></form>
        <form method="post" action="?/convertToWant"><button class="btn" type="submit">Convert to want</button></form>
        <form method="post" action="?/convertToOffer"><button class="btn" type="submit">Convert to offer</button></form>
      </div>

      <h3>Linked records</h3>
      <div class="details-grid">
        <strong>Contact</strong><span>{#if lead.contactId}<a href={`/contacts/${lead.contactId}`}>{lead.linkedContactName || 'Open contact'}</a>{:else} - {/if}</span>
        <strong>Company</strong><span>{#if lead.companyId}<a href={`/companies/${lead.companyId}`}>{lead.linkedCompanyName || 'Open company'}</a>{:else} - {/if}</span>
        <strong>Deal</strong><span>{#if lead.dealId}<a href={`/deals/${lead.dealId}`}>{lead.linkedDealTitle || 'Open deal'}</a>{:else} - {/if}</span>
        <strong>Project</strong><span>{#if lead.projectId}<a href={`/projects/${lead.projectId}`}>{lead.linkedProjectTitle || 'Open project'}</a>{:else} - {/if}</span>
        <strong>Workstream</strong><span>{lead.linkedWorkstreamTitle || ' - '}</span>
        <strong>Want</strong><span>{#if lead.wantId}<a href={`/wants/${lead.wantId}`}>{lead.linkedWantTitle || 'Open want'}</a>{:else} - {/if}</span>
        <strong>Offer</strong><span>{#if lead.offerId}<a href={`/offers/${lead.offerId}`}>{lead.linkedOfferTitle || 'Open offer'}</a>{:else} - {/if}</span>
      </div>
      {#if lead.companyId}
        <form method="post" action="?/unlinkCompany" on:submit={(e) => { if (!confirm('Unlink this lead from the company?')) e.preventDefault(); }}><button class="btn" type="submit">Unlink company</button></form>
      {:else}
        <details class="nested-form">
          <summary>Link to existing company</summary>
          <form method="post" action="?/linkCompany">
            <div class="field"><label for="companySearch">Search companies</label><input id="companySearch" bind:value={companySearch} placeholder="Type company, phone or website" /></div>
            <div class="field"><label for="companyId">Company</label><select id="companyId" name="companyId" required size={Math.min(8, Math.max(3, filteredCompanies.length || 3))}><option value="">Select company</option>{#each filteredCompanies as company}<option value={company.id}>{company.name}{company.website ? ` - ${company.website}` : ''}</option>{/each}</select></div>
            {#if filteredCompanies.length}
              <div class="mini-list compact-list">
                {#each filteredCompanies.slice(0, 8) as company}
                  <div class="mini-row compact-row"><div><strong>{company.name}</strong><div class="muted small">{company.phone || ''}{company.phone && company.website ? ' - ' : ''}{company.website || ''}</div></div><a class="btn" href={`/companies/${company.id}`} target="_blank" rel="noreferrer">Open</a></div>
                {/each}
              </div>
            {/if}
            <button class="btn primary" type="submit">Link company</button>
          </form>
        </details>
      {/if}
      {#if lead.convertedAt}<p class="muted small">Converted on {fmt(lead.convertedAt)}</p>{/if}
      <form method="post" action="?/archive" on:submit={(e) => { if (!confirm('Archive this lead?')) e.preventDefault(); }}><button class="btn danger" type="submit">Archive lead</button></form>
    </section>
  </div>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit lead</h2>
      <form method="post" action="?/update" class="create-form">
        <input type="hidden" name="returnTo" value={data.returnTo || '/leads'} />
        <div class="grid two">
          <div class="field"><label for="title">Lead title</label><input id="title" name="title" value={lead.title} /></div>
          <div class="field"><label for="typeEdit">Lead type</label><select id="typeEdit" name="type">{#each data.leadTypes as opt}<option value={opt.value} selected={lead.type === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="statusEdit">Status</label><select id="statusEdit" name="status">{#each data.leadStatuses as opt}<option value={opt.value} selected={lead.status === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceChoiceEdit">Source</label><select id="sourceChoiceEdit" name="sourceChoice" bind:value={editSourceChoice}>{#each data.leadSourceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="commEdit">Usual communication</label><select id="commEdit" name="usualCommunicationMethod">{#each data.communicationMethods as opt}<option value={opt.value} selected={quickCommunicationMethod === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        {#if editSourceChoice === 'CUSTOM'}
          <div class="field"><label for="newLeadSourceEdit">Custom source</label><input id="newLeadSourceEdit" name="newLeadSource" placeholder="e.g. Sam spreadsheet, MFAA list" /></div>
        {/if}
        <div class="grid three">
          <div class="field"><label for="contactAttemptEdit">Contact attempt</label><select id="contactAttemptEdit" name="contactAttemptStatus">{#each data.contactAttemptStatuses as opt}<option value={opt.value} selected={quickContactAttemptStatus === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="buyerStatusEdit">Buyer status</label><select id="buyerStatusEdit" name="buyerStatus">{#each data.buyerQualificationStatuses as opt}<option value={opt.value} selected={quickBuyerStatus === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sellerStatusEdit">Seller status</label><select id="sellerStatusEdit" name="sellerStatus">{#each data.sellerQualificationStatuses as opt}<option value={opt.value} selected={quickSellerStatus === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="lastContactedAtEdit">Last contacted</label><input id="lastContactedAtEdit" name="lastContactedAt" type="datetime-local" value={quickLastContactedAt} on:change={closeDatePickerOnChange} /></div>
        <div class="grid two"><div class="field"><label for="projectIdEdit">Project</label><select id="projectIdEdit" name="projectId"><option value="">Standalone lead</option>{#each data.projects as project}<option value={project.id} selected={(lead.projectId || '') === project.id}>{project.title}</option>{/each}</select></div><div class="field"><label for="workstreamIdEdit">Workstream</label><select id="workstreamIdEdit" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id} selected={(lead.workstreamId || '') === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div></div>
        <div class="grid two"><div class="field"><label for="name">Person name</label><input id="name" name="name" value={lead.name} /></div><div class="field"><label for="companyName">Company name</label><input id="companyName" name="companyName" value={lead.companyName} /></div></div>
        <div class="grid two"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value={lead.email} /></div><div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value={lead.phone} /></div></div>
        <div class="grid two"><div class="field"><label for="website">Website</label><input id="website" name="website" value={lead.website} /></div><div class="field"><label for="linkedin">LinkedIn</label><input id="linkedin" name="linkedin" value={lead.linkedin} /></div></div>
        <div class="grid two"><div class="field"><label for="roleTitle">Role/title</label><input id="roleTitle" name="roleTitle" value={lead.roleTitle} /></div><div class="field"><label for="geography">Geography</label><input id="geography" name="geography" value={lead.geography} /></div></div>
        <div class="field"><label for="address">Address</label><input id="address" name="address" value={lead.address} /></div>
        <div class="grid three"><div class="field"><label for="priority">Priority</label><input id="priority" name="priority" type="number" min="1" max="5" value={quickPriority} /></div><div class="field"><label for="confidence">Confidence</label><input id="confidence" name="confidence" type="number" min="0" max="100" value={quickConfidence} /></div><div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value={lead.currency} /></div></div>
        <div class="grid two"><div class="field"><label for="valueMin">Minimum value ($m)</label><input id="valueMin" name="valueMin" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={lead.valueMin} /></div><div class="field"><label for="valueMax">Maximum value ($m)</label><input id="valueMax" name="valueMax" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={lead.valueMax} /></div></div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{lead.description}</textarea></div>
        <div class="field"><label for="notes">Original notes</label><textarea id="notes" name="notes" rows="3">{lead.notes}</textarea></div>
        <div class="grid two"><div class="field"><label for="sourceUrl">Source URL</label><input id="sourceUrl" name="sourceUrl" value={lead.sourceUrl} /></div><div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={quickNextAction} /></div></div>
        <button class="btn primary" type="submit">Save lead</button>
      </form>
    </section>
  {/if}

  <section class="card panel">
    <details open>
      <summary><strong>Lead notes</strong></summary>
      <form method="post" action="?/createLeadNote" class="nested-form">
        <input type="hidden" name="returnTo" value={data.returnTo || '/leads'} />
        <div class="grid two">
          <div class="field"><label for="leadNoteChannel">Channel</label><select id="leadNoteChannel" name="channel">{#each data.noteChannels as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadNoteOccurredAt">Note date</label><input id="leadNoteOccurredAt" name="occurredAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
        </div>
        <VoiceTextField
          id="leadNote"
          textName="body"
          summaryName="summary"
          label="Add lead note"
          placeholder="Record or type research, calls, source context, or qualification notes."
          rows={4}
          bind:value={leadNoteText}
          bind:summary={leadNoteSummary}
          contextLabel="lead note"
        />
        <button class="btn primary" type="submit">Save note</button>
      </form>
      {#if data.leadNotes?.length}
        <div class="mini-list">
          {#each data.leadNotes as note}
            <div class="mini-row">
              <div>
                <div class="muted small"><span class="status-chip">{note.channelLabel}</span> {fmt(note.occurredAt)}</div>
                <p class="preline small">{note.body}</p>
                {#if note.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{note.summary}</p></div>{/if}
                <details class="edit-note">
                  <summary>Edit note</summary>
                  <form method="post" action="?/updateLeadNote" class="nested-form">
                    <input type="hidden" name="returnTo" value={data.returnTo || '/leads'} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <div class="grid two">
                      <div class="field"><label for={`noteChannel-${note.id}`}>Channel</label><select id={`noteChannel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
                      <div class="field"><label for={`noteOccurred-${note.id}`}>Note date</label><input id={`noteOccurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} on:change={closeDatePickerOnChange} /></div>
                    </div>
                    <div class="field"><label for={`noteBody-${note.id}`}>Note</label><textarea id={`noteBody-${note.id}`} name="body" rows="4">{note.body}</textarea></div>
                    <div class="field"><label for={`noteSummary-${note.id}`}>Summary</label><textarea id={`noteSummary-${note.id}`} name="summary" rows="2">{note.summary}</textarea></div>
                    <div class="actions small-actions"><button class="btn primary" type="submit">Save note changes</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
                  </form>
                </details>
              </div>
              <form method="post" action="?/deleteLeadNote" on:submit={(event) => { if (!confirm('Delete this lead note?')) event.preventDefault(); }}>
                <input type="hidden" name="returnTo" value={data.returnTo || '/leads'} />
                <input type="hidden" name="noteId" value={note.id} />
                <button class="btn" type="submit">Delete</button>
              </form>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No lead notes yet.</p>
      {/if}
    </details>
  </section>

  <TasksPanel
    tasks={data.leadTasks}
    heading="Lead tasks"
    emptyMessage="No lead tasks yet."
    taskTypeOptions={data.taskTypes}
    taskStatusOptions={data.taskStatuses}
    taskUrgencyOptions={data.taskUrgencies}
    taskImportanceOptions={data.taskImportances}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/leads/${lead.id}`}
    showDelete
    inboxHref="/tasks"
    inboxLabel="Task inbox"
    lockedMarketLeadId={lead.id}
    lockedWorkstreamId={lead.workstreamId || ''}
    contactOptions={data.taskContactOptions}
    workstreamOptions={data.workstreams}
    dealContactOptions={data.taskDealContactOptions}
    dealCompanyOptions={data.taskDealCompanyOptions}
  />
</div>

<style>
  .container { padding: 12px; }
  .page-head, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .actions { justify-content: flex-start; align-items: center; }
  h1, h2, h3 { margin-top: 0; } h2 { font-size: 1.15rem; } h3 { font-size: 1rem; margin-bottom: 6px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .priority-inline-wrap { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .priority-stepper { display: inline-flex; align-items: center; gap: 5px; margin: 0; }
  .priority-value { min-width: 34px; text-align: center; font-size: 0.95rem; }
  .priority-value span { color: var(--muted); font-weight: 500; font-size: 0.8rem; }
  .priority-step { width: 24px; height: 24px; display: inline-grid; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 7px; background: var(--panel); color: var(--text); cursor: pointer; font-size: 0.72rem; line-height: 1; }
  .priority-step:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .priority-step:disabled { cursor: default; opacity: 0.35; }
  .priority-feedback { font-size: 0.78rem; min-width: 42px; }
  .priority-feedback.saved { color: var(--accent); }
  .priority-error { color: var(--danger); font-size: 0.8rem; }
  .quick-inline-form { display: flex; align-items: center; gap: 7px; margin: 0; min-width: 0; flex-wrap: wrap; }
  .quick-inline-form select, .quick-inline-form input { margin: 0; }
  .quick-select { width: min(100%, 280px); min-height: 34px; }
  .quick-date { width: min(100%, 250px); min-height: 34px; }
  .quick-number-wrap { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
  .quick-number { width: 76px; min-height: 34px; }
  .quick-action-form { width: 100%; }
  .quick-text { width: min(100%, 520px); min-height: 34px; flex: 1 1 260px; }
  .quick-feedback { font-size: 0.78rem; min-width: 42px; }
  .quick-feedback.saved { color: var(--accent); }
  .quick-field-error { color: var(--danger); font-size: 0.85rem; margin: 8px 0; }
  .muted { color: var(--muted); } .small { font-size: 0.9rem; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .panel, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .details-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px 12px; margin: 10px 0; }
  .button-grid { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 18px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .preline { white-space: pre-wrap; }
  .btn.danger { background:#b00020; color:#fff; border-color:#b00020; }
  details summary { cursor: pointer; margin-bottom: 10px; }
  .nested-form { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .mini-list { display: grid; gap: 8px; }
  .mini-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 9px; font-size: 0.85rem; color: var(--muted); }
  .chip { display: inline-flex; align-items: center; color: var(--text); text-decoration: none; padding: 10px 14px; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) { .page-head, .mini-row { flex-direction: column; } .grid.two, .grid.three, .details-grid { grid-template-columns: 1fr; } }
  .compact-list { margin: 8px 0; }
  .compact-row { padding: 8px 0; }
</style>
