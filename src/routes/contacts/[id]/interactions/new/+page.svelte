<script lang="ts">
  export let form;
  let text = form?.draft?.text ?? '';
  let channel = form?.draft?.channel ?? 'note';
  let occurredAt = form?.draft?.occurredAt ?? '';
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1 style="margin-top:0;">Add note</h1>

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
        <label for="occurredAt">When (optional)</label>
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} />
      </div>

      <div class="field">
        <label for="text">Your note</label>
        <textarea id="text" name="text" rows="10" bind:value={text} placeholder="Type (or paste) your note..."></textarea>
      </div>

      <div style="display:flex; gap:10px;">
        <!-- Preview (no DB write) -->
        <button class="btn" formaction="?/draft" formmethod="post">Preview draft</button>
        <!-- Save (persists) -->
        <button class="btn primary" formaction="?/save" formmethod="post">Save note</button>
        <a class="btn" href="..">Cancel</a>
      </div>
    </form>

    {#if form?.mode === 'draft'}
      <hr style="margin:16px 0;" />
      <h2 style="margin-top:0;">Draft preview</h2>
      <pre style="white-space:pre-wrap; font-family:inherit;">{form.draft.text}</pre>
      <p style="color:var(--muted);">Edit above and click “Save note” when ready.</p>
    {/if}

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>
