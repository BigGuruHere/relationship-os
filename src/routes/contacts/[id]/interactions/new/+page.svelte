<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE:
  // - New note UI with voice record, summarize, and save.
  // - Stream-upload chunks while recording so transcription starts faster.
  // - Mobile uses RecordingGuard overlay. Desktop keeps the original inline Start and Stop buttons.
  // - Final tiny request sends last=1 to enqueue transcription and returns { jobId }.
  //
  // SECURITY NOTES:
  // - No decryption on client.
  // - Server endpoints require login and enforce tenant scoping by userId.
  // - Client only holds raw audio until upload. No PII is rendered.

  export let form;
  export let data;

  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto, beforeNavigate } from '$app/navigation';
  import RecordingGuard from '$lib/recording/RecordingGuard.svelte';

  // Form fields - bound to inputs
  let text = form?.draft?.text ?? '';
  let channel = form?.draft?.channel ?? 'note';
  let occurredAt = form?.draft?.occurredAt ?? '';
  let summary = form?.draft?.summary ?? '';
  let tags = form?.draft?.tags?.join(', ') ?? '';

  // Recorder state
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = '';

  // Upload streaming state
  let uploadKey = '';   // server assembly key used to collect chunks
  let nextIndex = 0;    // sequential index for each chunk

  // UI flags
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // Device heuristic so desktop keeps inline controls
  let isMobile = false;
  function detectMobile(): boolean {
    if (!browser) return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
    return coarse || narrow;
  }

  onMount(() => {
    isMobile = detectMobile();

    // Safety - stop recording if navigating away
    const unreg = beforeNavigate(() => {
      hardStopRecording();
    });

    // Stop if tab loses visibility
    const onVis = () => {
      if (document.hidden) hardStopRecording();
    };
    document.addEventListener('visibilitychange', onVis);

    // Stop on unload as a last resort
    const onUnload = () => hardStopRecording();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      unreg?.();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  onDestroy(() => {
    hardStopRecording();
  });

  // Choose recorder mime by capability
  function pickRecorderMime(): string {
    const preferred = 'audio/webm;codecs=opus'; // Chrome or Android
    const fallback = 'audio/mp4';               // iOS Safari often uses mp4
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(preferred)) return preferred;
    return fallback;
  }

  // -----------------------
  // Summarize - calls /api/summarize
  // -----------------------
  async function summarize() {
    try {
      summarizing = true;

      const input = String(text || '').trim();
      if (!input) {
        console.warn('[summarize] no text to summarize');
        return;
      }

      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });

      let data: any = {};
      try {
        data = await resp.json();
      } catch {
        console.error('[summarize] non json response');
        return;
      }

      if (!resp.ok) {
        console.error('[summarize] server error', data?.error || 'Unknown error');
        return;
      }

      summary = typeof data.summary === 'string' ? data.summary : '';

      if (Array.isArray(data.tags) && data.tags.length > 0) {
        tags = data.tags.map((t: any) => String(t || '')).filter(Boolean).join(', ');
      } else if (Array.isArray(data.suggestedTags)) {
        const names = data.suggestedTags.map((t: any) => String(t?.name || '')).filter(Boolean);
        if (names.length > 0) tags = names.join(', ');
      }
    } catch (err) {
      console.error('Summarize failed', err);
    } finally {
      summarizing = false;
    }
  }

  // -----------------------
  // Transcription helpers
  // -----------------------

  async function uploadChunk(key: string, index: number, last: boolean, bytes: Uint8Array) {
    const qs = new URLSearchParams({ key, index: String(index), last: last ? '1' : '0' });
    const res = await fetch(`/api/upload-chunk?${qs.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data };
  }

  async function pollResult(jobId: string): Promise<string> {
    if (!jobId) throw new Error('No jobId to poll');

    for (let i = 0; i < 60; i++) {
      const res = await fetch(`/api/transcribe-result?jobId=${encodeURIComponent(jobId)}`);
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok && data?.status === 'done') {
        return String(data.transcript || '');
      }
      if (res.status === 500 || data?.status === 'error') {
        throw new Error(`Polling failed status=${res.status}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Polling timed out');
  }

  // -----------------------
  // Recorder lifecycle - stream upload while recording
  // -----------------------

  async function startRecording() {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      };

      currentStream = await navigator.mediaDevices.getUserMedia(constraints);

      const mimeType = pickRecorderMime();
      mediaRecorder = new MediaRecorder(currentStream, { mimeType });

      // Initialize streaming state
      uploadKey = crypto.randomUUID();
      nextIndex = 0;

      mediaRecorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        const full = new Uint8Array(await e.data.arrayBuffer());
        const CHUNK = 256 * 1024;

        for (let o = 0; o < full.length; o += CHUNK) {
          const part = full.subarray(o, Math.min(o + CHUNK, full.length));
          const { status, data } = await uploadChunk(uploadKey, nextIndex++, false, part);
          if (!(status >= 200 && status < 300) || data?.ok !== true) {
            console.error('[voice] stream chunk failed', { status, data });
          }
        }
      };

      mediaRecorder.onstart = () => {
        recording = true;
      };

      mediaRecorder.onerror = () => {
        recording = false;
        transcribing = false;
        currentStream?.getTracks().forEach((t) => t.stop());
        currentStream = null;
      };

      mediaRecorder.onstop = async () => {
        // Guard might still be visible on mobile - switch to transcribing state there
        transcribing = true;
        try {
          const { status, data } = await uploadChunk(uploadKey, nextIndex, true, new Uint8Array());
          if (status !== 202 || !data?.jobId) throw new Error('No jobId from server on last');

          const jobId: string = String(data.jobId);
          const t = await pollResult(jobId);

          transcript = t;
          text = text ? text + '\n' + t : t;
        } catch (err) {
          console.error('Transcribe pipeline failed', err);
        } finally {
          transcribing = false;    // closes the guard on mobile
          recording = false;
          currentStream?.getTracks().forEach((trk) => trk.stop());
          currentStream = null;
        }
      };

      mediaRecorder.start(1000);
    } catch (err) {
      currentStream?.getTracks().forEach((t) => t.stop());
      currentStream = null;
      mediaRecorder = null;
      recording = false;
      console.error('startRecording error', err);
    }
  }

  function stopRecording() {
    const state = mediaRecorder?.state;
    if (state !== 'recording') return;
    try {
      mediaRecorder?.stop();
    } catch (err) {
      console.error('stopRecording error', err);
    }
  }

  // Hard stop used for navigation or cancel - ensures tracks are closed
  function hardStopRecording() {
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    } catch {}
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }
    recording = false;
  }

  function handleSubmit() {
    saving = true;
  }

  async function handleCancel() {
    // Ensure recording is stopped before navigating away
    hardStopRecording();
    await goto('..');
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1 style="margin:0 0 6px 0;">Add note</h1>
    <div style="margin:0 0 12px 0; color:#666;">
      for <a href={"/contacts/" + data.contact.id} class="link">{data.contact.name}</a>
    </div>
    <form method="post" on:submit={handleSubmit}>
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="tagsSource" value="ai" />

      <div class="field">
        <label for="channel">Channel</label>
        <select id="channel" name="channel" bind:value={channel} disabled={recording}>
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="message">Message</option>
        </select>
      </div>

      <div class="field">
        <label for="occurredAt">When - optional</label>
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} disabled={recording} />
      </div>

      <div class="field">
        <label for="text">Your note</label>

        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          {#if !recording}
            <button type="button" class="btn" on:click={startRecording} disabled={transcribing || saving}>
              <span>🎤 Start recording</span>
            </button>
          {:else}
            {#if isMobile}
              <!-- Mobile: guard handles the Stop interaction -->
              <span class="inline-wait">
                <span class="spinner" aria-hidden="true"></span>
                <span>Recording... use the Stop overlay</span>
              </span>
            {:else}
              <!-- Desktop: keep inline Stop button just like the original -->
              <button type="button" class="btn" on:click={stopRecording} disabled={saving}>
                ⏹ Stop
              </button>
            {/if}
          {/if}

          {#if transcribing}
            <span class="inline-wait">
              <span class="spinner" aria-hidden="true"></span>
              <span>Transcribing...</span>
            </span>
          {/if}
        </div>

        <textarea id="text" name="text" rows="8" bind:value={text} disabled={recording}></textarea>
      </div>

      {#if transcript}
        <p class="muted">Transcript captured from voice.</p>
      {/if}

      {#if summary}
        <div class="card" style="padding:12px; margin-top:12px;">
          <h3>AI Summary</h3>
          <pre style="white-space:pre-wrap;">{summary}</pre>
          <p style="margin-top:6px;">Tags: {tags}</p>
        </div>
      {/if}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn" on:click={summarize} disabled={summarizing || recording || saving}>
          {#if summarizing}
            <span class="spinner" aria-hidden="true"></span>
            <span>Summarizing...</span>
          {:else}
            <span>✨ Summarize</span>
          {/if}
        </button>

        <button
          class="btn primary"
          formaction="?/save"
          formmethod="post"
          disabled={saving || transcribing || recording}
        >
          {#if saving}
            <span class="spinner" aria-hidden="true"></span>
            <span>Saving...</span>
          {:else}
            <span>Save note</span>
          {/if}
        </button>

        <!-- Cancel must stop any active recording before leaving -->
        <button type="button" class="btn" on:click={handleCancel}>Cancel</button>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

<!-- Mobile guard - no inner text on button, subtle motion while recording, white with Transcribing... after stop -->
<RecordingGuard
  visible={recording || transcribing}
  holdMs={600}
  mobileOnly={true}
  diameterPx={120}
  transcribing={transcribing}
  on:stop={stopRecording}
/>

<style>
  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .inline-wait {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .muted { color: var(--muted); }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .btn:hover { background: var(--surface-3); }
  .btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(0.95); }

  .field { margin: 12px 0; }
  label { display: block; margin-bottom: 6px; }
  textarea, input, select {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    font: inherit;
  }
</style>
