<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE:
  // - New note UI with voice record, summarize, and save.
  // - Uses lower-quality constraints and 1s timeslice to keep files small and reliable.
  // - Uploads audio in sequential chunks to avoid server body size limits.
  // - Parses final server response (transcript) and appends to the note.
  //
  // NOTES:
  // - This file is client-side only. Server must implement /api/upload-chunk
  //   which accepts raw chunk bytes with query params: key, index, last.
  // - The final chunk request should trigger assembly + transcription and
  //   return JSON { transcript: "..." }.

  export let form;

  // Form fields restored from a failed submit or default values.
  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Recording state
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null;
  let recording = false;
  let transcript = "";

  // UI busy flags
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // -----------------------
  // Audio helpers
  // -----------------------

  // Choose recorder mime by browser capability
  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus"; // best for Chrome/Android
    const fallback = "audio/mp4";               // Safari iOS often uses mp4
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) {
      return preferred;
    }
    return fallback;
  }

  // Map mime type to a sensible file extension for naming
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

  // Minimal UUID v4 generator - replace with a proper lib if preferred
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // -----------------------
  // Chunked uploader
  // -----------------------
  // CHUNK_SIZE should be comfortably under the server body limit (512KB).
  const CHUNK_SIZE = 480 * 1024; // 256 KB

  // Upload a Blob or File in sequential chunks to /api/upload-chunk?key=...&index=...&last=...
  // The server is expected to return the transcript JSON in the final chunk response.
  async function uploadInChunks(blobOrFile: Blob | File) {
    const key = uuidv4();
    const total = blobOrFile.size;
    let offset = 0;
    let index = 0;
    let lastResponse: any = null;

    while (offset < total) {
      const end = Math.min(offset + CHUNK_SIZE, total);
      const slice = blobOrFile.slice(offset, end);
      const isLast = end >= total;

      // Convert slice to raw bytes
      const body = await slice.arrayBuffer();

      const params = new URLSearchParams({
        key,
        index: String(index),
        last: isLast ? "1" : "0"
      });

      // Send raw bytes as application/octet-stream to keep request small
      const resp = await fetch(`/api/upload-chunk?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body
      });

      // If a chunk upload fails, throw with a helpful message
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`Chunk upload failed index=${index} status=${resp.status} body=${errBody}`);
      }

      // Parse json for the last chunk - server should return transcript here
      if (isLast) {
        // capture the final response body (should include { transcript })
        lastResponse = await resp.json().catch(() => ({}));
      }

      // Advance
      offset = end;
      index += 1;
    }

    // Return final response from the server (may include transcript)
    return lastResponse;
  }

  // -----------------------
  // Recorder lifecycle
  // -----------------------

  // Start microphone capture and record into memory.
  async function startRecording() {
    try {
      // Request mic access with quality-reducing constraints to shrink file size.
      // Browsers may treat these as hints. channelCount:1 is commonly applied.
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,        // mono
          sampleRate: 16000,      // 16 kHz - good for speech
          sampleSize: 16,         // 16-bit
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

      // Collect data as it becomes available - with timeslice this fires roughly every second.
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // Only set UI state to recording when the recorder actually starts.
      mediaRecorder.onstart = () => {
        recording = true;
      };

      // If an error occurs, reset state and close streams.
      mediaRecorder.onerror = (err: any) => {
        // reflect actual recorder state
        recording = false;
        transcribing = false;
        try { currentStream?.getTracks().forEach((t) => t.stop()); } catch {}
        currentStream = null;
        console.error("MediaRecorder error", err);
      };

      // When recording stops we assemble chunks, upload in chunks to server, and set transcript.
      mediaRecorder.onstop = async () => {
        // ensure UI reflects recorder stopped
        recording = false;
        try {
          transcribing = true;

          if (!chunks.length) {
            // nothing captured
            return;
          }

          // Build a blob using the first chunk's type where possible
          const firstType = (chunks[0] as any)?.type || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: firstType });

          if (!blob.size) return;

          // Name file extension sensibly for server-side assembly (server may ignore the name)
          const ext = extFromMime(blob.type || "");
          const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || firstType });

          // Upload in chunks to the server which will assemble + transcribe on final chunk
          const finalResp = await uploadInChunks(fileForUpload);

          // Server should return { transcript } when last chunk is processed
          const extracted = (finalResp?.transcript || finalResp?.text || "").trim();
          if (extracted) {
            transcript = extracted;
            text = text ? `${text} ${extracted}` : extracted;
          } else if (finalResp && finalResp.error) {
            // surface server error to console during testing
            console.error("Transcription server error:", finalResp);
          }
        } catch (err) {
          console.error("Chunked upload/transcribe failed", err);
        } finally {
          transcribing = false;
          // Always stop mic tracks so the browser mic indicator turns off.
          try { currentStream?.getTracks().forEach((t) => t.stop()); } catch {}
          currentStream = null;
        }
      };

      // timeslice = 1000ms ensures ondataavailable fires periodically - improves long recording reliability
      mediaRecorder.start(1000);
    } catch (err) {
      // ensure we clean up on failure
      try { currentStream?.getTracks().forEach((t) => t.stop()); } catch {}
      currentStream = null;
      mediaRecorder = null;
      recording = false;
      console.error("startRecording error", err);
    }
  }

  // Stop recording - only call stop if recorder is actually recording
  function stopRecording() {
    const state = mediaRecorder?.state;
    if (state !== "recording") return;
    transcribing = true; // immediate feedback while onstop work runs
    try {
      mediaRecorder?.stop();
    } catch (err) {
      transcribing = false;
      console.error("stopRecording error", err);
    }
  }

  // -----------------------
  // Summarize and submit
  // -----------------------

  // Ask summarize endpoint to summarize current notes and suggest tags.
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

  // When the form submits to ?/save we flip saving=true for a spinner on the button.
  function handleSubmit() {
    saving = true;
    // No preventDefault - we want the normal navigation to occur.
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:800px; margin:0 auto;">
    <h1>Add note</h1>

    <!-- Hidden fields carry AI output to the server -->
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

        <!-- Voice controls row -->
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

          <!-- Live feedback while audio is being transcribed -->
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
  /* Small, theme-friendly spinner that uses your CSS vars */
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
