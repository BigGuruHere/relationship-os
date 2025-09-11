<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<!-- PURPOSE: Let user type a note, preview it (no DB write), then edit & save. -->
<script lang="ts">
    export let form;
    let text = form?.draft?.text ?? '';          // preserve draft between round-trips
    let channel = form?.draft?.channel ?? 'note';
    let occurredAt = form?.draft?.occurredAt ?? '';
  </script>
  
  <h1>Add note</h1>
  
  <form method="post">
    <label>
      Channel
      <select name="channel" bind:value={channel}>
        <option value="note">Note</option>
        <option value="call">Call</option>
        <option value="meeting">Meeting</option>
        <option value="message">Message</option>
      </select>
    </label>
  
    <br />
  
    <label>
      When (optional)
      <input name="occurredAt" type="datetime-local" bind:value={occurredAt} />
    </label>
  
    <br />
  
    <label>
      Your note
      <textarea name="text" rows="10" bind:value={text} placeholder="Type (or paste) your note..."></textarea>
    </label>
  
    <br />
  
    <!-- Button that posts to the 'draft' action to preview (no persistence) -->
    <button formaction="?/draft" formmethod="post">Preview draft</button>
  
    <!-- Button that posts to the 'save' action to persist -->
    <button formaction="?/save" formmethod="post" style="margin-left: 8px;">Save note</button>
  </form>
  
  {#if form?.mode === 'draft'}
    <hr />
    <h2>Draft preview</h2>
    <pre>{form.draft.text}</pre>
    <p>Edit above and click “Save note” when ready.</p>
  {/if}
  
  {#if form?.error}
    <p style="color:crimson">{form.error}</p>
  {/if}
  