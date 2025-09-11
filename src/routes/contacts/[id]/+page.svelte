<!-- src/routes/contacts/[id]/+page.svelte -->
<script lang="ts">
  export let data;

  // Autocomplete state
  let query = '';
  let suggestions: { name: string; slug: string }[] = [];

  async function fetchSuggestions() {
    if (!query.trim()) { suggestions = []; return; }
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
      const j = await res.json();
      suggestions = j.tags || [];
    } catch {
      suggestions = [];
    }
  }
</script>

{#if data.notFound}
  <div class="container"><div class="card" style="padding:20px;"><h1>Contact not found</h1></div></div>
{:else}
  <div class="container" style="display:grid; gap:16px;">
    <div class="card" style="padding:20px;">
      <h1 style="margin-top:0;">{data.contact.name}</h1>
      {#if data.contact.email}<p>Email: <strong>{data.contact.email}</strong></p>{/if}
      {#if data.contact.phone}<p>Phone: <strong>{data.contact.phone}</strong></p>{/if}

      <!-- Tags section -->
      <div style="margin-top:16px;">
        <h3 style="margin:0 0 8px;">Tags</h3>

        <!-- Existing tags as chips with remove -->
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          {#if data.contact.tags.length === 0}
            <span style="color:var(--muted);">No tags yet.</span>
          {:else}
            {#each data.contact.tags as t}
              <form method="post" action="?/removeTag">
                <input type="hidden" name="slug" value={t.slug} />
                <button class="btn" title={`Remove ${t.name}`} style="padding:6px 10px;">
                  #{t.name} ✕
                </button>
              </form>
            {/each}
          {/if}
        </div>

        <!-- Add tag with autocomplete -->
        <form method="post" action="?/addTag" style="margin-top:10px; display:flex; gap:8px; max-width:420px;">
          <input
            name="tag"
            placeholder="Add tag, e.g. follow-up"
            bind:value={query}
            on:input={fetchSuggestions}
            list="tag-suggestions" />
          <button class="btn">Add</button>
          <datalist id="tag-suggestions">
            {#each suggestions as s}
              <option value={s.name}></option>
            {/each}
          </datalist>
        </form>
      </div>

      <div style="margin-top:14px;">
        <a class="btn primary" href={"/contacts/" + data.contact.id + "/interactions/new"}>Add note</a>
      </div>
    </div>

    <div class="card" style="padding:20px;">
      <h2 style="margin-top:0;">Recent interactions</h2>
      {#if data.interactions.length === 0}
        <p style="color:var(--muted);">No interactions yet.</p>
      {:else}
        <ul style="list-style:none; padding:0; margin:0;">
          {#each data.interactions as i}
            <li style="padding:12px; border-top:1px solid var(--border);">
              <a href={"/contacts/" + data.contact.id + "/interactions/" + i.id} style="text-decoration:none;">
                {new Date(i.occurredAt).toLocaleString()} - <strong>{i.channel}</strong>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}
