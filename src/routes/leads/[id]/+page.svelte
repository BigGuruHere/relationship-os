<!-- src/routes/leads/[id]/+page.svelte -->
<script lang="ts">
  export let data: any;
  export let form: any;

  const lead = data.lead;
  let showEdit = false;
</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Lead</div>
      <h1>{lead.title}</h1>
      <p class="muted">{lead.typeLabel} - {lead.statusLabel} - {lead.sourceLabel}</p>
    </div>
    <div class="actions">
      <a class="btn" href="/leads">All leads</a>
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
        <strong>Email</strong><span>{lead.email || ' - '}</span>
        <strong>Phone</strong><span>{lead.phone || ' - '}</span>
        <strong>Website</strong><span>{lead.website || ' - '}</span>
        <strong>LinkedIn</strong><span>{lead.linkedin || ' - '}</span>
        <strong>Geography</strong><span>{lead.geography || ' - '}</span>
        <strong>Usual communication</strong><span>{lead.usualCommunicationMethodLabel}</span>
        <strong>Priority</strong><span>{lead.priority}/5</span>
        <strong>Confidence</strong><span>{lead.confidence}/100</span>
        <strong>Next action</strong><span>{lead.nextAction || ' - '}</span>
      </div>
      {#if lead.description}<h3>Description</h3><p class="preline">{lead.description}</p>{/if}
      {#if lead.notes}<h3>Notes</h3><p class="preline">{lead.notes}</p>{/if}
    </section>

    <section class="card panel">
      <h2>Convert or link</h2>
      <p class="muted small">Conversions create stronger CRM records while keeping this lead as history.</p>
      <div class="button-grid">
        <form method="post" action="?/convertToContact"><button class="btn primary" type="submit">Convert to contact</button></form>
        <form method="post" action="?/convertToCompany"><button class="btn primary" type="submit">Convert to company</button></form>
        <form method="post" action="?/convertToDeal"><button class="btn" type="submit">Convert to deal</button></form>
        <form method="post" action="?/convertToWant"><button class="btn" type="submit">Convert to want</button></form>
        <form method="post" action="?/convertToOffer"><button class="btn" type="submit">Convert to offer</button></form>
      </div>

      <h3>Linked records</h3>
      <div class="details-grid">
        <strong>Contact</strong><span>{#if lead.contactId}<a href={`/contacts/${lead.contactId}`}>{lead.linkedContactName || 'Open contact'}</a>{:else} - {/if}</span>
        <strong>Company</strong><span>{#if lead.companyId}<a href={`/companies/${lead.companyId}`}>{lead.linkedCompanyName || 'Open company'}</a>{:else} - {/if}</span>
        <strong>Deal</strong><span>{#if lead.dealId}<a href={`/deals/${lead.dealId}`}>{lead.linkedDealTitle || 'Open deal'}</a>{:else} - {/if}</span>
        <strong>Project</strong><span>{#if lead.projectId}{lead.linkedProjectTitle || 'Linked project'}{:else} - {/if}</span>
        <strong>Want/offer</strong><span>{#if lead.exchangeItemId}{lead.linkedExchangeTitle || 'Created'}{:else} - {/if}</span>
      </div>
      {#if lead.convertedAt}<p class="muted small">Converted on {new Date(lead.convertedAt).toLocaleString()}</p>{/if}
      <form method="post" action="?/archive" on:submit={(e) => { if (!confirm('Archive this lead?')) e.preventDefault(); }}><button class="btn danger" type="submit">Archive lead</button></form>
    </section>
  </div>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit lead</h2>
      <form method="post" action="?/update" class="create-form">
        <div class="grid two">
          <div class="field"><label for="title">Lead title</label><input id="title" name="title" value={lead.title} /></div>
          <div class="field"><label for="typeEdit">Lead type</label><select id="typeEdit" name="type">{#each data.leadTypes as opt}<option value={opt.value} selected={lead.type === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="statusEdit">Status</label><select id="statusEdit" name="status">{#each data.leadStatuses as opt}<option value={opt.value} selected={lead.status === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceEdit">Source</label><select id="sourceEdit" name="source">{#each data.leadSources as opt}<option value={opt.value} selected={lead.source === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="commEdit">Usual communication</label><select id="commEdit" name="usualCommunicationMethod">{#each data.communicationMethods as opt}<option value={opt.value} selected={(lead.usualCommunicationMethod || '') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two"><div class="field"><label for="name">Person name</label><input id="name" name="name" value={lead.name} /></div><div class="field"><label for="companyName">Company name</label><input id="companyName" name="companyName" value={lead.companyName} /></div></div>
        <div class="grid two"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value={lead.email} /></div><div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value={lead.phone} /></div></div>
        <div class="grid two"><div class="field"><label for="website">Website</label><input id="website" name="website" value={lead.website} /></div><div class="field"><label for="linkedin">LinkedIn</label><input id="linkedin" name="linkedin" value={lead.linkedin} /></div></div>
        <div class="grid two"><div class="field"><label for="roleTitle">Role/title</label><input id="roleTitle" name="roleTitle" value={lead.roleTitle} /></div><div class="field"><label for="geography">Geography</label><input id="geography" name="geography" value={lead.geography} /></div></div>
        <div class="grid three"><div class="field"><label for="priority">Priority</label><input id="priority" name="priority" type="number" min="1" max="5" value={lead.priority} /></div><div class="field"><label for="confidence">Confidence</label><input id="confidence" name="confidence" type="number" min="0" max="100" value={lead.confidence} /></div><div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value={lead.currency} /></div></div>
        <div class="grid two"><div class="field"><label for="valueMin">Value min</label><input id="valueMin" name="valueMin" value={lead.valueMin} /></div><div class="field"><label for="valueMax">Value max</label><input id="valueMax" name="valueMax" value={lead.valueMax} /></div></div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{lead.description}</textarea></div>
        <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes" rows="3">{lead.notes}</textarea></div>
        <div class="grid two"><div class="field"><label for="sourceUrl">Source URL</label><input id="sourceUrl" name="sourceUrl" value={lead.sourceUrl} /></div><div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={lead.nextAction} /></div></div>
        <button class="btn primary" type="submit">Save lead</button>
      </form>
    </section>
  {/if}
</div>

<style>
  .container { padding: 12px; }
  .page-head, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  h1, h2, h3 { margin-top: 0; } h2 { font-size: 1.15rem; } h3 { font-size: 1rem; margin-bottom: 6px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
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
  @media (max-width: 860px) { .grid.two, .grid.three, .details-grid { grid-template-columns: 1fr; } }
</style>
