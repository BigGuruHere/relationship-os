<!-- src/routes/u/[slug]/SaveToLinkedIn.svelte -->
<!-- PURPOSE: Create lead, open LinkedIn in new tab, resume voice-note when user returns -->
<!-- SECURITY: Never trust client ownerId - server derives owner from slug and session -->

<script lang="ts">
    export let linkedinUrl: string;   // like https://www.linkedin.com/in/your-handle
    export let resumeTo = '/thank-you?ref=linkedin'; // where to resume flow
  
    // IT: keep a local flag so we resume only once
    let opened = false;
    let resumed = false;
  
    async function saveToLinkedIn() {
      if (opened) return;
      opened = true;
  
      // IT: use sendBeacon to avoid race if the browser navigates immediately
      const payload = JSON.stringify({ linkedinUrl });
      const ok = navigator.sendBeacon('/api/share/linkedin', new Blob([payload], { type: 'application/json' }));
  
      // Fallback to fetch if sendBeacon not available or blocked
      if (!ok) {
        try {
          await fetch('/api/share/linkedin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true });
        } catch {}
      }
  
      // IT: open LinkedIn in a new tab so our page stays alive
      const win = window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Popup blocked - degrade gracefully by navigating current tab
        window.location.href = linkedinUrl;
      }
    }
  
    // IT: when the tab becomes visible again, resume the flow once
    function maybeResume() {
      if (resumed) return;
      if (document.visibilityState === 'visible') {
        resumed = true;
        window.location.assign(resumeTo);
      }
    }
  
    // IT: wire up visibility and focus events
    const onVis = () => maybeResume();
    const onFocus = () => maybeResume();
  
    // IT: Svelte lifecycle
    import { onMount, onDestroy } from 'svelte';
    onMount(() => {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onFocus);
    });
    onDestroy(() => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    });
  </script>
  
  <button class="btn primary" on:click={saveToLinkedIn}>
    Save to LinkedIn
  </button>
  