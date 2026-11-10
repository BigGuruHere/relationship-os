<script lang="ts">export let data; export let form;</script>
<svelte:head><title>{data.contact.name} - My People</title></svelte:head>
<div class="container person-page"><a href="/people">← My People</a><h1>{data.contact.name}</h1>
{#if data.contact.email}<p><a href={'mailto:' + data.contact.email}>{data.contact.email}</a></p>{/if}
{#if data.contact.phone}<p><a href={'tel:' + data.contact.phone}>{data.contact.phone}</a></p>{/if}
{#if data.afterExchange}
  <section aria-label="Exchange complete">
    <h2>Would you like to add a voice note about {data.contact.name}?</h2>
    <a class="btn primary" href={'/people/' + data.contact.id + '/notes/new'}>Add a voice note</a>
    <a class="btn" href={'/people/' + data.contact.id}>Not now</a>
  </section>
{:else}
<a class="btn primary" href={'/people/' + data.contact.id + '/notes/new'}>Record voice note / Add note</a>
{/if}
<p class="muted">Your private observations. These notes are not shared or added to this person's understanding.</p>
<h2>History</h2>{#if data.origin}<p>Details shared through your profile on {new Date(data.origin.submittedAt).toLocaleString()}.</p>{/if}{#each data.notes as note}<article><p><time datetime={note.at}>{new Date(note.at).toLocaleString()}</time> · {note.channel === 'OWNER_VOICE_NOTE' ? 'Your voice note' : 'Your note'}</p><p class="note-text">{note.text}</p>{#if note.summary}<h3>Summary</h3><p class="note-text">{note.summary}</p>{/if}{#if note.editable}
  <details open={form?.draft?.id === note.id}>
    <summary>Edit note</summary>
    <form method="post" action={'?/editNote' + (data.afterExchange ? '&afterExchange=1' : '')}>
      <input type="hidden" name="noteId" value={note.id} />
      <input type="hidden" name="version" value={form?.draft?.id === note.id ? form.draft.version : note.version} />
      <input type="hidden" name="channel" value={note.channel} />
      <label>Date and time (UTC)
        <input type="datetime-local" name="occurredAt" step="0.001" required value={form?.draft?.id === note.id ? form.draft.utcTime : note.at.slice(0, -1)} />
      </label>
      <label>Note <textarea name="text" required maxlength="64000">{form?.draft?.id === note.id ? form.draft.text : note.text}</textarea></label>
      <label>Summary <textarea name="summary" maxlength="20000">{form?.draft?.id === note.id ? form.draft.summary : note.summary}</textarea></label>
      {#if form?.draft?.id === note.id}<p role="alert">{form.error}</p>{/if}
      <button class="btn" type="submit">Save changes</button>
    </form>
  </details>
{/if}</article>{:else}<p>No notes yet. Record what you want to remember.</p>{/each}{#if data.nextNote}<a class="btn" href={'/people/' + data.contact.id + '?afterNote=' + encodeURIComponent(data.nextNote)}>More history</a>{/if}{#if data.foundation}
  <details>
    <summary>Remove from My People</summary>
    <p>Archiving hides this person and their history from My People. Relish retains the records.</p>
    <form method="post" action="?/archive">
      <button class="btn" type="submit">Archive person</button>
    </form>
  </details>
{/if}
</div>
<style>.person-page{max-width:760px;padding:20px;overflow-wrap:anywhere}article{border-top:1px solid var(--border);padding:16px 0}.note-text{white-space:pre-wrap}.btn{min-height:48px}article form,article label{display:grid;gap:8px}</style>
