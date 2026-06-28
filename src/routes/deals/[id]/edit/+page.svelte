<!-- src/routes/deals/[id]/edit/+page.svelte -->
<script lang="ts">
  // PURPOSE: Edit a deal using server-provided decrypted values.
  // SECURITY: No decryption happens in this client component.
  export let data: {
    statusOptions: Array<{ value: string; label: string }>;
    deal: {
      id: string;
      title: string;
      description: string;
      value: string;
      currency: string;
      status: string;
      probability: number | null;
      expectedCloseDate: string;
      lostReason: string;
    };
  };
  export let form;

  function confirmDelete(event: SubmitEvent) {
    if (!confirm('Delete this deal permanently?')) event.preventDefault();
  }
</script>

<div class="container">
  <div class="card form-card">
    <div class="header-row">
      <div>
        <div class="eyebrow">Edit deal</div>
        <h1>{data.deal.title}</h1>
      </div>
      <span class="deal-icon" aria-hidden="true">◆</span>
    </div>

    <form method="post">
      <div class="field">
        <label for="title">Deal title</label>
        <input id="title" name="title" required value={data.deal.title} />
      </div>

      <div class="field">
        <label for="description">Notes</label>
        <textarea id="description" name="description" rows="6">{data.deal.description}</textarea>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="value">Estimated value</label>
          <input id="value" name="value" inputmode="decimal" value={data.deal.value} />
        </div>
        <div class="field">
          <label for="currency">Currency</label>
          <input id="currency" name="currency" maxlength="3" value={data.deal.currency} />
        </div>
      </div>

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
          <input id="expectedCloseDate" name="expectedCloseDate" type="date" value={data.deal.expectedCloseDate} />
        </div>
      </div>

      <div class="field">
        <label for="lostReason">Lost reason</label>
        <input id="lostReason" name="lostReason" placeholder="Only used if state is Lost" value={data.deal.lostReason} />
      </div>

      <div class="actions">
        <button class="btn primary" type="submit">Save changes</button>
        <a class="btn" href={`/deals/${data.deal.id}`}>Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}

    <hr />

    <form method="post" action={`/deals/${data.deal.id}/delete`} on:submit={confirmDelete}>
      <button class="btn danger" type="submit">Delete deal</button>
    </form>
  </div>
</div>

<style>
  .form-card { padding: 20px; max-width: 820px; margin: 0 auto; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  h1 { margin: 0; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .deal-icon { color: var(--accent-2); font-size: 2rem; line-height: 1; }
  .grid { display: grid; gap: 12px; }
  .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  textarea { resize: vertical; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .error { color: var(--danger); margin-top: 12px; }
  .danger { background: var(--danger); border-color: var(--danger); color: white; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 20px 0; }
  @media (max-width: 720px) {
    .grid.two, .grid.three { grid-template-columns: 1fr; }
    .actions { flex-direction: column; }
  }
</style>
