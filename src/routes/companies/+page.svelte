<!-- src/routes/companies/+page.svelte -->
<script lang="ts">
  // PURPOSE: Company index for broker-style acquirer/vendor/advisor records.
  export let data: any;
  export let form: any;

  let showCreate = Boolean(form?.values || form?.duplicateWarning);
  let q = data.q || '';
  let status = data.selectedStatus || '';
  let kind = data.selectedKind || '';
  $: duplicateWarning = form?.duplicateWarning;

  function submitContainingForm(event: Event) {
    const formEl = (event.currentTarget as HTMLSelectElement).closest('form');
    if (formEl) formEl.requestSubmit();
  }
</script>

<div class="container">
  <header class="page-head">
    <div>
      <div class="eyebrow">Companies</div>
      <h1>Companies</h1>
      <p class="muted">Track acquirers, vendors, brokers, advisory firms, funds, and company groups.</p>
    </div>
    <button class="btn primary" type="button" on:click={() => (showCreate = !showCreate)}>{showCreate ? 'Cancel' : 'New company'}</button>
  </header>

  {#if form?.error}
    <div class="card error-card">{form.error}</div>
  {/if}

  {#if showCreate}
    <section class="card panel">
      <h2>Create company</h2>

      {#if duplicateWarning}
        <section class="duplicate-warning" aria-live="polite">
          <h3>{duplicateWarning.title}</h3>
          <p>{duplicateWarning.message}</p>
          <div class="duplicate-list">
            {#each duplicateWarning.matches as match}
              <article class="duplicate-card">
                <div>
                  <strong>{match.label}</strong>
                  {#if match.industry}<div class="muted small">{match.industry}</div>{/if}
                  {#if match.location}<div class="muted small">{match.location}</div>{/if}
                  {#if match.website}<div class="muted small">{match.website}</div>{/if}
                  {#if match.phone}<div class="muted small">{match.phone}</div>{/if}
                  {#if match.matchReasons?.length}
                    <div class="reason-row">{#each match.matchReasons as reason}<span class="reason-chip">{reason}</span>{/each}</div>
                  {/if}
                </div>
                <a class="btn" href={match.href} target="_blank" rel="noreferrer">Open</a>
              </article>
            {/each}
          </div>
          <p class="muted small">Opening an existing company uses a new tab so you do not lose this form.</p>
        </section>
      {/if}

      <form method="post" action="?/create" class="create-form">
        {#if duplicateWarning}<input type="hidden" name="forceCreate" value="1" />{/if}
        <div class="grid two">
          <div class="field"><label for="name">Company name</label><input id="name" name="name" required value={form?.values?.name || ''} /></div>
          <div class="field"><label for="website">Website</label><input id="website" name="website" placeholder="https://..." value={form?.values?.website || ''} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" placeholder="Main phone number" value={form?.values?.phone || ''} /></div>
          <div class="field"><label for="tags">Tags</label><input id="tags" name="tags" placeholder="mortgage broker, aged care, buyer" value={form?.values?.tags || ''} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="kindCreate">Type</label><select id="kindCreate" name="kind">{#each data.companyKinds as opt}<option value={opt.value} selected={(form?.values?.kind || 'OPERATING_BUSINESS') === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="statusCreate">Status</label><select id="statusCreate" name="status">{#each data.companyStatuses as opt}<option value={opt.value} selected={(form?.values?.status || 'ACTIVE') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="industry">Industry</label><input id="industry" name="industry" placeholder="e.g. healthcare, trades, childcare" value={form?.values?.industry || ''} /></div>
          <div class="field"><label for="location">Location</label><input id="location" name="location" placeholder="e.g. Melbourne, Australia" value={form?.values?.location || ''} /></div>
        </div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3" placeholder="What they do and why they matter">{form?.values?.description || ''}</textarea></div>
        <div class="field"><label for="notes">Internal notes</label><textarea id="notes" name="notes" rows="3">{form?.values?.notes || ''}</textarea></div>
        <button class="btn primary" type="submit">{duplicateWarning ? 'Create anyway' : 'Save company'}</button>
      </form>
    </section>
  {/if}

  <section class="card filters">
    <form method="GET" class="filter-row">
      <input name="q" bind:value={q} placeholder="Search companies, sectors, tags, phone, locations" />
      <select name="kind" bind:value={kind}>
        <option value="">All types</option>
        {#each data.companyKinds as opt}<option value={opt.value}>{opt.label}</option>{/each}
      </select>
      <select name="status" bind:value={status}>
        <option value="">All statuses</option>
        {#each data.companyStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}
      </select>
      <button class="btn primary" type="submit">Filter</button>
    </form>
  </section>

  {#if data.companies.length === 0}
    <section class="card empty"><h2>No companies yet</h2><p class="muted">Create a likely acquirer, vendor business, broker firm, or fund to start building the company graph.</p></section>
  {:else}
    <div class="company-list">
      {#each data.companies as company}
        <article class="card company-card">
          <div class="company-main">
            <div class="title-row">
              <h2><a href={`/companies/${company.id}`}>{company.name}</a></h2>
              <span class="status-chip">{company.kindLabel}</span>
              <span class="status-chip">{company.statusLabel}</span>
            </div>
            <div class="muted small">
              {#if company.industry}{company.industry}{/if}{#if company.industry && company.location} - {/if}{#if company.location}{company.location}{/if}
            </div>
            {#if company.website}<div class="muted small">{company.website}</div>{/if}
            {#if company.phone}<div class="muted small">{company.phone}</div>{/if}
            {#if company.tags?.length}<div class="tag-row">{#each company.tags as tag}<span class="status-chip">{tag}</span>{/each}</div>{/if}
            {#if company.description}<p class="preline">{company.description}</p>{/if}
            <div class="muted small">{company.contactCount} contact{company.contactCount === 1 ? '' : 's'} - {company.dealCount} deal{company.dealCount === 1 ? '' : 's'} - {company.taskCount} task{company.taskCount === 1 ? '' : 's'}</div>
          </div>
          <div class="card-actions">
            <a class="btn" href={`/companies/${company.id}`}>Open</a>
            <form method="post" action="?/updateStatus">
              <input type="hidden" name="companyId" value={company.id} />
              <select name="status" aria-label="Update company status" on:change={submitContainingForm}>
                {#each data.companyStatuses as opt}<option value={opt.value} selected={company.status === opt.value}>{opt.label}</option>{/each}
              </select>
            </form>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container { padding: 12px; }
  .page-head, .company-card, .title-row, .filter-row, .card-actions { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
  .title-row { justify-content: flex-start; align-items: center; flex-wrap: wrap; }
  .tag-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .filter-row, .card-actions { align-items: center; flex-wrap: wrap; }
  h1, h2 { margin: 0; }
  h2 { font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .panel, .filters, .empty, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .duplicate-warning { border: 1px solid #f0c36a; background: #fff8e5; border-radius: 12px; padding: 14px; margin: 12px 0 16px; }
  .duplicate-warning h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .duplicate-list { display: grid; gap: 8px; margin-top: 10px; }
  .duplicate-card { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; border: 1px solid rgba(0,0,0,0.08); background: white; border-radius: 10px; padding: 10px; }
  .reason-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .reason-chip { border: 1px solid rgba(0,0,0,0.12); border-radius: 999px; padding: 2px 7px; font-size: 0.8rem; background: #fafafa; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .company-list { display: grid; gap: 10px; }
  .company-card { padding: 14px; }
  .company-main { min-width: 0; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 8px; font-size: 0.82rem; color: var(--muted); }
  .preline { white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .page-head, .company-card, .filter-row, .card-actions { flex-direction: column; align-items: stretch; }
    .grid.two { grid-template-columns: 1fr; }
  }
</style>
