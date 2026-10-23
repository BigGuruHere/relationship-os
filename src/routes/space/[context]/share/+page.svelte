<script lang="ts">
  export let data: any;
  let copied = false;
  // IT: Clipboard is invoked only by a user gesture. The URL is read-only text as a fallback.
  function selectLink(event: FocusEvent) {
    (event.currentTarget as HTMLInputElement).select();
  }
  async function copyUrl() {
    if (!data.publicUrl) return;
    try { await navigator.clipboard.writeText(data.publicUrl); copied = true; }
    catch { copied = false; }
  }
</script>
<svelte:head><title>Share - {data.workspace.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">{data.workspace.label.toUpperCase()} / SHARE</p><h1>Share my profile</h1>
  <p class="workspace-intro">Use this QR code when you want to make a {data.workspace.label.toLowerCase()} connection.</p>
  {#if data.qrSvg}
    <section class="workspace-panel workspace-share">
      <h2>{data.profile.displayName || data.workspace.label}</h2>
      <div class="workspace-qr">{@html data.qrSvg}</div>
      <label for="relish-link">Public profile link</label>
      <input id="relish-link" readonly value={data.publicUrl} on:focus={selectLink} />
      <div class="workspace-buttons"><button class="btn primary" type="button" on:click={copyUrl}>{copied ? 'Copied!' : 'Copy link'}</button>
        <a class="btn" href={data.publicUrl} target="_blank" rel="noopener">Open public profile</a></div>
      <p class="workspace-small">The QR opens your public profile. It does not share your private conversations or Living Understanding.</p>
    </section>
  {:else}
    <section class="workspace-panel"><h2>Your QR code isn't public yet</h2>
      <p>Create and publish your {data.workspace.label.toLowerCase()} profile first.</p>
      <a class="btn primary" href={'/space/' + data.workspace.name + '/profile'}>Go to my profile</a>
    </section>
  {/if}
</div>
