<script lang="ts">
  import ConversationLuReview from './ConversationLuReview.svelte';
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  let busy = false;
  $: noteForm = form && 'proposals' in form ? form : undefined;
  $: labels = { self: 'Me', person: data.person.name, relationship: 'Our relationship' };
  $: back = '/people/' + encodeURIComponent(data.person.id);
</script>

<svelte:head><title>Review for Living Understanding - Relish</title></svelte:head>
{#if data.kind === 'conversation'}
  <ConversationLuReview {data} {form} />
{:else}
<section class="container" style="max-width: 44rem">
  <a href={back}>← Back to {data.person.name}</a>
  <h1>Review for Living Understanding</h1>
  <p>These updates reflect your perspective and stay private to you.</p>
  <details>
    <summary>Saved note</summary>
    <p style="white-space: pre-wrap">{data.text}</p>
  </details>

  {#if data.reviewed}
    <h2>Approved updates from this note</h2>
    <p>Editing the note retires these updates and lets you review the corrected version.</p>
    {#each data.approved as item}
      <article>
        <h3>{labels[item.bucket]}</h3>
        <p>{item.text}{item.mode === 'INFERRED' ? ' (your impression)' : ''}</p>
        <blockquote>{item.quote}</blockquote>
      </article>
    {:else}<p>No current updates from this note are available.</p>{/each}
  {:else if noteForm?.proposals && noteForm.token && noteForm.proposals.length}
    <form method="POST" action="?/approve" use:enhance={() => {
      busy = true;
      return async ({ update }) => { try { await update(); } finally { busy = false; } };
    }}>
      <input type="hidden" name="proposalToken" value={noteForm.token} />
      {#each (['self', 'person', 'relationship'] as const) as bucket}
        {#if noteForm.proposals.some(item => item.bucket === bucket)}
          <fieldset>
            <legend>{labels[bucket]}</legend>
            {#each noteForm.proposals as item, index}
              {#if item.bucket === bucket}
                <div>
                  <label><input type="checkbox" name="selected" value={index} />
                    {item.text}{item.mode === 'INFERRED' ? ' (your impression)' : ''}
                  </label>
                  <blockquote>{item.quote}</blockquote>
                </div>
              {/if}
            {/each}
          </fieldset>
        {/if}
      {/each}
      <button type="submit" class="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save selected updates'}</button>
    </form>
  {:else}
    <p>Choose Analyse note to send this saved note and the person's display name to OpenAI for suggestions.</p>
    {#if noteForm?.proposals?.length === 0}<p>No supported updates were suggested.</p>{/if}
    <form method="POST" action="?/analyse" use:enhance={() => {
      busy = true;
      return async ({ update }) => { try { await update(); } finally { busy = false; } };
    }}>
      <button type="submit" class="btn primary" disabled={busy}>{busy ? 'Analysing…' : 'Analyse note'}</button>
    </form>
  {/if}
  {#if form?.message}<p role="alert">{form.message}</p>{/if}
</section>
{/if}

<style>
  fieldset, article { margin: 1rem 0; padding: 1rem; border: 1px solid var(--border); }
  input[type='checkbox'] { width: auto; }
  blockquote { margin: .5rem 0 1rem; }
</style>
