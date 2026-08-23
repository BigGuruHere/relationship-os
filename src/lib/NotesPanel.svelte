<!-- src/lib/NotesPanel.svelte -->
<script lang="ts">
  // PURPOSE: Reusable collapsed-by-default notes list. Each note expands on click to reveal the full text.
  // SECURITY: Renders server-prepared decrypted display values only.

  export let notes: any[] = [];
  export let emptyMessage = 'No notes yet.';

  function fmtDate(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  }

  function noteChannel(note: any) {
    return note.channelLabel || note.channel || 'Note';
  }

  // IT: different loads expose the full text under different keys (rawText vs body) - accept either.
  function noteFullText(note: any) {
    return note.rawText ?? note.body ?? note.preview ?? '';
  }

  // IT: some loads already send a truncated preview - only derive one here when they don't.
  function notePreview(note: any) {
    if (note.preview) return note.preview;
    const text = noteFullText(note);
    return text.length > 200 ? `${text.slice(0, 197)}...` : text;
  }
</script>

{#if notes.length === 0}
  <p class="muted">{emptyMessage}</p>
{:else}
  <ul class="notes-list">
    {#each notes as note (note.id)}
      <li class="note-row">
        <details class="note-details">
          <summary>
            <span class="status-chip">{noteChannel(note)}</span>
            <span class="muted small">{fmtDate(note.occurredAt)}</span>
            {#if note.withLabel}
              <span class="muted small">with {#if note.withHref}<a href={note.withHref}>{note.withLabel}</a>{:else}{note.withLabel}{/if}</span>
            {/if}
            <span class="preline note-preview-text">{notePreview(note) || '(empty)'}</span>
          </summary>
          <div class="note-full">
            {#if note.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{note.summary}</p></div>{/if}
            <p class="preline small">{noteFullText(note) || '(empty)'}</p>
            {#if note.href}<a class="btn tiny" href={note.href}>Open full note</a>{/if}
          </div>
          <slot name="actions" {note} />
        </details>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .notes-list { list-style: none; padding: 0; margin: 0; }
  .note-row { border-top: 1px solid var(--border); padding: 12px 0; }
  .note-row:first-child { border-top: none; padding-top: 0; }
  .note-details summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
  .note-preview-text { flex-basis: 100%; color: var(--text); }
  /* IT: hide the collapsed preview once expanded so the opening lines do not repeat above the full text. */
  .note-details[open] .note-preview-text { display: none; }
  .note-full { margin-top: 10px; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .preline { white-space: pre-wrap; margin: 0; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .btn.tiny { display: inline-flex; padding: 4px 8px; font-size: 0.82rem; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); text-decoration: none; margin-top: 8px; }
</style>
