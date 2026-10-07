<script lang="ts">
  // Stage 8.14.1: provider metadata is retained with the encrypted conversation source so
  // a later ElevenLabs webhook/API adapter can feed the same ingestion model.
  export let data: any;
  export let form: any;
  let transcript = '';
  let fileError = '';
  let ingestMethod = 'MANUAL_PASTE';

  async function loadTextFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 65000) {
      fileError = 'Choose a .txt or .md transcript under 65 KB.';
      return;
    }
    transcript = await file.text();
    ingestMethod = 'FILE_UPLOAD';
    fileError = '';
  }

  function defaultMapping(speaker: string) {
    const normalized = speaker.trim().toLocaleLowerCase();
    if (/^(agent|assistant|dorian)$/.test(normalized)) return 'SKIP';
    if (data.selectedPersonId && /^(user|participant|caller|customer|client)$/.test(normalized)) return data.selectedPersonId;
    return '';
  }
</script>

<svelte:head><title>Import conversation - Relish</title></svelte:head>
<div class="container pilot-page">
  <a href={data.selectedPersonId ? `/dating/people/${data.selectedPersonId}` : '/dating/people'}>← {data.selectedPersonId ? 'Person' : 'Dating people'}</a>
  <h1>Import a conversation</h1>
  <p>Paste a speaker-labelled transcript or choose a text file. Relish retains the encrypted original, stable speaker turns and provider metadata, then creates a private source for each person you explicitly identify. It will not send this transcript to AI on import.</p>

  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

  {#if form?.imported}
    <section class="card">
      <h2>{form.imported.alreadyImported ? 'Previously imported' : 'Conversation saved'}</h2>
      <p>{form.imported.turnCount} labelled turns retained · Provider: {form.imported.provider} · {form.imported.excerpts.length} private person source(s) available.</p>
      <p class="muted">The full conversation is contextual source. Only the mapped person's own turns are direct evidence about that person.</p>
      {#if form.imported.excludedSpeakers?.length}
        <p><strong>Retained in the original conversation only:</strong> {form.imported.excludedSpeakers.join(', ')}.</p>
      {/if}
      {#each form.imported.excerpts as excerpt}
        <div class="next-step">
          <strong>{excerpt.speaker}</strong>
          {#if excerpt.nextHref}
            <a class="btn primary" href={excerpt.nextHref}>{excerpt.hasLivingUnderstanding ? 'Review impact on Living Understanding' : 'Create initial Living Understanding'} →</a>
          {/if}
          <a class="btn" href={`/dating/people/${excerpt.contactId}/understanding?sourceInteractionId=${excerpt.id}`}>Inspect source</a>
        </div>
      {/each}
    </section>
  {:else}
    <form method="POST" action="?/preview" class="card">
      <h2>1. Conversation source</h2>
      <div class="grid two">
        <label>Provider
          <select name="provider">
            <option value="ELEVENLABS" selected>ElevenLabs</option>
            <option value="MANUAL">Manual / unknown provider</option>
            <option value="OTHER">Other provider</option>
          </select>
        </label>
        <label>Agent name
          <input name="agentName" value="Dorian" maxlength="120" />
        </label>
      </div>
      <div class="grid two">
        <label>External conversation ID <span class="muted">(optional)</span>
          <input name="externalConversationId" maxlength="240" autocomplete="off" placeholder="ElevenLabs conversation ID" />
        </label>
        <label>Conversation date/time <span class="muted">(optional)</span>
          <input name="occurredAt" type="datetime-local" />
        </label>
      </div>
      <input type="hidden" name="ingestMethod" value={ingestMethod} />

      <h2>2. Transcript</h2>
      <p>Each new turn should start with a label such as <code>User: ...</code> and <code>Agent: ...</code>. Continuation lines belong to the preceding speaker.</p>
      <label for="transcript-file">Optional text file</label>
      <input id="transcript-file" type="file" accept=".txt,.md,text/plain,text/markdown" on:change={loadTextFile} />
      {#if fileError}<p class="error">{fileError}</p>{/if}
      <label for="transcript">Transcript</label>
      <textarea id="transcript" name="transcript" rows="13" minlength="10" maxlength="60000" required bind:value={transcript}></textarea>
      <button type="submit" class="btn primary">Preview speaker labels</button>
    </form>

    {#if form?.preview}
      <form method="POST" action="?/import" class="card">
        <h2>3. Identify speakers</h2>
        <p>{form.preview.turnCount} labelled turns found. Check every mapping. Agent turns remain available as conversational context but are not direct evidence about the participant.</p>
        <input type="hidden" name="transcript" value={form.preview.text} />
        <input type="hidden" name="provider" value={form.preview.metadata.provider} />
        <input type="hidden" name="ingestMethod" value={form.preview.metadata.ingestMethod} />
        <input type="hidden" name="externalConversationId" value={form.preview.metadata.externalConversationId} />
        <input type="hidden" name="agentName" value={form.preview.metadata.agentName} />
        <input type="hidden" name="occurredAt" value={form.preview.metadata.occurredAt} />

        {#each form.preview.speakers as speaker, i}
          <label for={`speaker-${i}`}>{speaker}</label>
          <select id={`speaker-${i}`} name={`speaker_${i}`} required>
            <option value="" selected={defaultMapping(speaker) === ''} disabled>Choose the correct person</option>
            <option value="SKIP" selected={defaultMapping(speaker) === 'SKIP'}>Context only - do not create a person source</option>
            {#each data.people as person}
              <option value={person.id} selected={defaultMapping(speaker) === person.id}>{person.name}</option>
            {/each}
          </select>
        {/each}

        <label class="consent"><input type="checkbox" name="retainConsent" value="YES" required /> I have permission to retain and process this conversation in this private workspace. All relevant participants have been informed as appropriate.</label>
        <p>AI processing permission is a separate processing permission. Matching permission and permission to disclose another person's information are also separate decisions.</p>
        <button type="submit" class="btn primary">Save conversation source</button>
      </form>
    {/if}
  {/if}
</div>

<style>
  .pilot-page { max-width: 920px; padding: 16px; }
  .card { display: grid; gap: 12px; padding: 18px; margin: 16px 0; }
  .grid { display: grid; gap: 12px; }
  .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  label { display: grid; gap: 6px; }
  textarea, select, input[type="file"], input[type="text"], input[type="datetime-local"], input:not([type]) { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
  .consent { display: flex; gap: 8px; align-items: start; }
  .consent input { flex: none; }
  .next-step { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border); }
  .muted { color: var(--muted); }
  .error { color: var(--danger); }
  @media (max-width: 720px) { .grid.two { grid-template-columns: 1fr; } }
</style>
