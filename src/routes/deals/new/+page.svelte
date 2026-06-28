<!-- src/routes/deals/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: Render the create deal form.
  // SECURITY: Server validates and encrypts the stored deal fields.
  export let data: {
    statusOptions: Array<{ value: string; label: string }>;
    relationshipOptions: Array<{ value: string; label: string }>;
    contactOptions: Array<{ id: string; name: string }>;
  };
  export let form;

  type DealFormValues = {
    title?: string;
    description?: string;
    value?: string;
    currency?: string;
    status?: string;
    probability?: string | number;
    expectedCloseDate?: string;
    firstContactId?: string;
    relationshipType?: string;
    label?: string;
  };

  const values: DealFormValues = form?.values || {};
</script>

<div class="container">
  <div class="card form-card">
    <div class="header-row">
      <div>
        <div class="eyebrow">New opportunity</div>
        <h1>Add deal</h1>
        <p class="muted">Start with the deal, then attach the people and the role they play.</p>
      </div>
      <span class="deal-icon" aria-hidden="true">◆</span>
    </div>

    <form method="post" action="?/create">
      <div class="field">
        <label for="title">Deal title</label>
        <input id="title" name="title" required placeholder="e.g. ACME advisory engagement" value={values.title || ''} />
      </div>

      <div class="field">
        <label for="description">Notes</label>
        <textarea id="description" name="description" rows="5" placeholder="What is the opportunity, where did it come from, and what has to happen next?">{values.description || ''}</textarea>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="value">Estimated value</label>
          <input id="value" name="value" inputmode="decimal" placeholder="25000" value={values.value || ''} />
        </div>
        <div class="field">
          <label for="currency">Currency</label>
          <input id="currency" name="currency" maxlength="3" value={values.currency || 'AUD'} />
        </div>
      </div>

      <div class="grid three">
        <div class="field">
          <label for="status">State</label>
          <select id="status" name="status">
            {#each data.statusOptions as opt}
              <option value={opt.value} selected={(values.status || 'DISCOVERY') === opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="probability">Chance of closing %</label>
          <input id="probability" name="probability" type="number" min="0" max="100" value={values.probability ?? ''} />
        </div>
        <div class="field">
          <label for="expectedCloseDate">Expected close</label>
          <input id="expectedCloseDate" name="expectedCloseDate" type="date" value={values.expectedCloseDate || ''} />
        </div>
      </div>

      <hr />

      <h2>First relationship</h2>
      <p class="muted">Optional. You can add more people after creating the deal.</p>

      <div class="field">
        <label for="firstContactId">Attach contact</label>
        <select id="firstContactId" name="firstContactId">
          <option value="">No contact yet</option>
          {#each data.contactOptions as contact}
            <option value={contact.id} selected={values.firstContactId === contact.id}>{contact.name}</option>
          {/each}
        </select>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="relationshipType">Role in deal</label>
          <select id="relationshipType" name="relationshipType">
            {#each data.relationshipOptions as opt}
              <option value={opt.value} selected={(values.relationshipType || '') === opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="label">Custom label</label>
          <input id="label" name="label" placeholder="e.g. introducer, sponsor" value={values.label || ''} />
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" type="submit">Save deal</button>
        <a class="btn" href="/deals">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}
  </div>
</div>

<style>
  .form-card { padding: 20px; max-width: 820px; margin: 0 auto; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  h1 { margin: 0; }
  h2 { margin: 0 0 6px; font-size: 1.05rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .deal-icon { color: var(--accent-2); font-size: 2rem; line-height: 1; }
  .grid { display: grid; gap: 12px; }
  .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  textarea { resize: vertical; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 18px 0; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .error { color: var(--danger); margin-top: 12px; }
  @media (max-width: 720px) {
    .grid.two, .grid.three { grid-template-columns: 1fr; }
    .actions { flex-direction: column; }
  }
</style>
