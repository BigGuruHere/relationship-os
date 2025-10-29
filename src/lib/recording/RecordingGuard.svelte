
<script lang="ts">
    // src/lib/recording/RecordingGuard.svelte
// PURPOSE: Full screen touch guard shown while recording on mobile - smaller Stop button and mobile-only rendering if desired.
// SECURITY NOTES:
// - Pure client UI guard - no PII rendered or decrypted.
// - Emits a stop event for the parent to finalize and upload audio with userId scoping on the server.

  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  // Props
  export let visible = false;            // show or hide the guard
  export let label = 'Hold to stop';     // accessible label
  export let holdMs = 700;               // press-and-hold duration
  export let mobileOnly = true;          // render only on mobile devices
  export let diameterPx = 140;           // Stop button diameter in px

  const dispatch = createEventDispatcher();

  let holdTimer: number | null = null;
  let holding = false;
  let progress = 0;
  let rafId: number | null = null;
  let startTs = 0;
  let isMobile = false;

  // Lightweight mobile heuristic - pointer coarse or narrow viewport
  function detectMobile(): boolean {
    if (!browser) return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
    return coarse || narrow;
  }

  // Prevent body scroll when visible
  function lockScroll(lock: boolean) {
    if (!browser) return;
    const cls = 'no-scroll-recording-guard';
    if (lock) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
  }

  onMount(() => {
    isMobile = detectMobile();
    if (visible && shouldRender()) lockScroll(true);

    // Re-evaluate on resize or orientation changes
    const onResize = () => {
      const prev = isMobile;
      isMobile = detectMobile();
      // If mobile state changed, re-apply scroll lock rules
      if (prev !== isMobile) {
        if (visible && shouldRender()) lockScroll(true);
        else lockScroll(false);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  });

  // Guarded reactive scroll lock
  $: if (browser) {
    if (visible && shouldRender()) lockScroll(true);
    else lockScroll(false);
  }

  onDestroy(() => {
    if (browser) lockScroll(false);
    cancelRaf();
    clearHold();
  });

  function shouldRender(): boolean {
    return !mobileOnly || isMobile;
  }

  function startHold() {
    if (holding) return;
    holding = true;
    progress = 0;
    startTs = performance.now();

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
    if (progress < 1) clearHold();
  }

  function completeHold() {
    clearHold();
    dispatch('stop');
  }

  // Block all background gestures
  function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Keyboard support for accessibility
  function onKeydown(e: KeyboardEvent) {
    if (!visible || !shouldRender()) return;
    if (e.key === 'Escape') {
      swallow(e);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      swallow(e);
      startHold();
    }
  }
</script>

{#if visible && shouldRender()}
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
    style={`--diameter:${Math.max(80, Math.min(diameterPx, 260))}px;`}
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
    width: min(420px, 92vw);
    padding: 18px;
    border-radius: 14px;
    background: #0f0f10;
    color: #f5f5f5;
    text-align: center;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .rg-status {
    font-size: 15px;
    margin-bottom: 12px;
    opacity: 0.85;
  }

  .rg-stop {
    position: relative;
    width: var(--diameter);
    height: var(--diameter);
    border-radius: 50%;
    border: none;
    background: #c62828;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    touch-action: none;
    outline: none;
  }

  .rg-stop:active { filter: brightness(0.95); }

  .rg-stop-label {
    position: relative;
    z-index: 2;
  }

  .rg-ring {
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.15) 59%, transparent 63%),
      conic-gradient(#ffffff calc(var(--p) * 360deg), rgba(255,255,255,0.15) 0deg);
    z-index: 1;
  }

  .rg-hint {
    margin-top: 10px;
    font-size: 12px;
    opacity: 0.7;
  }
</style>
