<script lang="ts">
  // PURPOSE: Share page shown only when profile.qrReady is true.
  // SECURITY: Renders only server-provided svg and links.
  export let data;

  // IT: build an absolute URL only in the browser, else fall back to relative
  const relativeProfileUrl = '/u/' + data.profile.slug;
  const profileUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${relativeProfileUrl}` : relativeProfileUrl;

  // IT: server stored SVG markup
  const svg = data.profile.qrSvg || '';
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:720px; margin: 0 auto;">
    <h1 style="margin-top:0;">Share your link</h1>

    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:220px;">
        {#if svg}
          <!-- IT: render stored SVG - safe since it is generated server side -->
          <div class="qr" aria-label="QR code">{@html svg}</div>
        {:else}
          <!-- IT: fallback square if svg is missing for any reason -->
          <div style="width:220px;height:220px;border:1px solid #eee;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            QR ready
          </div>
        {/if}
      </div>

      <div style="flex:1; min-width:260px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          <input
            readonly
            value={profileUrl}
            style="flex:1; min-width:200px; padding:8px 10px; border:1px solid #ddd; border-radius:10px;"
          />
          <button
            class="btn"
            type="button"
            on:click={() => navigator.clipboard.writeText(profileUrl)}
            style="padding:8px 12px;"
          >
            Copy
          </button>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a class="btn" href={'sms:?&body=' + encodeURIComponent(profileUrl)}>Share by SMS</a>
          <a
            class="btn"
            href={'https://wa.me/?text=' + encodeURIComponent(profileUrl)}
            target="_blank"
            rel="noopener"
          >
            Share on WhatsApp
          </a>
          <a class="btn" href={relativeProfileUrl} target="_blank" rel="noopener">
            View profile
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
  .qr :global(svg) { width:220px; height:220px; display:block; border-radius:10px; }
</style>
