<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE:
  // - New note UI with voice record, summarize, and save.
  // - Lower quality constraints and 1s timeslice keep files small and reliable.
  // - Chunked upload avoids body size limits.
  // - Async server job returns a jobId, client polls for result, so UX is snappy.
  //
  // All IT code is commented. No decryption on client.

  export let form;

  // Form fields
  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Recorder state
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = "";

  // UI flags
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // Choose recorder mime by capability
  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus"; // Chrome or Android
    const fallback = "audio/mp4";               // iOS Safari often uses mp4
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) return preferred;
    return fallback;
  }

  // Map mime to a friendly extension for naming
  function extFromMime(mime: string): string {
    if (!mime) return "webm";
    const m = mime.toLowerCase();
    if (m.includes("webm")) return "webm";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("m4a")) return "m4a";
    if (m.includes("wav")) return "wav";
    if (m.includes("ogg")) return "ogg";
    if (m.includes("mpeg")) return "mp3";
    return "webm";
  }

  // Minimal uuid v4
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // -----------------------
  // Chunked upload + async job
  // -----------------------

  // Use a chunk size under the 512 KB server limit to reduce request count
  const CHUNK_SIZE = 480 * 1024; // 384 KB

  // Upload a Blob or File in sequential chunks to /api/upload-chunk
  // The server assembles and queues transcription and responds with { jobId } on the last chunk.
  async function uploadInChunks(blobOrFile: Blob | File): Promise<{ jobId: string }> {
    const key = uuidv4(); // unique assembly key on server
    const total = blobOrFile.size;
    let offset = 0;
    let index = 0;
    let finalJob: string | null = null;

    while (offset < total) {
      const end = Math.min(offset + CHUNK_SIZE, total);
      const slice = blobOrFile.slice(offset, end);
      const isLast = end >= total;

      const body = await slice.arrayBuffer();

      const params = new URLSearchParams({
        key,
        index: String(index),
        last: isLast ? "1" : "0"
      });

      const resp = await fetch(`/api/echo-bytes?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Chunk upload failed index=${index} status=${resp.status} body=${errText}`);
      }

      // On the last chunk, server returns { jobId }
      if (isLast) {
        const data = await resp.json().catch(() => ({} as any));
        finalJob = data?.jobId || null;
      }

      offset = end;
      index += 1;
    }

    if (!finalJob) throw new Error("No jobId returned from server");
    return { jobId: finalJob };
  }

  // Poll for the transcription result until done or timeout
  async function pollResult(jobId: string, intervalMs = 1500, timeoutMs = 120000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await fetch(`/api/transcribe-result?jobId=${encodeURIComponent(jobId)}`);
      if (!r.ok) throw new Error(`Polling failed status=${r.status}`);
      const body = await r.json().catch(() => ({} as any));
      if (body.status === "done" && typeof body.transcript === "string") return body.transcript;
      if (body.status === "error") throw new Error(body.error || "Transcription error");
      await new Promise(res => setTimeout(res, intervalMs));
    }
    throw new Error("Polling timed out");
  }

  // -----------------------
  // Recorder lifecycle
  // -----------------------

  async function startRecording() {
    try {
      // Lower quality to shrink files - browsers may treat as hints
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

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstart = () => {
        recording = true;
      };

      mediaRecorder.onerror = () => {
        recording = false;
        transcribing = false;
        currentStream?.getTracks().forEach(t => t.stop());
        currentStream = null;
      };

      mediaRecorder.onstop = async () => {
        recording = false;
        try {
          transcribing = true;

          if (!chunks.length) return;

          const firstType = (chunks[0] as any)?.type || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: firstType });
          if (!blob.size) return;

          const ext = extFromMime(blob.type || "");
          const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || firstType });

          // Upload in chunks - server will return { jobId } on the final chunk
          const { jobId } = await uploadInChunks(fileForUpload);

          // Poll for job result without blocking UI thread
          const result = await pollResult(jobId);
          const extracted = (result || "").trim();
          if (extracted) {
            transcript = extracted;
            text = text ? `${text} ${extracted}` : extracted;
          }
        } catch (err) {
          // Optional: surface to UI
          console.error("Transcribe pipeline failed", err);
        } finally {
          transcribing = false;
          currentStream?.getTracks().forEach(t => t.stop());
          currentStream = null;
        }
      };

      // 1s timeslice - improves reliability for long recordings
      mediaRecorder.start(1000);
    } catch (err) {
      currentStream?.getTracks().forEach(t => t.stop());
      currentStream = null;
      mediaRecorder = null;
      recording = false;
      console.error("startRecording error", err);
    }
  }

  function stopRecording() {
    const state = mediaRecorder?.state;
    if (state !== "recording") return;
    transcribing = true;
    try {
      mediaRecorder?.stop();
    } catch (err) {
      transcribing = false;
      console.error("stopRecording error", err);
    }
  }

  // Summarize
  async function summarize() {
    try {
      summarizing = true;
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        console.error("Summarize failed", data?.error || "Unknown error");
        return;
      }
      summary = (data.summary || "").trim();
      tags = Array.isArray(data.tags) ? data.tags.join(", ") : (tags || "");
    } catch (err) {
      console.error("Summarize failed", err);
    } finally {
      summarizing = false;
    }
  }

  function handleSubmit() {
    saving = true;
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1>Add note</h1>

    <form method="post" on:submit={handleSubmit}>
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="tagsSource" value="ai" />

      <div class="field">
        <label for="channel">Channel</label>
        <select id="channel" name="channel" bind:value={channel}>
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="message">Message</option>
        </select>
      </div>

      <div class="field">
        <label for="occurredAt">When - optional</label>
        <input id="occurredAt" name="occurredAt" type="datetime-local" bind:value={occurredAt} />
      </div>

      <div class="field">
        <label for="text">Your note</label>

        <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
          {#if !recording}
            <button type="button" class="btn" on:click={startRecording} disabled={transcribing || saving}>
              {#if transcribing}
                <span class="spinner" aria-hidden="true"></span>
                <span>Preparing mic...</span>
              {:else}
                <span>🎤 Start Recording</span>
              {/if}
            </button>
          {:else}
            <button type="button" class="btn" on:click={stopRecording} disabled={saving}>
              ⏹ Stop
            </button>
          {/if}

          {#if transcribing}
            <span class="inline-wait">
              <span class="spinner" aria-hidden="true"></span>
              <span>Transcribing...</span>
            </span>
          {/if}
        </div>

        <textarea id="text" name="text" rows="8" bind:value={text}></textarea>
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

        <a class="btn" href="..">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

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
</style>
