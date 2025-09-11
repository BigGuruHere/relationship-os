<!-- src/routes/contacts/[id]/interactions/[iid]/+page.svelte -->
<script lang="ts">
    export let data;
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
  
        <div style="margin-top:16px; display:flex; gap:10px;">
          <a class="btn primary" href={"/contacts/" + data.interaction.contactId + "/interactions/" + data.interaction.id + "/edit"}>Edit</a>
          <a class="btn" href={"/contacts/" + data.interaction.contactId}>Back to contact</a>
        </div>
      </div>
    </div>
  {/if}
  