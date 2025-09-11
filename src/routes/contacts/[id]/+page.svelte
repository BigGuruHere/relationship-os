<script lang="ts">
  export let data;
</script>

{#if data.notFound}
  <h1>Contact not found</h1>
{:else}
  <h1>{data.contact.name}</h1>
  {#if data.contact.email}<p>Email: {data.contact.email}</p>{/if}
  {#if data.contact.phone}<p>Phone: {data.contact.phone}</p>{/if}

  <p>
    <a href={"/contacts/" + data.contact.id + "/interactions/new"}>Add note →</a>
  </p>

  <h2>Recent interactions</h2>
  {#if data.interactions.length === 0}
    <p>No interactions yet.</p>
  {:else}
    <ul>
      {#each data.interactions as i}
        <li>{new Date(i.occurredAt).toLocaleString()} — {i.channel}</li>
      {/each}
    </ul>
  {/if}
{/if}
