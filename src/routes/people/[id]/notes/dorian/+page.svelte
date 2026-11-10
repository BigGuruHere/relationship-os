<script lang="ts">
  import { deserialize } from '$app/forms';
  import { onMount } from 'svelte';
  import DorianWebConversation from '$lib/components/DorianWebConversation.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  let activePerson = data.personId;
  let reference = data.reference;
  let checking = false;
  let calling = false;
  let message = '';
  let draft = '';
  let callerSpeech = '';
  let ready = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | undefined;
  $: personPath = '/people/' + encodeURIComponent(data.personId);

  // SvelteKit may reuse this page instance when the person changes.
  $: if (data.personId !== activePerson) {
    activePerson = data.personId;
    clearTimeout(timer);
    controller?.abort();
    reference = data.reference;
    checking = calling = ready = false;
    draft = message = callerSpeech = '';
  }

  async function checkDraft(remaining = 1) {
    if (!reference || checking) return;
    checking = true;
    const current = new AbortController();
    controller = current;
    message = 'Preparing your draft…';
    try {
      const body = new FormData();
      body.set('reference', reference);
      const response = await fetch('?/draft', {
        method: 'POST', body, signal: current.signal,
        headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
      });
      const result = deserialize(await response.text());
      if (current.signal.aborted) return;
      if (result.type === 'success' && result.data?.state === 'ready' && typeof result.data.text === 'string') {
        draft = result.data.text;
        callerSpeech = typeof result.data.callerSpeech === 'string' ? result.data.callerSpeech : '';
        ready = true;
        message = '';
      } else if (result.type === 'success' && result.data?.state === 'pending') {
        if (remaining > 1) timer = setTimeout(() => void checkDraft(remaining - 1), 2000);
        else message = 'The conversation is still processing. Check again in a moment.';
      } else {
        message = result.type === 'failure' && typeof result.data?.error === 'string'
          ? result.data.error : 'There is no draft for this conversation.';
      }
    } catch {
      if (!current.signal.aborted) message = 'Could not retrieve the draft. Try again.';
    } finally {
      if (controller === current) checking = false;
    }
  }

  function callFinished(callReference?: string) {
    calling = false;
    reference = callReference;
    void checkDraft(5);
  }

  // Stop browser polling when the user leaves. An unfinished draft can be checked again on return.
  onMount(() => () => {
    clearTimeout(timer);
    controller?.abort();
  });
</script>

<svelte:head><title>Talk to Dorian - Relish</title></svelte:head>
<section class="container" style="max-width: 40rem">
  <a href={personPath}>← Back to {data.name}</a>
  <h1>Talk to Dorian about {data.name}</h1>
  <p>Dorian can help you remember what mattered. ElevenLabs receives your live audio and both display names. OpenAI uses your side of the conversation to draft the note.</p>
  {#if !ready}
    {#key activePerson}
      <DorianWebConversation action="?/start" disabled={checking}
        onStarted={() => { calling = true; clearTimeout(timer); message = ''; }}
        onFinished={callFinished} />
    {/key}
    {#if reference && !calling}
      <button class="btn" type="button" disabled={checking} on:click={() => {
        clearTimeout(timer);
        void checkDraft();
      }}>Check for draft</button>
    {/if}
  {:else}
    <h2>Review your private note</h2>
    {#if callerSpeech}
      <p>No draft was generated. You can write a note using what you said below.</p>
      <details><summary>Show what I said</summary><p style="white-space: pre-wrap">{callerSpeech}</p></details>
    {/if}
    <!-- Post to the existing private note writer with a stable key for retries. -->
    <form method="POST" action={personPath + '/notes/new?/save'}>
      <input type="hidden" name="saveKey" value={reference} />
      <label for="note">Note</label>
      <textarea id="note" name="text" rows="9" maxlength="64000" required bind:value={draft}></textarea>
      <button class="btn primary" type="submit">Save private note</button>
    </form>
  {/if}
  {#if reference && !calling}
    <form method="POST" action="?/discard">
      <input type="hidden" name="reference" value={reference} />
      <button class="btn" type="submit">Discard conversation draft</button>
    </form>
  {/if}
  <p role="status">{message}</p>
</section>
