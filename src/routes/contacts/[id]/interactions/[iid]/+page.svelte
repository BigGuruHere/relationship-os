<script lang="ts">
    export let data;
    export let form;
    // Optional: show a server error if delete failed
    $: serverError = form?.error ?? null;
  
    // Simple client confirm before POST
    function confirmDelete(e: SubmitEvent) {
    // Only stop the submit if the user cancels
    if (!confirm('Delete this note? This cannot be undone.')) {
      e.preventDefault();
    }
  }
  </script>
  
  {#if data.notFound}
    <div class="container"><div class="card" style="padding:20px;">
      <h1>Interaction not found</h1>
    </div></div>
  {:else}
    <div class="container" style="display:grid; gap:16px;">
      <div class="card" style="padding:20px;">
        <h1 style="margin-top:0;">Interaction</h1>
        <p><strong>When:</strong> {new Date(data.interaction.occurredAt).toLocaleString()}</p>
        <p><strong>Channel:</strong> {data.interaction.channel}</p>
        <h2 style="margin:16px 0 8px;">Note</h2>
        <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">
  {data.interaction.text}</pre>
  
        {#if serverError}
          <p style="color:var(--danger); margin-top:12px;">{serverError}</p>
        {/if}
  
        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" href={"/contacts/" + data.interaction.contactId + "/interactions/" + data.interaction.id + "/edit"}>Edit</a>
          <a class="btn" href={"/contacts/" + data.interaction.contactId}>Back to contact</a>
  
          <!-- Delete form posts to the `delete` action -->
          <form method="post" on:submit={confirmDelete} style="margin-left:auto;">
            <button
              class="btn"
              formaction="?/delete"
              formmethod="post"
              style="border-color: var(--danger); color: var(--danger);"
            >
              🗑️ Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  {/if}
  