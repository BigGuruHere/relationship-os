<!-- src/routes/contacts/[id]/interactions/[iid]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Detail view for a single interaction - read only plus delete link
  // SAFETY: Interaction-level tags were removed - do not assume tags exist on this page
  // NAV: Back link goes to the parent contact page

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

  // Safe accessors - default to empty values to avoid runtime errors
  const interaction = data?.interaction ?? {
    id: '',
    channel: '',
    occurredAt: null,
    text: '',
    summary: '',
    contactId: '',
    contactName: ''
  };

  function fmt(d: string | Date | null) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
  }
</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:900px; margin:0 auto;">
    <!-- Header - contact name and channel -->
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;">
      <h1 style="margin:0;">{interaction.contactName}</h1>
      <div class="pill">{interaction.channel}</div>
    </div>
    <p class="muted" style="margin-top:6px;">{fmt(interaction.occurredAt)}</p>

    <!-- Summary block - only if present -->
    {#if interaction.summary}
      <div class="card" style="padding:12px; margin-top:12px;">
        <h3 style="margin-top:0;">Summary</h3>
        <pre style="white-space:pre-wrap; margin:0;">{interaction.summary}</pre>
      </div>
    {/if}

    <!-- Notes block - only if present -->
    {#if interaction.text}
      <div class="card" style="padding:12px; margin-top:12px;">
        <h3 style="margin-top:0;">Notes</h3>
        <pre style="white-space:pre-wrap; margin:0;">{interaction.text}</pre>
      </div>
    {/if}

    <!-- Actions -->
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <a class="btn" href={"/contacts/" + interaction.contactId}>Back to contact</a>

      <!-- Delete note - GET endpoint deletes and redirects back to the contact -->
      <!-- data-sveltekit-reload forces a full navigation so the server 303 lands correctly -->
      <a
        data-sveltekit-reload
        href={`/contacts/${$page.params.id}/interactions/${$page.params.iid}/delete`}
        class="btn danger"
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
  }
  .btn:hover { background: var(--surface-3); }
  .btn.danger {
    background: #dc2626;
    border-color: #b91c1c;
    color: white;
  }
  .btn.danger:hover { background: #b91c1c; }
</style>
