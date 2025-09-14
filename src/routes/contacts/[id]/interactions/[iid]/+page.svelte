<script lang="ts">
  // PURPOSE: Render one interaction plus its tags. Allow add and remove via named actions.
  export let data: {
    interaction: {
      id: string;
      contactId: string;
      contactName: string;
      channel: string;
      occurredAt: string | Date | null;
      text: string;
      summary: string;
    };
    tags: Array<{ name: string; slug: string }>;
  };

  function fmt(d: string | Date | null) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString();
  }
</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:900px; margin:0 auto;">
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;">
      <h1 style="margin:0;">{data.interaction.contactName}</h1>
      <div class="pill">{data.interaction.channel}</div>
    </div>
    <p class="muted" style="margin-top:6px;">{fmt(data.interaction.occurredAt)}</p>

    <div class="field" style="margin-top:16px;">
      <label>Tags</label>

      <!-- add tag -->
      <form method="post" action="?/addTag" style="display:flex; gap:8px; align-items:center;">
        <input name="name" placeholder="Add a tag - e.g., investor" />
        <button class="btn">Add</button>
      </form>

      <!-- existing tags - removable chips -->
      {#if data.tags.length > 0}
        <div class="tag-row">
          {#each data.tags as t}
            <form method="post" action="?/removeTag">
              <input type="hidden" name="slug" value={t.slug} />
              <button class="chip" title="Remove tag">
                <span class="chip-text">{t.name}</span>
                <span class="chip-x" aria-hidden="true">×</span>
              </button>
            </form>
          {/each}
        </div>
      {:else}
        <p class="muted" style="margin-top:8px;">No tags yet.</p>
      {/if}
    </div>

    {#if data.interaction.summary}
      <div class="card" style="padding:12px; margin-top:12px;">
        <h3 style="margin-top:0;">Summary</h3>
        <pre style="white-space:pre-wrap; margin:0;">{data.interaction.summary}</pre>
      </div>
    {/if}

    {#if data.interaction.text}
      <div class="card" style="padding:12px; margin-top:12px;">
        <h3 style="margin-top:0;">Notes</h3>
        <pre style="white-space:pre-wrap; margin:0;">{data.interaction.text}</pre>
      </div>
    {/if}

    <div style="display:flex; gap:10px; margin-top:16px;">
      <a class="btn" href={"/contacts/" + data.interaction.contactId}>Back to contact</a>
    </div>
  </div>
</div>
