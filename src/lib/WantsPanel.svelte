<!-- src/lib/WantsPanel.svelte -->
<script lang="ts">
  // PURPOSE: Reusable entity-local first-class Wants panel.
  // SECURITY: Submit goes to current page server action, which tenant-scopes and encrypts values.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';
  import { WANT_CONFIDENCES, WANT_STATUSES, WANT_TIME_HORIZONS, WANT_TYPES, WANT_URGENCIES } from '$lib/wants';

  export let items: any[] = [];
  export let entityLabel = 'this record';
  export let title = 'Wants';

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

<section class="card wants-panel">
  <div class="section-head">
    <div>
      <h2>{title}</h2>
      <p class="muted small">Record what {entityLabel} is looking for, keeping an eye out for, or has asked you to find.</p>
    </div>
    <a class="btn" href="/wants">All wants</a>
    <button class="btn primary" type="button" on:click={() => (showForm = !showForm)}>{showForm ? 'Cancel' : 'Add want'}</button>
  </div>

  {#if showForm}
    <form method="post" action="?/createWant" class="nested-form want-form">
      <div class="grid three">
        <div class="field"><label for="wantType">Want type</label><select id="wantType" name="wantType">{#each WANT_TYPES as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="status">Status</label><select id="status" name="status">{#each WANT_STATUSES as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="category">Category</label><input id="category" name="category" placeholder="e.g. aged care, RTO, mortgage book" /></div>
      </div>

      <div class="field"><label for="wantTitle">Title</label><input id="wantTitle" name="wantTitle" placeholder="e.g. Wants RTO acquisition opportunities" required /></div>

      <VoiceTextField
        id="wantDescription"
        textName="wantDescription"
        summaryName="wantSummary"
        label="Description"
        placeholder="Record the want in plain English. This text is stored and embedded for future matching."
        rows={4}
        bind:value={description}
        bind:summary={summary}
        contextLabel="want"
      />

      <div class="field"><label for="criteria">Criteria</label><textarea id="criteria" name="criteria" rows="3" placeholder="Specific acquisition/search criteria, exclusions, timing, preferences"></textarea></div>

      <div class="grid three">
        <div class="field"><label for="importance">Importance</label><select id="importance" name="importance"><option value="1">1 - Low</option><option value="2">2 - Useful</option><option value="3" selected>3 - Important</option><option value="4">4 - High value</option><option value="5">5 - Critical</option></select></div>
        <div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each WANT_URGENCIES as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="timeHorizon">Time horizon</label><select id="timeHorizon" name="timeHorizon">{#each WANT_TIME_HORIZONS as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
      </div>

      <div class="grid three">
        <div class="field"><label for="confidence">Strength/confidence</label><select id="confidence" name="confidence">{#each WANT_CONFIDENCES as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="geography">Geography</label><input id="geography" name="geography" placeholder="e.g. Victoria, Australia-wide" /></div>
        <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value="AUD" maxlength="3" /></div>
      </div>

      <div class="grid four">
        <div class="field"><label for="valueMin">Minimum value ($m)</label><input id="valueMin" name="valueMin" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" placeholder="e.g. 5" /></div>
        <div class="field"><label for="valueMax">Maximum value ($m)</label><input id="valueMax" name="valueMax" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" placeholder="e.g. 12.5" /></div>
        <div class="field"><label for="reviewAt">Review date</label><input id="reviewAt" name="reviewAt" type="date" on:change={closeDatePickerOnChange} /></div>
        <div class="field"><label for="expiresAt">Expiry date</label><input id="expiresAt" name="expiresAt" type="date" on:change={closeDatePickerOnChange} /></div>
      </div>

      <button class="btn primary" type="submit">Save want</button>
    </form>
  {/if}

  {#if items.length === 0}
    <p class="muted">No wants recorded yet.</p>
  {:else}
    <div class="want-list">
      {#each items as item}
        <div class="want-item">
          <div>
            <div class="title-line">
              <span class="want-type">{item.wantTypeLabel}</span>
              <a href={`/wants/${item.id}`}><strong>{item.title}</strong></a>
              <span class="status-chip">{item.statusLabel}</span>
              <span class="status-chip">{item.urgencyLabel}</span>
            </div>
            <div class="muted small">{item.timeHorizonLabel} - {item.confidenceLabel} - importance {item.importance}/5 ({item.importanceLabel}){#if item.category} - {item.category}{/if}</div>
            {#if item.description}<p class="preline small">{item.description}</p>{/if}
            {#if item.criteria}<div class="criteria-box"><div class="muted small">Criteria</div><p>{item.criteria}</p></div>{/if}
            <div class="muted small meta-row">
              {#if item.geography}<span>Geography: {item.geography}</span>{/if}
              {#if valueRange(item)}<span>Value: {valueRange(item)}</span>{/if}
              {#if item.reviewAt}<span>Review: {fmtDate(item.reviewAt)}</span>{/if}
              {#if item.expiresAt}<span>Expires: {fmtDate(item.expiresAt)}</span>{/if}
            </div>
          </div>
          <form method="post" action="?/deleteWant" on:submit={(event) => { if (!confirm('Remove this want from this record? The Want itself will remain in Relish.')) event.preventDefault(); }}>
            <input type="hidden" name="wantId" value={item.id} />
            <button class="btn" type="submit">Remove</button>
          </form>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .wants-panel { padding:16px; }
  .section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .section-head h2 { margin:0; }
  .muted { color:var(--muted); }
  .small { font-size:0.9rem; }
  .nested-form { display:grid; gap:12px; margin:12px 0; }
  .field { display:grid; gap:6px; }
  .field input, .field select, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .grid { display:grid; gap:12px; }
  .grid.three { grid-template-columns:repeat(3, minmax(0, 1fr)); }
  .grid.four { grid-template-columns:repeat(4, minmax(0, 1fr)); }
  .want-list { display:grid; gap:10px; }
  .want-item { display:flex; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .title-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .want-type, .status-chip { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:0.82rem; }
  .want-type { font-weight:700; }
  .preline, .criteria-box p { white-space:pre-wrap; }
  .criteria-box { background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:10px; margin-top:8px; }
  .criteria-box p { margin:4px 0 0; }
  .meta-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg, #21c7b6, #0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  @media (max-width: 760px) { .section-head, .want-item { flex-direction:column; } .grid.three, .grid.four { grid-template-columns:1fr; } }
</style>
