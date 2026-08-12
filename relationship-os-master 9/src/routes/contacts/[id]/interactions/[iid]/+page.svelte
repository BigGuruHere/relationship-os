<!-- src/routes/contacts/[id]/interactions/[iid]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Detail view with inline edit for summary and note text
  // SAFETY: Tenant scoping is on the server actions. This page only renders UI.

  import { page } from '$app/stores';
  export let data: {
    interaction: {
      id: string;
      channel: string;
      occurredAt: string | Date | null;
      text: string | null;
      summary: string | null;
      contactId: string;
      contactName: string;
    };
  };

  const interaction = data?.interaction ?? {
    id: '',
    channel: '',
    occurredAt: null,
    text: '',
    summary: '',
    contactId: '',
    contactName: ''
  };

  // Local edit state and buffers
  let editingSummary = false;
  let editingText = false;
  let summaryDraft: string = interaction.summary ?? '';
  let textDraft: string = interaction.text ?? '';

  function fmt(d: string | Date | null) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
  }
</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:900px; margin:0 auto;">

    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;">
      <h1 style="margin:0;">{interaction.contactName}</h1>
      <div class="pill">{interaction.channel}</div>
    </div>
    <p class="muted" style="margin-top:6px;">{fmt(interaction.occurredAt)}</p>

    <!-- Summary block -->
    <div class="card" style="padding:12px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <h3 style="margin:0;">Summary</h3>
        {#if !editingSummary}
          <button type="button" class="btn" on:click={() => { editingSummary = true; summaryDraft = interaction.summary ?? '' }}>
            Edit summary
          </button>
        {/if}
      </div>

      {#if editingSummary}
        <form method="post" action="?/editSummary" style="margin-top:8px;">
          <textarea name="summary" rows="6" bind:value={summaryDraft} class="area"></textarea>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn primary">Save summary</button>
            <button type="button" class="btn" on:click={() => { editingSummary = false; summaryDraft = interaction.summary ?? '' }}>
              Cancel
            </button>
          </div>
        </form>
      {:else}
        {#if interaction.summary}
          <pre style="white-space:pre-wrap; margin:8px 0 0 0;">{interaction.summary}</pre>
        {:else}
          <p class="muted" style="margin:8px 0 0 0;">No summary yet.</p>
        {/if}
      {/if}
    </div>

    <!-- Notes block -->
    <div class="card" style="padding:12px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <h3 style="margin:0;">Notes</h3>
        {#if !editingText}
          <button type="button" class="btn" on:click={() => { editingText = true; textDraft = interaction.text ?? '' }}>
            Edit note
          </button>
        {/if}
      </div>

      {#if editingText}
        <form method="post" action="?/editText" style="margin-top:8px;">
          <textarea name="text" rows="10" bind:value={textDraft} class="area"></textarea>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn primary">Save note</button>
            <button type="button" class="btn" on:click={() => { editingText = false; textDraft = interaction.text ?? '' }}>
              Cancel
            </button>
          </div>
        </form>
      {:else}
        {#if interaction.text}
          <pre style="white-space:pre-wrap; margin:8px 0 0 0;">{interaction.text}</pre>
        {:else}
          <p class="muted" style="margin:8px 0 0 0;">No note text.</p>
        {/if}
      {/if}
    </div>

    <!-- Actions -->
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <a class="btn" href={"/contacts/" + interaction.contactId}>Back to contact</a>

      <!-- Delete note - same base style, turns red on hover -->
      <a
        data-sveltekit-reload
        href={`/contacts/${$page.params.id}/interactions/${$page.params.iid}/delete`}
        class="btn danger-hover"
        aria-label="Delete this note"
      >
        Delete note
      </a>
    </div>
  </div>
</div>

<style>
  .pill {
    padding: 2px 10px;
    border-radius: 9999px;
    font-size: 12px;
    background: var(--surface-2);
    color: var(--muted);
  }
  .muted { color: var(--muted); }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .btn:hover { background: var(--surface-3); }
  .btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(0.95); }

  /* Delete uses same base style but goes red on hover only */
  .btn.danger-hover:hover {
    background: #dc2626;
    border-color: #b91c1c;
    color: white;
  }

  .area {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    font: inherit;
  }
</style>
