<!-- src/lib/recording/RecordingGuard.svelte -->
<script lang="ts">
    // PURPOSE:
    // - Full screen touch guard used on mobile while recording.
    // - Prevents stray ear touches and provides a deliberate press-and-hold Stop.
    // - Shows a subtle motion effect while recording and a white state while transcribing.
    //
    // SECURITY NOTES:
    // - Pure client UI guard - no PII rendered or decrypted.
    // - Emits a stop event that the parent uses to finalize and upload audio with userId scoping on the server.
  
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
  
    // Public props
    export let visible = false;            // overlay visibility
    export let holdMs = 700;               // press-and-hold duration in ms
    export let mobileOnly = true;          // render only on mobile devices
    export let diameterPx = 120;           // stop button diameter in px
    export let transcribing = false;       // when true, show white button and "Transcribing..." text
  
    const dispatch = createEventDispatcher();
  
    // Internal state
    let holdTimer: number | null = null;
    let holding = false;
    let progress = 0;
    let rafId: number | null = null;
    let startTs = 0;
    let isMobile = false;
  
    // Detect mobile - coarse pointer or narrow viewport
    function detectMobile(): boolean {
      if (!browser) return false;
      const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
      const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
      return coarse || narrow;
    }
  
    function lockScroll(lock: boolean) {
      if (!browser) return;
      const cls = 'no-scroll-recording-guard';
      if (lock) document.body.classList.add(cls);
      else document.body.classList.remove(cls);
    }
  
    onMount(() => {
      isMobile = detectMobile();
      if (visible && shouldRender()) lockScroll(true);
  
      const onResize = () => {
        const prev = isMobile;
        isMobile = detectMobile();
        if (prev !== isMobile) {
          if (visible && shouldRender()) lockScroll(true);
          else lockScroll(false);
        }
      };
      if (browser) {
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
      }
      return () => {
        if (browser) {
          window.removeEventListener('resize', onResize);
          window.removeEventListener('orientationchange', onResize);
        }
      };
    });
  
    // Keep scroll lock in sync
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
      if (holding || transcribing) return;
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
  
    // Block background gestures
    function swallow(e: Event) {
      e.preventDefault();
      e.stopPropagation();
    }
  
    // Keyboard fallback
    function onKeydown(e: KeyboardEvent) {
      if (!visible || !shouldRender()) return;
      if (transcribing) return;
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
      aria-label={transcribing ? 'Transcribing' : 'Recording in progress'}
      on:touchstart|passive={swallow}
      on:touchmove|passive={swallow}
      on:touchend|passive={swallow}
      on:wheel={swallow}
      on:scroll={swallow}
      on:keydown={onKeydown}
      tabindex="0"
      style={`--diameter:${Math.max(80, Math.min(diameterPx, 260))}px; --ringp:${progress};`}
    >
      <div class="rg-content" on:pointerdown|preventDefault|stopPropagation on:click|preventDefault>
        {#if !transcribing}
          <div class="rg-status" aria-live="polite">Recording... hold to stop</div>
        {:else}
          <div class="rg-status" aria-live="polite">Transcribing...</div>
        {/if}
  
        <button
          class="rg-stop {transcribing ? 'is-transcribing' : 'is-recording'}"
          aria-label={transcribing ? 'Transcribing' : 'Hold to stop'}
          on:pointerdown|preventDefault|stopPropagation={!transcribing ? startHold : undefined}
          on:pointerup|preventDefault|stopPropagation={!transcribing ? endHold : undefined}
          on:pointerleave|preventDefault|stopPropagation={!transcribing ? endHold : undefined}
          disabled={transcribing}
        >
          <!-- No inner text per request -->
          <span class="rg-ring"></span>
        </button>
  
        {#if !transcribing}
          <div class="rg-hint">Hold for {Math.round(holdMs / 100) / 10}s to stop</div>
        {/if}
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
      opacity: 0.9;
    }
  
    .rg-stop {
      position: relative;
      width: var(--diameter);
      height: var(--diameter);
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      touch-action: none;
      display: grid;
      place-items: center;
    }
  
    /* Recording visual - subtle pulsing scale and glow */
    .rg-stop.is-recording {
      background: #c62828;
      animation: pulse 1.1s ease-in-out infinite;
      box-shadow: 0 0 0 0 rgba(198, 40, 40, 0.45);
    }
  
    /* Transcribing visual - white button, no pulse */
    .rg-stop.is-transcribing {
      background: #ffffff;
    }
  
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(198,40,40,0.45); }
      70% { transform: scale(1.04); box-shadow: 0 0 0 18px rgba(198,40,40,0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(198,40,40,0); }
    }
  
    /* Circular ring
       - While holding, conic gradient fills by --ringp
       - While idle recording, ring gently spins */
    .rg-ring {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.18) 59%, transparent 63%),
        conic-gradient(#ffffff calc(var(--ringp) * 360deg), rgba(255,255,255,0.18) 0deg);
      animation: spin 2.2s linear infinite;
    }
  
    .rg-stop.is-transcribing .rg-ring {
      background:
        radial-gradient(circle at 50% 50%, transparent 58%, rgba(0,0,0,0.12) 59%, transparent 63%),
        conic-gradient(#000000 12deg, rgba(0,0,0,0.12) 0deg);
      animation: spin 1.2s linear infinite;
    }
  
    @keyframes spin { to { transform: rotate(360deg); } }
  
    .rg-hint {
      margin-top: 10px;
      font-size: 12px;
      opacity: 0.7;
    }
  </style>
  