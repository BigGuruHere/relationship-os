<!-- src/routes/deals/[id]/notes/[noteId]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Display and edit a full deal note and its AI summary.
  // SECURITY: Text is decrypted on the server only and rendered here after tenant-scoped load.
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: {
    note: {
      id: string;
      channel: string;
      channelLabel: string;
      occurredAt: string | Date;
      occurredAtInput: string;
      text: string;
      summary: string;
      createdAt: string | Date;
      dealId: string;
      dealTitle: string;
      contactId: string | null;
      contactName: string;
    };
    noteChannels: { value: string; label: string }[];
  };
  export let form: any;

  let showEdit = false;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }
</script>

<div class="container">
  <div class="card note-card">
    <div class="title-row">
      <div>
        <div class="eyebrow">Deal note</div>
        <h1>{data.note.dealTitle}</h1>
        <div class="muted">{data.note.channel} - {fmt(data.note.occurredAt)}</div>
        {#if data.note.contactId}
          <div class="muted">Related person: <a href={`/contacts/${data.note.contactId}`}>{data.note.contactName}</a></div>
        {/if}
      </div>
      <div class="actions">
        <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Cancel edit' : 'Edit note'}</button>
        <a class="btn" href={`/deals/${data.note.dealId}`}>Back to deal</a>
        <form method="post" action="?/delete" on:submit={(event) => { if (!confirm('Delete this deal note?')) event.preventDefault(); }}>
          <button class="btn" type="submit">Delete</button>
        </form>
      </div>
    </div>

    {#if form?.error}
      <p class="error-text">{form.error}</p>
    {/if}

    {#if showEdit}
      <section class="section-block">
        <h2>Edit note</h2>
        <form method="post" action="?/update" class="nested-form">
          <div class="grid two">
            <div class="field"><label for="channel">Channel</label><select id="channel" name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={data.note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="occurredAt">Note date</label><input id="occurredAt" name="occurredAt" type="datetime-local" value={data.note.occurredAtInput} on:change={closeDatePickerOnChange} /></div>
          </div>
          <div class="field"><label for="text">Note</label><textarea id="text" name="text" rows="6" required>{data.note.text}</textarea></div>
          <div class="field"><label for="summary">Summary</label><input id="summary" name="summary" value={data.note.summary} /></div>
          <button class="btn primary" type="submit">Save note</button>
        </form>
      </section>
    {:else}
      {#if data.note.summary}
        <section class="section-block">
          <h2>AI summary</h2>
          <p class="preline">{data.note.summary}</p>
        </section>
      {/if}

      <section class="section-block">
        <h2>Full note</h2>
        <p class="preline">{data.note.text}</p>
      </section>
    {/if}
  </div>
</div>

<style>
  .note-card { padding: 20px; max-width: 860px; margin: 0 auto; }
  .title-row, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .actions { flex-wrap: wrap; }
  h1 { margin: 0; }
  h2 { margin: 0 0 8px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .section-block { border-top: 1px solid var(--border); margin-top: 16px; padding-top: 16px; }
  .preline { white-space: pre-wrap; }
  .error-text { color: var(--danger); }
  .nested-form { display: grid; gap: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .field input, .field select, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); }
  textarea { resize: vertical; }
  @media (max-width: 760px) { .title-row { flex-direction: column; } .grid.two { grid-template-columns: 1fr; } }
</style>
