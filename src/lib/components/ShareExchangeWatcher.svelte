<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  export let slug: string;
  export let since: number;
  export let enabled: boolean;

  onMount(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ profile: slug, since: String(since) });
    const openedAt = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      if (controller.signal.aborted || performance.now() - openedAt > 15 * 60_000) return;
      if (document.visibilityState === 'visible') {
        try {
          const response = await fetch('/share/incoming?' + query, { signal: controller.signal });
          if (response.ok && response.status !== 204) {
            const { personId } = await response.json();
            if (personId && !controller.signal.aborted && document.visibilityState === 'visible') {
              await goto('/people/' + encodeURIComponent(personId) + '?afterExchange=received');
              return;
            }
          }
        } catch { /* Sharing still works if this optional check fails. */ }
      }
      if (!controller.signal.aborted) timer = setTimeout(check, 5000);
    }
    timer = setTimeout(check, 2000);
    return () => { controller.abort(); clearTimeout(timer); };
  });
</script>
