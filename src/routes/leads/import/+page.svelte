<script lang="ts">
  // PURPOSE: Client-side CSV preview and column mapping. The server reparses the file before writing.
  import { guessCsvHeader, parseCsv } from '$lib/csv';

  export let data: any;
  export let form: any;

  let headers: string[] = [];
  let previewRows: string[][] = [];
  let parseError = '';
  let fileName = '';

  let mapCompanyName = '';
  let mapExternalCode = '';
  let mapCompanyPhone = '';
  let mapWebsite = '';
  let mapGeography = '';
  let mapPersonName = '';
  let mapRoleTitle = '';
  let mapEmail = '';
  let mapPhone = '';
  let mapResearch = '';
  let mapResearchProvider = '';
  let mapResearchDate = '';
  let mapSourceUrl = '';

  async function inspectFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    parseError = '';
    headers = [];
    previewRows = [];
    fileName = file?.name || '';
    if (!file) return;

    try {
      const table = parseCsv(await file.text());
      headers = table.headers;
      previewRows = table.rows.slice(0, 8);

      // IT: Guess common spreadsheet headings but always leave the mapping visible for human review.
      mapCompanyName = guessCsvHeader(headers, ['company name', 'business name', 'organisation name', 'organization name', 'provider name', 'rto name', 'legal name', 'name']);
      mapExternalCode = guessCsvHeader(headers, ['registration number', 'registration code', 'rto number', 'rto code', 'provider id', 'provider number', 'external id', 'registration id']);
      mapCompanyPhone = guessCsvHeader(headers, ['company phone', 'business phone', 'organisation phone', 'organization phone', 'provider phone', 'phone']);
      mapWebsite = guessCsvHeader(headers, ['website', 'web site', 'url']);
      mapGeography = guessCsvHeader(headers, ['state', 'location', 'geography', 'suburb', 'city']);
      mapPersonName = guessCsvHeader(headers, ['contact name', 'owner name', 'ceo name', 'director name', 'person name']);
      mapRoleTitle = guessCsvHeader(headers, ['role', 'role title', 'title', 'position']);
      mapEmail = guessCsvHeader(headers, ['email', 'contact email', 'owner email', 'ceo email']);
      mapPhone = guessCsvHeader(headers, ['contact phone', 'mobile', 'owner phone', 'ceo phone']);
      mapResearch = guessCsvHeader(headers, ['ai research', 'research', 'gpt research', 'claude research', 'research notes', 'analysis']);
      mapResearchProvider = guessCsvHeader(headers, ['research provider', 'ai provider', 'researcher', 'model']);
      mapResearchDate = guessCsvHeader(headers, ['research date', 'researched at', 'research timestamp', 'date researched']);
      mapSourceUrl = guessCsvHeader(headers, ['source url', 'registry url', 'profile url', 'record url']);
    } catch (error: any) {
      parseError = String(error?.message || 'Could not read CSV.');
    }
  }

  function previewValue(row: string[], header: string) {
    if (!header) return '';
    const index = headers.indexOf(header);
    return index >= 0 ? row[index] || '' : '';
  }
</script>

