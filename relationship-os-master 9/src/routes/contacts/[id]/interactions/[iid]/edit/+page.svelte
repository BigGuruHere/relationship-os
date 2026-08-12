<!-- src/routes/contacts/[id]/interactions/[iid]/edit/+page.svelte -->
<script lang="ts">
    export let data;
    export let form;
  
    // Pre-fill form inputs from loaded data; keep values if a 400 fail occurs.
    let channel = form?.values?.channel ?? data?.interaction?.channel ?? 'note';
    let occurredAt = form?.values?.occurredAt ?? (data?.interaction?.occurredAt
                      ? new Date(data.interaction.occurredAt).toISOString().slice(0,16)
                      : '');
    let text = form?.values?.text ?? data?.interaction?.text ?? '';
  </script>
  
  {#if data?.notFound}
    <div class="container"><div class="card" style="padding:20px;">
      <h1>Interaction not found</h1>
    </div></div>
  {:else}
    <div class="container">
      <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
        <h1 style="margin-top:0;">Edit interaction</h1>
  
        <form method="post">
          <div class="field">
            <label for="channel">Channel</label>
            <select id="channel" name="channel" bind:value={channel}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="message">Message</option>
            </select>
          </div>
  
          <div class="field">
            <label for="occurredAt">When</label>
            <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} />
          </div>
  
          <div class="field">
            <label for="text">Note</label>
            <textarea id="text" name="text" rows="10" bind:value={text}></textarea>
          </div>
  
          <div style="display:flex; gap:10px;">
            <button class="btn primary" type="submit">Save changes</button>
            <a class="btn" href={"../" }>Cancel</a>
          </div>
        </form>
  
        {#if form?.error}
          <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
        {/if}
      </div>
    </div>
  {/if}
  