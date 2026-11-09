<script lang="ts">export let data;</script>
<svelte:head><title>My People - Relish</title></svelte:head>
<div class="container people-page">
  <h1>My People</h1><p>Your private contacts and notes. Adding someone does not invite or connect them.</p>
  <a class="btn primary" href="/people/new">Add Person</a>
  <form method="GET" class="people-search"><label for="q">Search your people</label><input id="q" name="q" value={data.q} placeholder="Name, email or phone"/><button class="btn">Search</button></form>
  {#if data.people.length}<h2>{data.q ? 'Search results' : (data.foundation ? 'Your people' : 'Recently added')}</h2><ul class="people-list">{#each data.people as person}<li><a href={'/people/' + person.id}><strong>{person.name}</strong>{#if person.email || person.phone}<span>{person.email || person.phone}</span>{/if}</a></li>{/each}</ul>
  {:else}<p>{data.q ? (data.next ? 'No matches on this page. Continue searching below.' : 'No matching people on this page.') : 'Add someone you met, then record what you want to remember.'}</p>{/if}
  {#if data.next}<a class="btn" href={'/people?' + new URLSearchParams({ q: data.q, after: data.next }).toString()}>{data.q ? 'Continue searching' : 'More people'}</a><p>Showing up to 50 people at a time.</p>{/if}
  <p class="muted">Existing Brokerage contacts remain in their current workspace.</p>
</div>
<style>.people-page{max-width:760px;padding:20px}.people-search{display:grid;gap:8px;margin:24px 0}.people-search input{width:100%;padding:12px}.people-list{list-style:none;padding:0}.people-list li{border-bottom:1px solid var(--border)}.people-list a{display:grid;gap:4px;padding:16px 0;overflow-wrap:anywhere}.people-list span{font-size:.9rem}.btn{min-height:44px}</style>