<div class="container">
  <header class="page-head">
    <div>
      <div class="eyebrow">Lead execution</div>
      <h1>Import hot leads</h1>
      <p class="muted">Upload only the slice you intend to work now. Relish will reuse companies by their external registration/reference and create a fresh lead history for each new batch.</p>
    </div>
    <a class="btn" href="/leads">Back to leads</a>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  {#if form?.success && form?.result}
    <section class="card success-card">
      <div class="topline">
        <div>
          <div class="eyebrow">Import complete</div>
          <h2>{form.result.batchName}</h2>
        </div>
        {#if form.batchUrl}<a class="btn primary" href={form.batchUrl}>Open this batch</a>{/if}
      </div>
      <div class="summary-grid">
        <div class="stat"><span>Rows</span><strong>{form.result.totalRows}</strong></div>
        <div class="stat"><span>New companies</span><strong>{form.result.createdCompanies}</strong></div>
        <div class="stat"><span>Matched companies</span><strong>{form.result.matchedCompanies}</strong></div>
        <div class="stat"><span>New leads</span><strong>{form.result.createdLeads}</strong></div>
        <div class="stat"><span>Research notes</span><strong>{form.result.researchNotesCreated}</strong></div>
        <div class="stat"><span>Already in batch</span><strong>{form.result.skippedExistingBatchLeads}</strong></div>
      </div>
      {#if form.result.failedRows?.length}
        <details open>
          <summary><strong>{form.result.failedRows.length} row(s) need attention</strong></summary>
          <div class="mini-list">
            {#each form.result.failedRows as failed}
              <div class="mini-row"><strong>Row {failed.rowNumber}</strong><span>{failed.companyName || '(no company)'} - {failed.externalCode || '(no code)'} - {failed.error}</span></div>
            {/each}
          </div>
        </details>
      {/if}
    </section>
  {/if}

  <form method="post" action="?/import" enctype="multipart/form-data" class="stack">
    <section class="card panel">
      <h2>1. Batch setup</h2>
      <div class="grid two">
        <div class="field">
          <label for="batchName">Batch / calling-list name</label>
          <input id="batchName" name="batchName" placeholder="RTO Hot 50 - Sep 2026 - Batch 1" required />
          <div class="muted small">This becomes a custom Lead Source, so you can filter the Leads page to this exact batch.</div>
        </div>
        <div class="field">
          <label for="externalScheme">External identifier scheme</label>
          <input id="externalScheme" name="externalScheme" list="identifierSchemes" placeholder="ASQA_RTO" required />
          <datalist id="identifierSchemes">
            <option value="ASQA_RTO"></option>
            <option value="AGED_CARE_PROVIDER"></option>
            <option value="ABN"></option>
            <option value="ACN"></option>
          </datalist>
          <div class="muted small">The scheme plus registration/reference code is the stable link back to your spreadsheet/source.</div>
        </div>
      </div>

      <div class="grid two">
        <div class="field"><label for="projectId">Project</label><select id="projectId" name="projectId"><option value="">Standalone leads</option>{#each data.projects as project}<option value={project.id}>{project.title}</option>{/each}</select></div>
        <div class="field"><label for="workstreamId">Workstream</label><select id="workstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div>
      </div>

      <div class="grid three">
        <div class="field"><label for="tags">Company tags</label><input id="tags" name="tags" placeholder="RTO, Victoria, Hot Lead" /></div>
        <div class="field"><label for="leadType">Lead type</label><select id="leadType" name="leadType">{#each data.leadTypes as opt}<option value={opt.value} selected={opt.value === 'COMPANY'}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="leadStatus">Initial status</label><select id="leadStatus" name="leadStatus">{#each data.leadStatuses as opt}<option value={opt.value} selected={opt.value === 'NOT_CONTACTED'}>{opt.label}</option>{/each}</select></div>
      </div>
      <div class="field short"><label for="priority">Priority 1-5</label><input id="priority" name="priority" type="number" min="1" max="5" value="3" /></div>
    </section>

    <section class="card panel">
      <h2>2. Upload CSV</h2>
      <div class="field">
        <label for="file">Selected hot-lead slice</label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required on:change={inspectFile} />
        <div class="muted small">Use the 50 or so leads you actually intend to call, not the full 2,000-3,000 row master list.</div>
      </div>
      {#if parseError}<div class="error-card">{parseError}</div>{/if}
      {#if headers.length}<div class="muted small">{fileName}: {headers.length} columns detected.</div>{/if}
    </section>

    {#if headers.length}
      <section class="card panel">
        <h2>3. Map spreadsheet columns</h2>
        <p class="muted">Relish has guessed common headings. Review them before importing. Company name and external code are required.</p>
        <div class="mapping-grid">
          <div class="field"><label for="mapCompanyName">Company name *</label><select id="mapCompanyName" name="mapCompanyName" bind:value={mapCompanyName} required><option value="">Choose column</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapExternalCode">Registration/reference code *</label><select id="mapExternalCode" name="mapExternalCode" bind:value={mapExternalCode} required><option value="">Choose column</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapCompanyPhone">Company phone</label><select id="mapCompanyPhone" name="mapCompanyPhone" bind:value={mapCompanyPhone}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapWebsite">Website</label><select id="mapWebsite" name="mapWebsite" bind:value={mapWebsite}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapGeography">State/location</label><select id="mapGeography" name="mapGeography" bind:value={mapGeography}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapPersonName">Person/contact name</label><select id="mapPersonName" name="mapPersonName" bind:value={mapPersonName}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapRoleTitle">Role/title</label><select id="mapRoleTitle" name="mapRoleTitle" bind:value={mapRoleTitle}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapEmail">Contact email</label><select id="mapEmail" name="mapEmail" bind:value={mapEmail}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapPhone">Contact phone</label><select id="mapPhone" name="mapPhone" bind:value={mapPhone}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapResearch">AI/pre-call research</label><select id="mapResearch" name="mapResearch" bind:value={mapResearch}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapResearchProvider">Research provider</label><select id="mapResearchProvider" name="mapResearchProvider" bind:value={mapResearchProvider}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapResearchDate">Research date</label><select id="mapResearchDate" name="mapResearchDate" bind:value={mapResearchDate}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
          <div class="field"><label for="mapSourceUrl">Source/registry URL</label><select id="mapSourceUrl" name="mapSourceUrl" bind:value={mapSourceUrl}><option value="">Not mapped</option>{#each headers as header}<option value={header}>{header}</option>{/each}</select></div>
        </div>
      </section>

      <section class="card panel">
        <h2>4. Preview</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Row</th><th>Company</th><th>External code</th><th>Person</th><th>Location</th><th>Research</th></tr></thead>
            <tbody>
              {#each previewRows as row, index}
                <tr>
                  <td>{index + 2}</td>
                  <td>{previewValue(row, mapCompanyName)}</td>
                  <td>{previewValue(row, mapExternalCode)}</td>
                  <td>{previewValue(row, mapPersonName)}</td>
                  <td>{previewValue(row, mapGeography)}</td>
                  <td class="research-preview">{previewValue(row, mapResearch)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="muted small">Research is appended as a dated Research note on the new lead. Re-importing the same company in a later batch creates a new lead and a new research note without overwriting the old history.</p>
        <button class="btn primary" type="submit" disabled={!mapCompanyName || !mapExternalCode}>Import selected leads</button>
      </section>
    {/if}
  </form>
</div>

<style>
  .container { padding: 12px; }
  .page-head, .topline { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
  h1, h2 { margin:0; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
  .muted { color:var(--muted); }
  .small { font-size:.9rem; }
  .stack { display:grid; gap:12px; }
  .panel, .success-card { padding:14px; }
  .error-card { color:var(--danger); padding:10px; }
  .grid.two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .grid.three { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .mapping-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field.short { max-width:180px; }
  .summary-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; margin:12px 0; }
  .stat { border:1px solid var(--border); border-radius:8px; padding:10px; display:grid; gap:4px; }
  .stat span { color:var(--muted); font-size:.82rem; }
  .stat strong { font-size:1.35rem; }
  .table-wrap { overflow:auto; }
  table { width:100%; border-collapse:collapse; min-width:760px; }
  th, td { text-align:left; vertical-align:top; border-bottom:1px solid var(--border); padding:8px; }
  th { color:var(--muted); font-size:.82rem; }
  .research-preview { max-width:420px; white-space:normal; }
  .mini-list { display:grid; gap:6px; margin-top:10px; }
  .mini-row { display:grid; grid-template-columns:90px 1fr; gap:10px; }
  @media (max-width:900px) { .grid.two, .grid.three, .mapping-grid, .summary-grid { grid-template-columns:1fr; } .page-head, .topline { flex-direction:column; } }
</style>
