<script lang="ts">
  // PURPOSE: Share page shown only when profile.qrReady is true.
  // SECURITY: No decryption here.
  export let data;

  // IT: derive public profile URL for buttons
  const profileUrl = `${location.origin}/u/${data.profile.slug}`;
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:720px; margin: 0 auto;">
    <h1 style="margin-top:0;">Share your link</h1>

    <!-- IT: QR block - your server should embed SVG on the profile if you prefer -->
    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:220px;">
        <!-- IT: if you persist qrSvg, you can render it here with {@html} -->
        <!-- Placeholder square if you do not embed SVG here -->
        <div style="width:220px;height:220px;border:1px solid #eee;border-radius:10px;display:flex;align-items:center;justify-content:center;">
          QR ready
        </div>
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
          <a class="btn" href={'/u/' + data.profile.slug} target="_blank" rel="noopener">
            View profile
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
</style>
