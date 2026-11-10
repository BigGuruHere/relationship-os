<script lang="ts">
  import ShareExchangeWatcher from '$lib/components/ShareExchangeWatcher.svelte';
  // src/routes/share/+page.svelte
  // PURPOSE: Share page - show QR and provide a one-tap Copy link action without exposing the raw URL
  // SECURITY: renders only server-provided strings - no secrets or decryption

  export let data: any;

  // IT: Only the signed-in user's profiles are returned by the server.
  const profileOptions: Array<{ id: string; slug: string; label: string; displayName: string | null; isPublished: boolean }> = data.profileOptions || [];
  function optionLabel(option: (typeof profileOptions)[number]) {
    // IT: Older profiles may have only the generic default label.
    return option.label && option.label !== 'My profile' ? option.label : option.displayName || 'My profile';
  }

  function selectProfile(event: Event) {
    const slug = (event.currentTarget as HTMLSelectElement).value;
    // IT: Full navigation guarantees the QR/link/title all update together, even when
    // SvelteKit reuses a page component for a new query string.
    if (profileOptions.some((option) => option.slug === slug)) {
      window.location.assign('/share?profile=' + encodeURIComponent(slug));
    }
  }

  // IT: The server redirects when no usable profile exists. Keep a local typed alias so the page
  // can express that invariant without weakening the server-side guard.
  const profile: any = data.profile;

  // IT: prefer server-provided origin to avoid SSR mismatch - fall back to window at runtime
  const relPath = '/u/' + encodeURIComponent(profile.slug);
  let profileUrl = (data.origin || '') + relPath;

  if (typeof window !== 'undefined' && (!profileUrl || profileUrl.startsWith('/'))) {
    // IT: build absolute URL in the browser if needed
    profileUrl = `${window.location.origin}${relPath}`;
  }

  // IT: derive a friendly owner name with safe fallbacks
  // 1) profile.displayName
  // 2) owner.name if provided
  // 3) title-cased slug like "terence-sweeney" -> "Terence Sweeney"
  // 4) final fallback "Your"
  const fromSlug = (s: string) =>
    s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const rawName: string =
    (profile.displayName && profile.displayName.trim()) ||
        (profile.slug && fromSlug(String(profile.slug))) ||
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

{#key data.watchSince + ':' + profile.slug}
  <ShareExchangeWatcher slug={profile.slug} since={data.watchSince} enabled={profile.isPublished} />
{/key}
<div class="container">
  <div class="card" style="padding:20px; max-width:720px; margin:0 auto;">
    <h1 style="margin-top:0;">{heading}</h1>
    <div class="profile-selection">
      <label for="share-profile-select">Profile to share</label>
      <select id="share-profile-select" value={profile.slug} on:change={selectProfile}>
        {#each profileOptions as option (option.id)}
          <option value={option.slug}>{optionLabel(option)}</option>
        {/each}
      </select>
      <a href="/profiles">Manage profiles</a>
    </div>
    {#if !profile.isPublished}
      <p role="status">This profile is unpublished. Publish it to enable sharing.</p>
      <p><a class="btn" href={'/settings/profile?profile=' + encodeURIComponent(profile.slug)}>Edit profile</a>
        <a class="btn" href={relPath}>Preview profile</a></p>
    {:else}

    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:220px;">
        <img class="qr-live" src={'/api/qr?slug=' + encodeURIComponent(profile.slug)} alt="Scan this profile QR code" width="220" height="220" />
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
    {/if}
  </div>
</div>

<style lang="postcss">
  /* IT: Profiles are chosen by private owner label, not by ContextSpace. */
  .profile-selection { display:grid; gap:8px; margin:0 0 20px; max-width:440px; }
  .profile-selection label { font-weight:650; }
  .profile-selection select { width:100%; min-height:44px; border:1px solid #c4d0ce; border-radius:10px; background:white; padding:10px; font:inherit; }
  .profile-selection a { font-size:.9rem; }
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
</style>
