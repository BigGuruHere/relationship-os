<script lang="ts">export let data;</script>
<svelte:head><title>{data.contact.name} - My People</title></svelte:head>
<div class="container person-page"><a href="/people">← My People</a><h1>{data.contact.name}</h1>
{#if data.contact.email}<p><a href={'mailto:' + data.contact.email}>{data.contact.email}</a></p>{/if}
{#if data.contact.phone}<p><a href={'tel:' + data.contact.phone}>{data.contact.phone}</a></p>{/if}
<a class="btn primary" href={'/people/' + data.contact.id + '/notes/new'}>Record voice note / Add note</a>
<p class="muted">Your private observations. These notes are not shared or added to this person's understanding.</p>
<h2>History</h2>{#if data.origin}<p>Details shared through your profile on {new Date(data.origin.submittedAt).toLocaleString()}.</p>{/if}{#each data.notes as note}<article><p><time datetime={note.at}>{new Date(note.at).toLocaleString()}</time> · {note.channel === 'OWNER_VOICE_NOTE' ? 'Your voice note' : 'Your note'}</p><p class="note-text">{note.text}</p>{#if note.summary}<h3>Summary</h3><p class="note-text">{note.summary}</p>{/if}</article>{:else}<p>No notes yet. Record what you want to remember.</p>{/each}{#if data.nextNote}<a class="btn" href={'/people/' + data.contact.id + '?afterNote=' + encodeURIComponent(data.nextNote)}>More history</a>{/if}</div>
<style>.person-page{max-width:760px;padding:20px;overflow-wrap:anywhere}article{border-top:1px solid var(--border);padding:16px 0}.note-text{white-space:pre-wrap}.btn{min-height:48px}</style>
