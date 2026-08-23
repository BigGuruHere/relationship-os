<!-- src/lib/ExchangeItemsPanel.svelte -->
<script lang="ts">
  // PURPOSE: Reusable entity-local Wants & Offers panel.
  // SECURITY: Submit goes to the current page server action, which tenant-scopes and encrypts values.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';
  import {
    EXCHANGE_CONFIDENCES,
    EXCHANGE_DIRECTIONS,
    EXCHANGE_STATUSES,
    EXCHANGE_TIME_HORIZONS,
    EXCHANGE_TYPES,
    EXCHANGE_URGENCIES
  } from '$lib/exchange';

  export let items: any[] = [];
  export let entityLabel = 'this record';
  export let title = 'Wants & offers';

  let showForm = false;
  let description = '';
  let summary = '';

  function fmtDate(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString();
  }

  function valueRange(item: any) {
    if (item.valueMinLabel && item.valueMaxLabel) return `${item.valueMinLabel} to ${item.valueMaxLabel}`;
    if (item.valueMinLabel) return `From ${item.valueMinLabel}`;
    if (item.valueMaxLabel) return `Up to ${item.valueMaxLabel}`;
    return '';
  }
</script>

<section class="card exchange-panel">
  <div class="section-head">
    <div>
      <h2>{title}</h2>
      <p class="muted small">Record what {entityLabel} needs, wants, can offer, or is open to.</p>
    </div>
    <button class="btn" type="button" on:click={() => (showForm = !showForm)}>{showForm ? 'Cancel' : 'Add want/offer'}</button>
  </div>

  {#if showForm}
    <form method="post" action="?/createExchangeItem" class="nested-form exchange-form">
      <div class="grid three">
        <div class="field">
          <label for="exchangeType">Type</label>
          <select id="exchangeType" name="exchangeType">
            {#each EXCHANGE_TYPES as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="direction">Direction</label>
          <select id="direction" name="direction">
            {#each EXCHANGE_DIRECTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="category">Category</label>
          <input id="category" name="category" placeholder="e.g. capital, buyer, intro, talent" />
        </div>
      </div>

      <div class="field">
        <label for="exchangeTitle">Title</label>
        <input id="exchangeTitle" name="exchangeTitle" placeholder="e.g. Wants NDIS acquisition targets" required />
      </div>

      <VoiceTextField
        id="exchangeDescription"
        textName="exchangeDescription"
        summaryName="exchangeSummary"
        label="Description"
        placeholder="Record or type the want/offer in plain English. The text is stored and embedded for future matching."
        rows={4}
        bind:value={description}
        bind:summary={summary}
        contextLabel="want or offer"
      />

      <div class="grid three">
        <div class="field">
          <label for="importance">Importance</label>
          <select id="importance" name="importance">
            <option value="1">1 - Low</option>
            <option value="2">2 - Useful</option>
            <option value="3" selected>3 - Important</option>
            <option value="4">4 - High value</option>
            <option value="5">5 - Critical</option>
          </select>
        </div>
        <div class="field">
          <label for="urgency">Urgency</label>
          <select id="urgency" name="urgency">
            {#each EXCHANGE_URGENCIES as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="timeHorizon">Time horizon</label>
          <select id="timeHorizon" name="timeHorizon">
            {#each EXCHANGE_TIME_HORIZONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
      </div>

      <div class="grid three">
        <div class="field">
          <label for="status">Status</label>
          <select id="status" name="status">
            {#each EXCHANGE_STATUSES as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="confidence">Strength/confidence</label>
          <select id="confidence" name="confidence">
            {#each EXCHANGE_CONFIDENCES as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="geography">Geography</label>
          <input id="geography" name="geography" placeholder="e.g. Victoria, Australia-wide" />
        </div>
      </div>

      <div class="grid four">
        <div class="field">
          <label for="valueMin">Value min</label>
          <input id="valueMin" name="valueMin" inputmode="decimal" placeholder="e.g. 1000000" />
        </div>
        <div class="field">
          <label for="valueMax">Value max</label>
          <input id="valueMax" name="valueMax" inputmode="decimal" placeholder="e.g. 5000000" />
        </div>
        <div class="field">
          <label for="currency">Currency</label>
          <input id="currency" name="currency" value="AUD" maxlength="3" />
        </div>
        <div class="field">
          <label for="reviewAt">Review date</label>
          <input id="reviewAt" name="reviewAt" type="date" on:change={closeDatePickerOnChange} />
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="expiresAt">Expiry date</label>
          <input id="expiresAt" name="expiresAt" type="date" on:change={closeDatePickerOnChange} />
        </div>
      </div>

      <button class="btn primary" type="submit">Save want/offer</button>
    </form>
  {/if}

  {#if items.length === 0}
    <p class="muted">No wants or offers recorded yet.</p>
  {:else}
    <div class="exchange-list">
      {#each items as item}
        <div class="exchange-item">
          <div>
            <div class="title-line">
              <span class="exchange-type">{item.typeLabel}</span>
              <strong>{item.title}</strong>
              <span class="status-chip">{item.statusLabel}</span>
              <span class="status-chip">{item.urgencyLabel}</span>
            </div>
            <div class="muted small">
              {item.directionLabel} - {item.timeHorizonLabel} - {item.confidenceLabel} - importance {item.importance}/5 ({item.importanceLabel})
              {#if item.category} - {item.category}{/if}
            </div>
            {#if item.description}<p class="preline small">{item.description}</p>{/if}
            {#if item.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{item.summary}</p></div>{/if}
            <div class="muted small meta-row">
              {#if item.geography}<span>Geography: {item.geography}</span>{/if}
              {#if valueRange(item)}<span>Value: {valueRange(item)}</span>{/if}
              {#if item.reviewAt}<span>Review: {fmtDate(item.reviewAt)}</span>{/if}
              {#if item.expiresAt}<span>Expires: {fmtDate(item.expiresAt)}</span>{/if}
            </div>
          </div>
          <form method="post" action="?/deleteExchangeItem" on:submit={(event) => { if (!confirm('Delete this want/offer?')) event.preventDefault(); }}>
            <input type="hidden" name="exchangeItemId" value={item.id} />
            <button class="btn" type="submit">Delete</button>
          </form>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .exchange-panel { padding:16px; }
  .section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .section-head h2 { margin:0; }
  .muted { color:var(--muted); }
  .small { font-size:0.9rem; }
  .nested-form { display:grid; gap:12px; margin:12px 0; }
  .field { display:grid; gap:6px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .grid { display:grid; gap:12px; }
  .grid.two { grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .grid.three { grid-template-columns:repeat(3, minmax(0, 1fr)); }
  .grid.four { grid-template-columns:repeat(4, minmax(0, 1fr)); }
  .exchange-list { display:grid; gap:10px; }
  .exchange-item { display:flex; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .title-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .exchange-type { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:0.82rem; font-weight:700; }
  .status-chip { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:0.82rem; }
  .preline { white-space:pre-wrap; }
  .summary-box { background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:10px; margin-top:8px; }
  .summary-box p { margin:4px 0 0; white-space:pre-wrap; }
  .meta-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { font-weight:700; }

  @media (max-width: 760px) {
    .section-head, .exchange-item { flex-direction:column; }
    .grid.two, .grid.three, .grid.four { grid-template-columns:1fr; }
  }
</style>
