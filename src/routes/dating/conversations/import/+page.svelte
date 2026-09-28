<script lang="ts">
  // Stage 8.12.13: operator must inspect speaker labels and intentionally assign each one.
  export let data: any;
  export let form: any;
  let transcript = '';
  let fileError = '';
  async function loadTextFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 65000) { fileError = 'Choose a .txt or .md transcript under 65 KB.'; return; }
    transcript = await file.text();
    fileError = '';
  }
</script>
<svelte:head><title>Import conversation - Relish</title></svelte:head>
<div class="container pilot-page">
  <a href="/dating/people">← Dating people</a>
  <h1>Import a conversation</h1>
  <p>Paste a speaker-labelled transcript or choose a text file. Relish retains an encrypted copy and creates separate, private, reviewable excerpts for people you explicitly identify. It will not send this transcript to AI on import.</p>
  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  {#if form?.imported}
    <section class="card"><h2>{form.imported.alreadyImported ? 'Previously imported' : 'Conversation saved'}</h2>
      <p>{form.imported.excerpts.length} private person review(s) are available. Open each one to request AI extraction with separate permission, then review proposed statements and topics.</p>
      {#if form.imported.excludedSpeakers?.length}
        <p><strong>Retained in the original transcript only, not extracted:</strong> {form.imported.excludedSpeakers.join(', ')}.</p>
        <p>No person-level excerpt or review link is created for these speakers. Their dialogue remains in the encrypted original and can be supplied to AI as context only after separate processing permission.</p>
      {/if}
      {#each form.imported.excerpts as excerpt, index}
        <p><a href={`/dating/people/${excerpt.contactId}/understanding?sourceInteractionId=${excerpt.id}`}>Review conversation for {excerpt.speaker} →</a></p>
      {/each}
    </section>
  {:else}
    <form method="POST" action="?/preview" class="card">
      <h2>1. Provide transcript</h2>
      <p>Each new turn should start with a label such as <code>Alex: ...</code> or <code>Speaker 1: ...</code>. Continuation lines belong to the previous speaker. Check labels before importing.</p>
      <label for="transcript-file">Optional text file</label>
      <input id="transcript-file" type="file" accept=".txt,.md,text/plain,text/markdown" on:change={loadTextFile} />
      {#if fileError}<p class="error">{fileError}</p>{/if}
      <label for="transcript">Transcript</label>
      <textarea id="transcript" name="transcript" rows="13" minlength="10" maxlength="60000" required bind:value={transcript}></textarea>
      <button type="submit" class="btn primary">Preview speaker labels</button>
    </form>
    {#if form?.preview}
      <form method="POST" action="?/import" class="card">
        <h2>2. Identify speakers</h2>
        <p>{form.preview.turnCount} labelled turns found. Check every mapping against the original conversation. A speaker left out of extraction remains in the encrypted original transcript.</p>
        <input type="hidden" name="transcript" value={form.preview.text} />
        {#each form.preview.speakers as speaker, i}
          <label for={`speaker-${i}`}>{speaker}</label>
          <select id={`speaker-${i}`} name={`speaker_${i}`} required>
            <option value="" selected disabled>Choose the correct person</option>
            <option value="SKIP">Do not extract this speaker (keep in original only)</option>
            {#each data.people as person}<option value={person.id}>{person.name}</option>{/each}
          </select>
        {/each}
        <label class="consent"><input type="checkbox" name="retainConsent" value="YES" required /> I have permission to retain and process this transcript in this private workspace. All relevant participants have been informed as appropriate.</label>
        <p>This does not grant AI processing permission or permission to disclose another person's information. Those are separate decisions.</p>
        <button type="submit" class="btn primary">Save transcript and private excerpts</button>
      </form>
    {/if}
  {/if}
</div>
<style>
  .pilot-page { max-width: 920px; padding: 16px; }
  .card { display: grid; gap: 12px; padding: 18px; margin: 16px 0; }
  textarea, select, input[type="file"] { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
  .consent { display: flex; gap: 8px; align-items: start; }
  .consent input { flex: none; }
  .error { color: var(--danger); }
</style>
