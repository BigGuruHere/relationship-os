<!-- src/routes/contacts/[id]/interactions/[iid]/+page.svelte -->
<script lang="ts">
    export let data;
    export let form;
  
    // Autocomplete for adding tags
    let query = '';
    let suggestions: { name: string; slug: string }[] = [];
    async function fetchSuggestions() {
      if (!query.trim()) { suggestions = []; return; }
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
      const j = await res.json();
      suggestions = j.tags || [];
    }
  
    $: serverError = form?.error ?? null;
    function confirmDelete(e: SubmitEvent) {
      if (!confirm('Delete this note? This cannot be undone.')) e.preventDefault();
    }
  </script>
  
  {#if data.notFound}
    <div class="container"><div class="card" style="padding:20px;"><h1>Interaction not found</h1></div></div>
  {:else}
    <div class="container" style="display:grid; gap:16px;">
      <div class="card" style="padding:20px;">
        <h1 style="margin-top:0;">Interaction</h1>
        <p><strong>When:</strong> {new Date(data.interaction.occurredAt).toLocaleString()}</p>
        <p><strong>Channel:</strong> {data.interaction.channel}</p>
  
        {#if data.interaction.summary}
          <h2 style="margin:16px 0 8px;">Summary</h2>
          <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">{data.interaction.summary}</pre>
        {/if}
  
        <!-- Tags chips -->
        <div style="margin-top:12px;">
          <h3 style="margin:0 0 8px;">Tags</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            {#if data.interaction.tags?.length}
              {#each data.interaction.tags as t}
                <form method="post" action="?/removeTag">
                  <input type="hidden" name="slug" value={t.slug} />
                  <button class="btn" style="padding:6px 10px;" title={`Remove ${t.name}`}>#{t.name} ✕</button>
                </form>
              {/each}
            {:else}
              <span style="color:var(--muted);">No tags yet.</span>
            {/if}
          </div>
  
          <form method="post" action="?/addTag" style="margin-top:10px; display:flex; gap:8px; max-width:420px;">
            <input
              name="tag"
              placeholder="Add tag"
              bind:value={query}
              on:input={fetchSuggestions}
              list="interaction-tag-suggestions" />
            <button class="btn">Add</button>
            <datalist id="interaction-tag-suggestions">
              {#each suggestions as s}
                <option value={s.name}></option>
              {/each}
            </datalist>
          </form>
        </div>
  
        <h2 style="margin:16px 0 8px;">Note</h2>
        <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">{data.interaction.text}</pre>
  
        {#if serverError}
          <p style="color:var(--danger); margin-top:12px;">{serverError}</p>
        {/if}
  
        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" href={"/contacts/" + data.interaction.contactId + "/interactions/" + data.interaction.id + "/edit"}>Edit</a>
          <a class="btn" href={"/contacts/" + data.interaction.contactId}>Back to contact</a>
          <form method="post" on:submit={confirmDelete} style="margin-left:auto;">
            <button class="btn" formaction="?/delete" formmethod="post" style="border-color: var(--danger); color: var(--danger);">
              🗑️ Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  {/if}
  