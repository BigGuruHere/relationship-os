<!-- src/routes/deals/[id]/notes/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: Add a deal note with optional voice recording, transcription, and AI summary.
  // SECURITY: The server encrypts saved note text and summary before writing to the database.

  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto, beforeNavigate } from '$app/navigation';
  import RecordingGuard from '$lib/recording/RecordingGuard.svelte';

  export let form: any;
  export let data: {
    deal: { id: string; title: string };
    people: Array<{ id: string; name: string; company: string }>;
  };

  // IT: Form fields. Failed submissions can repopulate from form.draft.
  let text = form?.draft?.text ?? '';
  let channel = form?.draft?.channel ?? 'note';
  let occurredAt = form?.draft?.occurredAt ?? '';
  let contactId = form?.draft?.contactId ?? '';
  let summary = form?.draft?.summary ?? '';

  // IT: Recorder state for streaming audio upload and polling transcription.
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = '';
  let uploadKey = '';
  let nextIndex = 0;

  let transcribing = false;
  let summarizing = false;
  let saving = false;
  let isMobile = false;

  function detectMobile(): boolean {
    if (!browser) return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
    return coarse || narrow;
  }

  onMount(() => {
    isMobile = detectMobile();

    // IT: Stop recording if the user navigates away or the tab is hidden.
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

  async function summarize() {
    try {
      summarizing = true;
      const input = String(text || '').trim();
      if (!input) return;

      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) return;
      summary = typeof json.summary === 'string' ? json.summary : '';
    } catch (err) {
      console.error('[deal-note] summarize failed', err);
    } finally {
      summarizing = false;
    }
  }

  async function uploadChunk(key: string, index: number, last: boolean, bytes: Uint8Array) {
    const qs = new URLSearchParams({ key, index: String(index), last: last ? '1' : '0' });
    const res = await fetch(`/api/upload-chunk?${qs.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes as BodyInit
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
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Transcription timed out');
  }

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
      mediaRecorder = new MediaRecorder(currentStream, { mimeType: pickRecorderMime() });
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
            console.error('[deal-note] stream chunk failed', { status, data });
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
        transcribing = true;
        try {
          const { status, data } = await uploadChunk(uploadKey, nextIndex, true, new Uint8Array());
          if (status !== 202 || !data?.jobId) throw new Error('No transcription job returned');

          const t = await pollResult(String(data.jobId));
          transcript = t;
          text = text ? `${text}\n${t}` : t;
        } catch (err) {
          console.error('[deal-note] transcribe failed', err);
        } finally {
          transcribing = false;
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
      console.error('[deal-note] start recording failed', err);
    }
  }

  function stopRecording() {
    if (mediaRecorder?.state !== 'recording') return;
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('[deal-note] stop recording failed', err);
    }
  }

  function hardStopRecording() {
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
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
    hardStopRecording();
    await goto(`/deals/${data.deal.id}`);
  }
</script>

<div class="container">
  <div class="card note-card">
    <h1>Add deal note</h1>
    <div class="muted top-meta">for <a href={`/deals/${data.deal.id}`}>{data.deal.title}</a></div>

    <form method="post" on:submit={handleSubmit}>
      <input type="hidden" name="summary" value={summary} />

      <div class="grid two">
        <div class="field">
          <label for="channel">Channel</label>
          <select id="channel" name="channel" bind:value={channel} disabled={recording}>
            <option value="note">Note</option>
            <option value="voice note">Voice note</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="message">Message</option>
          </select>
        </div>

        <div class="field">
          <label for="occurredAt">When - optional</label>
          <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} disabled={recording} />
        </div>
      </div>

      <div class="field">
        <label for="contactId">Related person - optional</label>
        <select id="contactId" name="contactId" bind:value={contactId} disabled={recording}>
          <option value="">General deal note</option>
          {#each data.people as person}
            <option value={person.id}>{person.name}{person.company ? ` - ${person.company}` : ''}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="text">Deal note</label>

        <div class="voice-row">
          {#if !recording}
            <button type="button" class="btn" on:click={startRecording} disabled={transcribing || saving}>
              <span>🎤 Start recording</span>
            </button>
          {:else if isMobile}
            <span class="inline-wait"><span class="spinner" aria-hidden="true"></span><span>Recording... use the Stop overlay</span></span>
          {:else}
            <button type="button" class="btn" on:click={stopRecording} disabled={saving}>⏹ Stop</button>
          {/if}

          {#if transcribing}
            <span class="inline-wait"><span class="spinner" aria-hidden="true"></span><span>Transcribing...</span></span>
          {/if}
        </div>

        <textarea id="text" name="text" rows="9" bind:value={text} disabled={recording}></textarea>
      </div>

      {#if transcript}
        <p class="muted">Transcript captured from voice.</p>
      {/if}

      {#if summary}
        <div class="summary-box">
          <h2>AI summary</h2>
          <pre>{summary}</pre>
        </div>
      {/if}

      <div class="button-row">
        <button type="button" class="btn" on:click={summarize} disabled={summarizing || recording || saving}>
          {#if summarizing}<span class="spinner" aria-hidden="true"></span><span>Summarizing...</span>{:else}<span>✨ Summarize</span>{/if}
        </button>

        <button class="btn primary" formaction="?/save" formmethod="post" disabled={saving || transcribing || recording}>
          {#if saving}<span class="spinner" aria-hidden="true"></span><span>Saving...</span>{:else}<span>Save note</span>{/if}
        </button>

        <button type="button" class="btn" on:click={handleCancel}>Cancel</button>
      </div>
    </form>

    {#if form?.error}
      <p class="error-text">{form.error}</p>
    {/if}
  </div>
</div>

<RecordingGuard
  visible={recording || transcribing}
  holdMs={600}
  mobileOnly={true}
  diameterPx={120}
  transcribing={transcribing}
  on:stop={stopRecording}
/>

<style>
  .note-card { padding: 20px; max-width: 840px; margin: 0 auto; }
  h1 { margin: 0 0 6px; }
  h2 { margin: 0 0 8px; font-size: 1.05rem; }
  .top-meta { margin-bottom: 14px; }
  .muted { color: var(--muted); }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .field { margin: 12px 0; }
  label { display: block; margin-bottom: 6px; }
  textarea, input, select { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font: inherit; }
  textarea { resize: vertical; }
  .voice-row, .button-row, .inline-wait { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .voice-row { margin-bottom: 8px; }
  .button-row { margin-top: 12px; }
  .summary-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 12px; background: var(--panel); }
  .summary-box pre { white-space: pre-wrap; margin: 0; font-family: inherit; }
  .error-text { color: var(--danger); margin-top: 12px; }
  .spinner { width: 16px; height: 16px; border-radius: 9999px; border: 2px solid var(--border); border-top-color: var(--accent); display: inline-block; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 760px) { .grid.two { grid-template-columns: 1fr; } }
</style>
