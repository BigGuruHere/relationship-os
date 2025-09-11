<script lang="ts">
  export let data;
</script>

{#if data.notFound}
  <div class="container">
    <div class="card" style="padding:20px;">
      <h1>Contact not found</h1>
    </div>
  </div>
{:else}
  <div class="container" style="display:grid; gap:16px;">
    <div class="card" style="padding:20px;">
      <h1 style="margin-top:0;">{data.contact.name}</h1>
      {#if data.contact.email}<p>Email: <strong>{data.contact.email}</strong></p>{/if}
      {#if data.contact.phone}<p>Phone: <strong>{data.contact.phone}</strong></p>{/if}
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
              {new Date(i.occurredAt).toLocaleString()} — <strong>{i.channel}</strong>
            </a>
          </li>
        {/each}
      </ul>
      {/if}
    </div>
  </div>
{/if}
