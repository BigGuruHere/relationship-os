<script lang="ts">
  // src/routes/share/+page.svelte
  // PURPOSE: Share page - show QR and provide a one-tap Copy link action without exposing the raw URL
  // SECURITY: renders only server-provided strings - no secrets or decryption

  export let data;

  // IT: prefer server-provided origin to avoid SSR mismatch - fall back to window at runtime
  const relPath = '/u/' + data.profile.slug;
  let profileUrl = (data.origin || '') + relPath;

  if (typeof window !== 'undefined' && (!profileUrl || profileUrl.startsWith('/'))) {
    // IT: build absolute URL in the browser if needed
    profileUrl = `${window.location.origin}${relPath}`;
  }

  // IT: stored SVG markup for the QR if available
  const svg = data.profile.qrSvg || '';
  const hasSvg = typeof svg === 'string' && svg.trim().startsWith('<svg');

  // IT: derive a friendly owner name with safe fallbacks
  // 1) profile.displayName
  // 2) owner.name if provided
  // 3) title-cased slug like "terence-sweeney" -> "Terence Sweeney"
  // 4) final fallback "Your"
  const fromSlug = (s: string) =>
    s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const rawName: string =
    (data.profile.displayName && data.profile.displayName.trim()) ||
    (data.owner && data.owner.name && data.owner.name.trim()) ||
    (data.profile.slug && fromSlug(String(data.profile.slug))) ||
    'Your';

  // IT: format possessive correctly: "Chris" -> "Chris'"; "Terence" -> "Terence's"
  function toPossessive(name: string): string {
    const t = name.trim();
    if (!t) return 'Contact Details';
    const last = t.slice(-1).toLowerCase();
    return last === 's' ? `${t}'` : `${t}'s`;
  }

  const heading = `${toPossessive(rawName)} Contact Details`;

  // IT: simple copied state for user feedback
  let copied = false;

  // IT: copy helper with a fallback prompt if clipboard write fails
  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // IT: fallback - open a prompt so the user can copy manually
      // eslint-disable-next-line no-alert
      window.prompt('Copy this link', profileUrl);
    }
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:720px; margin:0 auto;">
    <h1 style="margin-top:0;">{heading}</h1>

    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:220px;">
        {#if hasSvg}
          <div class="qr" aria-label="QR code">{@html svg}</div>
        {:else}
          <div
            style="width:220px;height:220px;border:1px solid #eee;border-radius:10px;display:flex;align-items:center;justify-content:center;"
          >
            QR not generated
          </div>
        {/if}
      </div>

      <div style="flex:1; min-width:260px;">
        <!-- IT: single copy action without showing the raw URL -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          <button class="btn" type="button" on:click={copyProfileUrl} style="padding:8px 12px;">
            {#if copied}Copied{:else}Copy link{/if}
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
          <a class="btn" href={relPath} target="_blank" rel="noopener">
            View profile
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  /* IT: compact button and QR styling */
  .btn {
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 10px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: inherit;
    line-height: 1;
    cursor: pointer;
    height: 36px;
  }
  .qr :global(svg) {
    width: 220px;
    height: 220px;
    display: block;
    border-radius: 10px;
  }
</style>
