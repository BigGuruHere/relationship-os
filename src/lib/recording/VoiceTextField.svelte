<!-- src/lib/recording/VoiceTextField.svelte -->
<script lang="ts">
  // PURPOSE: Reusable voice-enabled textarea. It records audio, streams chunks to the existing upload API,
  // transcribes via the existing polling endpoint, and can request an AI summary from /api/summarize.
  // SECURITY: This component only handles browser-side capture. Server actions still validate and encrypt saved text.

  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import RecordingGuard from '$lib/recording/RecordingGuard.svelte';

  export let id = 'voiceText';
  export let textName = 'text';
  export let summaryName = 'summary';
  export let label = 'Notes';
  export let placeholder = '';
  export let rows = 4;
  export let value = '';
  export let summary = '';
  export let disabled = false;
  export let showSummaryBox = true;
  export let contextLabel = 'note';

  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcribing = false;
  let summarizing = false;
  let uploadKey = '';
  let nextIndex = 0;
  let isMobile = false;
  let lastError = '';

  function detectMobile(): boolean {
    if (!browser) return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
    return coarse || narrow;
  }

  onMount(() => {
    isMobile = detectMobile();

    // IT: Stop recording if the route changes, the page is hidden, or the browser unloads.
    const unreg: any = beforeNavigate(() => {
      hardStopRecording();
    });

    const onVis = () => {
      if (document.hidden) hardStopRecording();
    };
    document.addEventListener('visibilitychange', onVis);

    const onUnload = () => hardStopRecording();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (typeof unreg === 'function') unreg();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  onDestroy(() => {
    hardStopRecording();
  });

  function pickRecorderMime(): string {
    const preferred = 'audio/webm;codecs=opus';
    const fallback = 'audio/mp4';
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(preferred)) return preferred;
    return fallback;
  }

  async function uploadChunk(key: string, index: number, last: boolean, bytes: Uint8Array) {
    const qs = new URLSearchParams({ key, index: String(index), last: last ? '1' : '0' });
    const res = await fetch(`/api/upload-chunk?${qs.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes as unknown as BodyInit
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  }

  async function pollResult(jobId: string): Promise<string> {
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`/api/transcribe-result?jobId=${encodeURIComponent(jobId)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.status === 'done') return String(json.transcript || '');
      if (res.status === 500 || json?.status === 'error') throw new Error('Transcription failed');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error('Transcription timed out');
  }

  async function summarize() {
    lastError = '';
    const input = String(value || '').trim();
    if (!input) return;

    try {
      summarizing = true;
      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        lastError = 'Could not summarize this note.';
        return;
      }
      summary = typeof json.summary === 'string' ? json.summary : '';
    } catch (err) {
      console.error('[voice-text-field] summarize failed', err);
      lastError = 'Could not summarize this note.';
    } finally {
      summarizing = false;
    }
  }

  async function startRecording() {
    if (disabled || recording || transcribing) return;
    lastError = '';

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
      mediaRecorder = new MediaRecorder(currentStream, { mimeType: pickRecorderMime() });
      uploadKey = crypto.randomUUID();
      nextIndex = 0;

      mediaRecorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) return;
        const full = new Uint8Array(await event.data.arrayBuffer());
        const chunkSize = 256 * 1024;

        for (let offset = 0; offset < full.length; offset += chunkSize) {
          const part = full.subarray(offset, Math.min(offset + chunkSize, full.length));
          const { status, data } = await uploadChunk(uploadKey, nextIndex++, false, part);
          if (!(status >= 200 && status < 300) || data?.ok !== true) {
            console.error('[voice-text-field] stream chunk failed', { status, data });
          }
        }
      };

      mediaRecorder.onstart = () => {
        recording = true;
      };

      mediaRecorder.onerror = () => {
        lastError = 'Recording failed.';
        recording = false;
        transcribing = false;
        currentStream?.getTracks().forEach((track) => track.stop());
        currentStream = null;
      };

      mediaRecorder.onstop = async () => {
        transcribing = true;
        try {
          const { status, data } = await uploadChunk(uploadKey, nextIndex, true, new Uint8Array());
          if (status !== 202 || !data?.jobId) throw new Error('No transcription job returned');

          const transcript = await pollResult(String(data.jobId));
          value = value ? `${value}\n${transcript}` : transcript;
        } catch (err) {
          console.error('[voice-text-field] transcribe failed', err);
          lastError = 'Transcription failed.';
        } finally {
          transcribing = false;
          recording = false;
          currentStream?.getTracks().forEach((track) => track.stop());
          currentStream = null;
        }
      };

      mediaRecorder.start(1000);
    } catch (err) {
      currentStream?.getTracks().forEach((track) => track.stop());
      currentStream = null;
      mediaRecorder = null;
      recording = false;
      console.error('[voice-text-field] start recording failed', err);
      lastError = 'Could not start recording. Check microphone permission.';
    }
  }

  function stopRecording() {
    if (mediaRecorder?.state !== 'recording') return;
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('[voice-text-field] stop recording failed', err);
      lastError = 'Could not stop recording cleanly.';
    }
  }

  function hardStopRecording() {
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    } catch {}
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;
    }
    recording = false;
  }
</script>

<div class="voice-field">
  <input type="hidden" name={summaryName} value={summary} />

  <div class="voice-label-row">
    <label for={id}>{label}</label>
    <div class="voice-actions">
      {#if !recording}
        <button type="button" class="btn" on:click={startRecording} disabled={disabled || transcribing}>
          🎤 Record
        </button>
      {:else if isMobile}
        <span class="inline-wait"><span class="spinner" aria-hidden="true"></span><span>Recording...</span></span>
      {:else}
        <button type="button" class="btn" on:click={stopRecording} disabled={disabled}>⏹ Stop</button>
      {/if}

      <button type="button" class="btn" on:click={summarize} disabled={disabled || recording || transcribing || summarizing || !String(value || '').trim()}>
        {summarizing ? 'Summarizing...' : 'AI summary'}
      </button>
    </div>
  </div>

  <textarea id={id} name={textName} rows={rows} bind:value disabled={disabled || recording} placeholder={placeholder}></textarea>

  {#if transcribing}
    <div class="inline-wait"><span class="spinner" aria-hidden="true"></span><span>Transcribing {contextLabel}...</span></div>
  {/if}

  {#if showSummaryBox && summary}
    <div class="summary-box">
      <div class="muted small">AI summary</div>
      <p>{summary}</p>
    </div>
  {/if}

  {#if lastError}
    <p class="voice-error">{lastError}</p>
  {/if}
</div>

{#if recording && isMobile}
  <RecordingGuard transcribing={transcribing} onStop={stopRecording} />
{/if}

<style>
  .voice-field { display: grid; gap: 8px; }
  .voice-label-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .voice-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  textarea { resize: vertical; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .inline-wait { display: inline-flex; gap: 8px; align-items: center; color: var(--muted); }
  .spinner { width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  .voice-error { color: var(--danger); margin: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
