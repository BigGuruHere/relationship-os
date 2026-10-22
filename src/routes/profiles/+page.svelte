<script lang="ts">
  export let data: any;
  const labels: Record<string, string> = { business: 'Business', personal: 'Friendship', dating: 'Dating' };
</script>
<svelte:head><title>My three profiles - Relish</title></svelte:head>
<div class="container" style="max-width:850px;padding:20px 12px">
  <h1>My profiles</h1>
  <p>Use a different profile and QR code for professional, social and dating connections. Only published fields appear publicly.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:16px">
    {#each data.profiles as item}
      <div class="card" style="padding:20px">
        <h2>{labels[item.kind]}</h2>
        {#if item.profile}
          <p><strong>{item.profile.displayName || labels[item.kind]}</strong></p>
          <p>{item.profile.headline || 'No headline yet'}</p>
          <p>{item.profile.isPublished ? 'Published' : 'Unpublished'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <a href={'/settings/profile?kind=' + item.kind + '&profile=' + encodeURIComponent(item.profile.slug)}>Edit</a>
            <a href={'/u/' + encodeURIComponent(item.profile.slug)}>Preview</a>
            {#if item.profile.isPublished}<a href={'/share?profile=' + encodeURIComponent(item.profile.slug)}>Share QR</a>{/if}
          </div>
        {:else}
          <p>No {labels[item.kind].toLowerCase()} profile yet.</p>
          <a class="btn primary" href={'/settings/profile?kind=' + item.kind}>Create {labels[item.kind]} profile</a>
        {/if}
      </div>
    {/each}
  </div>
  <h2>Connection requests</h2>
  <p>These people explicitly offered their contact details for follow-up. Their conversations with Dorian remain private.</p>
  {#if data.requests.length}
    <ul>{#each data.requests as request}
      <li><strong>{request.name}</strong> - {labels[request.domainKey === 'general' ? 'personal' : request.domainKey] || request.domainKey} -
        <a href={'mailto:' + encodeURIComponent(request.email)}>{request.email}</a> - {new Date(request.requestedAt).toLocaleDateString()}</li>
    {/each}</ul>
  {:else}<p>No connection requests yet.</p>{/if}
  <p><a href="/general/admin/product-intelligence">Product Intelligence (pilot owner)</a></p>
</div>
