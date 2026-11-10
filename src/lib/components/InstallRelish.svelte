<script lang="ts">
  import { onMount } from 'svelte';

  export let enabled = false;

  interface InstallPrompt extends Event {
    prompt(): Promise<unknown>;
  }

  const dismissalKey = 'relish-install-dismissed';
  let deferred: InstallPrompt | null = null;
  let installed = false;
  let dismissed = false;
  let iosSafari = false;

  onMount(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const refresh = () => {
      installed = standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    };
    refresh();
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    try { dismissed = localStorage.getItem(dismissalKey) === 'yes'; } catch { /* Storage is optional. */ }

    // Listen from the persistent layout so a prompt emitted before sign-in is retained.
    const capture = (event: Event) => {
      event.preventDefault();
      deferred = event as InstallPrompt;
    };
    const done = () => {
      installed = true;
      deferred = null;
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    standalone.addEventListener('change', refresh);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
      standalone.removeEventListener('change', refresh);
    };
  });

  async function install() {
    const prompt = deferred;
    if (!prompt) return;
    deferred = null; // A native prompt can only be used once.
    try { await prompt.prompt(); } catch { /* The browser may withdraw the prompt. */ }
  }

  function dismiss() {
    dismissed = true;
    try { localStorage.setItem(dismissalKey, 'yes'); } catch { /* Dismiss for this visit. */ }
  }
</script>

{#if enabled && !installed && !dismissed && (deferred || iosSafari)}
  <aside aria-label="Install Relish">
    <div>
      <strong>Add Relish to your home screen</strong>
      {#if !deferred}
        <p>In Safari, tap Share, then Add to Home Screen. If shown, turn on Open as Web App, then tap Add.</p>
      {/if}
    </div>
    {#if deferred}<button type="button" on:click={install}>Install Relish</button>{/if}
    <button type="button" on:click={dismiss}>Dismiss</button>
  </aside>
{/if}

<style>
  aside {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: .65rem;
    margin: .75rem auto;
    padding: .75rem;
    max-width: 46rem;
    border: 1px solid var(--border, #ddd);
    border-radius: .75rem;
  }
  div { flex: 1 1 14rem; }
  p { margin: .35rem 0 0; }
  button { min-height: 44px; }
</style>
