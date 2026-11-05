<!-- Shared CRM / My People note capture -->
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
  // - Audio is transient; owner-visible drafts and transcripts are never logged.

  export let form: any;
  export let data: any;
  export let privateMode = false;
  export let contactBase = '/contacts';
  export let audioBase = '/api';

  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto, beforeNavigate } from '$app/navigation';
  import RecordingGuard from '$lib/recording/RecordingGuard.svelte';
  import type { TranscriptionStage } from '$lib/recording/transcriptionMetadata';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

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
  let starting = false;
  let transcript = '';
  let recordingError = '';
  let uploadQueue: Promise<void> = Promise.resolve();
  let disposed = false;
  let recordingMime = 'audio/webm';
  let recordingStartedAt = 0;
  let durationMs = 0;
  function diagnose(stage: TranscriptionStage, metadata: Record<string, unknown> = {}) {
    if (!data.transcriptionDebug || !uploadKey) return;
    // Best effort only: telemetry must never delay or fail recording/upload/save.
    void fetch(`${audioBase}/transcription-diagnostics`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage, correlationId: uploadKey, clientTimestampMs: Date.now(), ...metadata }) }).catch(() => {});
  }

  // Upload streaming state
  let uploadKey = '';   // server assembly key used to collect chunks
  let nextIndex = 0;    // sequential index for each chunk

  // UI flags
  let transcribing = false;
  let summarizing = false;
  let summaryError = '';
  let saving = false;

  // Device heuristic so desktop keeps inline controls
  let isMobile = false;
  function detectMobile(): boolean {
    if (!browser) return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const narrow = window.matchMedia?.('(max-width: 900px)')?.matches ?? false;
    return coarse || narrow;
  }

  beforeNavigate(() => { disposed = true; hardStopRecording(); });

  onMount(() => {
    isMobile = detectMobile();

    // Safety - stop recording if navigating away


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
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  onDestroy(() => {
    disposed = true;
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
      summaryError = '';

      const input = String(text || '').trim();
      if (!input) {
        console.warn('[summarize] no text to summarize');
        return;
      }

      const resp = await fetch(privateMode ? `${contactBase}/${data.contact.id}/notes/summarize` : '/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      });

      let responseData: any = {};
      try {
        responseData = await resp.json();
      } catch {
        summaryError = 'Summary unavailable. Your note is unchanged.';
        return;
      }

      if (!resp.ok) {
        summaryError = 'Summary unavailable. You can still save your note without it.';
        return;
      }

      if (privateMode && input !== String(text || '').trim()) { summaryError = 'Your note changed. Summarise again to use the updated text.'; return; }
      summary = typeof responseData.summary === 'string' ? responseData.summary : '';

      if (Array.isArray(responseData.tags) && responseData.tags.length > 0) {
        tags = responseData.tags.map((t: any) => String(t || '')).filter(Boolean).join(', ');
      } else if (Array.isArray(responseData.suggestedTags)) {
        const names = responseData.suggestedTags.map((t: any) => String(t?.name || '')).filter(Boolean);
        if (names.length > 0) tags = names.join(', ');
      }
    } catch (err) {
      summaryError = 'Summary unavailable. Your note is unchanged.';
    } finally {
      summarizing = false;
    }
  }

  // -----------------------
  // Transcription helpers
  // -----------------------

  async function uploadChunk(key: string, index: number, last: boolean, bytes: Uint8Array) {
    const qs = new URLSearchParams({ key, index: String(index), last: last ? '1' : '0', mime: recordingMime });
    const uploadStarted = performance.now();
    const res = await fetch(`${audioBase}/upload-chunk?${qs.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      // IT: fetch accepts an ArrayBuffer BodyInit; the recorder always supplies browser ArrayBuffers.
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {}
    if (last || !res.ok) diagnose('browser.upload_complete', { httpStatus: res.status, chunkCount: index + 1, uploadComplete: res.status === 202, durationMs, elapsedMs: performance.now() - uploadStarted });
    return { status: res.status, data };
  }

  async function pollResult(jobId: string): Promise<string> {
    if (!jobId) throw new Error('No jobId to poll');

    for (let i = 0; i < 60; i++) {
      if (disposed) throw new Error('Recording page closed');
      const res = await fetch(`${audioBase}/transcribe-result?jobId=${encodeURIComponent(jobId)}&correlationId=${encodeURIComponent(uploadKey)}`);
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok && data?.status === 'done') {
        const result = String(data.transcript || '');
        if (!result.trim()) throw new Error('Empty transcription');
        diagnose('browser.result_received', { httpStatus: res.status, characterCount: result.length, emptyContent: !result.length });
        return result;
      }
      if (!res.ok || data?.status === 'error') {
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
    if (starting || recording || transcribing || disposed) return;
    starting = true;
    uploadKey = crypto.randomUUID();
    durationMs = 0;
    diagnose('browser.microphone_requested');
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
      // Permission may resolve after navigation. Never leave an unmounted microphone running.
      if (disposed) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; return; }

      recordingError = '';
      uploadQueue = Promise.resolve();
      const mimeType = pickRecorderMime();
      recordingMime = mimeType.startsWith('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      mediaRecorder = new MediaRecorder(currentStream, { mimeType });

      // Initialize streaming state
      nextIndex = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0 || disposed) return;
        diagnose('browser.chunk_ready', { chunkBytes: e.data.size, mimeType: e.data.type, durationMs: performance.now() - recordingStartedAt });
        // Serialize async Blob reads/uploads. The final flush must follow the final dataavailable event.
        uploadQueue = uploadQueue.then(async () => {
          const full = new Uint8Array(await e.data.arrayBuffer());
          for (let o = 0; o < full.length; o += 256 * 1024) {
            if (disposed) return;
            const { status, data } = await uploadChunk(uploadKey, nextIndex++, false, full.subarray(o, o + 256 * 1024));
            if (status < 200 || status >= 300 || data?.ok !== true) throw new Error('Audio upload failed. Please retry.');
          }
        });
        // Keep rejection observable by onstop without an unhandled promise rejection during recording.
        void uploadQueue.catch(() => {});
      };

      mediaRecorder.onstart = () => {
        recordingStartedAt = performance.now();
        let settings: MediaTrackSettings | undefined;
        // Some older browsers do not expose track settings. Diagnostics must not affect recording.
        if (data.transcriptionDebug) { try { settings = currentStream?.getAudioTracks()[0]?.getSettings?.(); } catch {} }
        diagnose('browser.record_start', { mimeType: mediaRecorder?.mimeType, codec: mediaRecorder?.mimeType.includes('opus') ? 'opus' : mediaRecorder?.mimeType.includes('mp4a') ? 'aac' : 'unknown', sampleRate: settings?.sampleRate, channelCount: settings?.channelCount });
        recording = true;
      };

      mediaRecorder.onerror = () => {
        diagnose('browser.error');
        recording = false;
        transcribing = false;
        recordingError = 'Recording failed. Your existing text is still here; please retry.';
        currentStream?.getTracks().forEach((t) => t.stop());
        currentStream = null;
      };

      mediaRecorder.onstop = async () => {
        if (disposed) return;
        recording = false;
        durationMs = performance.now() - recordingStartedAt;
        diagnose('browser.record_stop', { durationMs });
        // Guard might still be visible on mobile - switch to transcribing state there
        transcribing = true;
        try {
          await uploadQueue;
          if (disposed) return;
          const { status, data } = await uploadChunk(uploadKey, nextIndex, true, new Uint8Array());
          if (status !== 202 || !data?.jobId) throw new Error('No jobId from server on last');

          const jobId: string = String(data.jobId);
          const t = await pollResult(jobId);

          if (disposed) return;
          channel = 'voice note';
          transcript = t;
          text = text ? text + '\n' + t : t;
          diagnose('browser.ui_applied', { characterCount: t.length, emptyContent: !t.length });
        } catch (err) {
          diagnose('browser.error');
          recordingError = 'Transcription failed. Your existing text is still here; retry recording or type your note.';
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
      diagnose('browser.error');
      recordingError = 'Microphone unavailable. Allow microphone access and use a secure connection, or type your note.';
    } finally { starting = false; }
  }

  function stopRecording() {
    const state = mediaRecorder?.state;
    if (state !== 'recording') return;
    try {
      mediaRecorder?.stop();
      currentStream?.getTracks().forEach(t => t.stop());
    } catch (err) {
      diagnose('browser.error');
      console.error('[transcription] recording stop failed');
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

  // Keep a private draft visible when navigation/save fails, including a lost network response.
  function enhancePrivate(node: HTMLFormElement) {
    if (!privateMode || !data.foundation) return;
    return enhance(node, () => {
      saving = true;
      return async ({ result, update }) => {
        try {
          if (result.type === 'error') {
            form = { error: 'Could not save your note. Your text is still here; please retry.', draft: { text, summary, channel, saveKey: form?.draft?.saveKey ?? data.saveKey } };
          } else await update({ reset: false });
        } finally { saving = false; }
      };
    });
  }
  function handleSubmit() {
    saving = true;
  }

  async function handleCancel() {
    // Ensure recording is stopped before navigating away
    hardStopRecording();
    await goto(contactBase + '/' + data.contact.id);
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1 style="margin:0 0 6px 0;">Add note</h1>
    <div style="margin:0 0 12px 0; color:#666;">
      for <a href={contactBase + "/" + data.contact.id} class="link">{data.contact.name}</a>
    </div>
    {#if data.transcriptionDebug && uploadKey}<p class="muted">Transcription diagnostic reference: {uploadKey}</p>{/if}
    <form method="post" use:enhancePrivate on:submit={handleSubmit}>
      {#if data.foundation}<input type="hidden" name="saveKey" value={form?.draft?.saveKey ?? data.saveKey}/>{/if}
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="tagsSource" value="ai" />

      {#if !privateMode}<div class="field">
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
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} disabled={recording} on:change={closeDatePickerOnChange} />
      </div>

      {:else}<input type="hidden" name="channel" value={channel}/>{/if}
      <div class="field">
        <label for="text">Your note</label>

        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          {#if !recording}
            <button type="button" class="btn" on:click={startRecording} disabled={starting || transcribing || saving}>
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
          {#if privateMode}<label for="note-summary">Summary (editable)</label><textarea id="note-summary" rows="5" bind:value={summary}></textarea>
          {:else}<pre style="white-space:pre-wrap;">{summary}</pre><p style="margin-top:6px;">Tags: {tags}</p>{/if}
        </div>
      {/if}

      {#if !privateMode}
      <!-- IT: CRM storage and Living Understanding eligibility are independent. -->
      <div class="field" style="margin-top:12px;">
        <label style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" name="luAdmission" value="ELIGIBLE" />
          Use this note for Living Understanding review
        </label>
        <p class="muted">Off by default. The note is kept in your CRM either way. Enabling this permits a future understanding proposal; it does not approve or share anything.</p>
      </div>
      {/if}
      {#if privateMode}<p class="muted">Your private observation. Review and edit the text, then save. Audio is sent for transcription; no account, connection or Living Understanding is created.</p>{/if}
      {#if privateMode}<p class="muted">Optional: Summarize sends this note to the AI provider. Review the summary before saving; it is not shared or added to Living Understanding.</p>{/if}
      {#if summaryError}<p role="alert">{summaryError}</p>{/if}
      {#if recordingError}<p role="alert">{recordingError}</p>{/if}
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn" on:click={summarize} disabled={summarizing || recording || transcribing || saving || !text.trim()}>
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
          disabled={saving || starting || transcribing || recording || summarizing}
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
