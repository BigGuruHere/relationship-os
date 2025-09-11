<script lang="ts">
    export let data;
    // NOTE: For  MVP we show encrypted values as placeholders.
    // In a follow-up, decrypt on server and pass plaintext to the page when needed.
  </script>
  
  {#if data.notFound}
    <h1>Contact not found</h1>
  {:else}
    <h1>Contact</h1>
    <p><strong>ID:</strong> {data.contact.id}</p>
  
    <p>
      <a href={"/contacts/" + data.contact.id + "/interactions/new"}>
        Add note →
      </a>
    </p>
  
    <h2>Recent interactions</h2>
    <ul>
      {#each data.contact.interactions as i}
        <li>
          {new Date(i.occurredAt).toLocaleString()} — {i.channel}
        </li>
      {/each}
    </ul>
  {/if}
  