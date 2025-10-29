
<script lang="ts">
    // src/lib/recording/RecordingGuard.svelte
// PURPOSE: Full screen touch guard shown while recording - blocks stray touches and offers a single, high-confidence Stop control.
// SECURITY NOTES:
// - Pure client UI guard - no PII rendered or decrypted.
// - Emits a stop event that your recorder handler can use to finalize and upload audio with userId scoping on the server.

  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  // Props
  export let visible = false;           // show or hide the guard
  export let label = 'Hold to stop';    // accessible label
  export let holdMs = 700;              // press-and-hold duration

  const dispatch = createEventDispatcher();

  let holdTimer: number | null = null;
  let holding = false;
  let progress = 0;
  let rafId: number | null = null;
  let startTs = 0;

  // Prevent body scroll when visible - guard for SSR
  function lockScroll(lock: boolean) {
    if (!browser) return;
    const cls = 'no-scroll-recording-guard';
    if (lock) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
  }

  onMount(() => {
    if (visible) lockScroll(true);
  });

  // Reactive watch - only run in browser
  $: if (browser) lockScroll(visible);

  onDestroy(() => {
    if (browser) lockScroll(false);
    cancelRaf();
    clearHold();
  });

  function startHold() {
    if (holding) return;
    holding = true;
    progress = 0;
    startTs = performance.now();

    // Update visual progress
    function tick(ts: number) {
      const elapsed = ts - startTs;
      progress = Math.min(1, elapsed / holdMs);
      if (progress >= 1) {
        completeHold();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);

    // Fallback timer to guarantee completion
    holdTimer = window.setTimeout(completeHold, holdMs);
  }

  function cancelRaf() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function clearHold() {
    if (holdTimer != null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    cancelRaf();
    holding = false;
    progress = 0;
  }

  function endHold() {
    // If user released early, treat as cancel
    if (progress < 1) clearHold();
  }

  function completeHold() {
    clearHold();
    // Emit stop intent up to parent
    dispatch('stop');
  }

  // Block all background gestures
  function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Keyboard support - Escape cancels guard without stopping recording
  function onKeydown(e: KeyboardEvent) {
    if (!visible) return;
    if (e.key === 'Escape') {
      swallow(e);
      // parent can hide the guard when recording is canceled manually
    }
    if (e.key === 'Enter' || e.key === ' ') {
      // Enter or Space behaves like press-and-hold
      swallow(e);
      startHold();
    }
  }
</script>

{#if visible}
  <div
    class="rg-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Recording in progress"
    on:touchstart|passive={swallow}
    on:touchmove|passive={swallow}
    on:touchend|passive={swallow}
    on:wheel={swallow}
    on:scroll={swallow}
    on:keydown={onKeydown}
    tabindex="0"
  >
    <div class="rg-content" on:pointerdown|preventDefault|stopPropagation on:click|preventDefault>
      <div class="rg-status" aria-live="polite">
        Recording... hold to stop
      </div>

      <button
        class="rg-stop"
        aria-label={label}
        on:pointerdown|preventDefault|stopPropagation={startHold}
        on:pointerup|preventDefault|stopPropagation={endHold}
        on:pointerleave|preventDefault|stopPropagation={endHold}
      >
        <span class="rg-stop-label">{label}</span>
        <span class="rg-ring" style={`--p:${progress};`}></span>
      </button>

      <div class="rg-hint">Hold for {Math.round(holdMs / 100) / 10}s to stop</div>
    </div>
  </div>
{/if}

<style>
  /* Prevent background scroll when guard is active */
  :global(body.no-scroll-recording-guard) {
    overflow: hidden;
    touch-action: none;
  }

  .rg-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 10, 0.75);
    display: grid;
    place-items: center;
    z-index: 9999;
    pointer-events: auto;
  }

  .rg-content {
    width: min(520px, 92vw);
    padding: 24px;
    border-radius: 16px;
    background: #0f0f10;
    color: #f5f5f5;
    text-align: center;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .rg-status {
    font-size: 16px;
    margin-bottom: 16px;
    opacity: 0.85;
  }

  .rg-stop {
    position: relative;
    width: min(280px, 70vw);
    height: min(280px, 70vw);
    border-radius: 50%;
    border: none;
    background: #c62828;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    touch-action: none;
    outline: none;
  }

  .rg-stop:active {
    filter: brightness(0.95);
  }

  .rg-stop-label {
    position: relative;
    z-index: 2;
  }

  /* Circular progress ring driven by --p variable from 0 to 1 */
  .rg-ring {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.15) 59%, transparent 63%),
      conic-gradient(#ffffff calc(var(--p) * 360deg), rgba(255,255,255,0.15) 0deg);
    z-index: 1;
  }

  .rg-hint {
    margin-top: 14px;
    font-size: 13px;
    opacity: 0.7;
  }

  @media (max-width: 420px) {
    .rg-content { padding: 18px; }
    .rg-status { font-size: 15px; }
    .rg-hint { font-size: 12px; }
  }
</style>
