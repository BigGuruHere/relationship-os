<!-- src/routes/contacts/[id]/interactions/new/+page.svelte -->
<script lang="ts">
  // PURPOSE: New note UI with voice record, summarize, and save.
  // Adds debug instrumentation for recorder so we can see why long notes fail.

  // Svelte action data from server - may include draft on error.
  export let form;

  // Form fields restored from a failed submit or default values.
  let text = form?.draft?.text ?? "";
  let channel = form?.draft?.channel ?? "note";
  let occurredAt = form?.draft?.occurredAt ?? "";
  let summary = form?.draft?.summary ?? "";
  let tags = form?.draft?.tags?.join(", ") ?? "";

  // Voice recording state.
  let mediaRecorder: MediaRecorder | null = null;
  let currentStream: MediaStream | null = null; // track active mic stream so we can stop tracks
  let recording = false;
  let transcript = "";

  // UI busy flags.
  let transcribing = false;
  let summarizing = false;
  let saving = false;

  // Debug state - visible on screen and in console.
  let debugEnabled = true;                    // set to false to hide panel
  let debug: string[] = [];                   // rolling log
  let lastBlobInfo: { type: string; size: number } | null = null;

  // Helper to push a debug line and also console.log it.
  function logDebug(msg: string, data?: unknown) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}` + (data ? ` ${JSON.stringify(data)}` : "");
    debug = [line, ...debug].slice(0, 20);    // keep last 20 lines
    // Also print to console for deeper inspection
    if (data !== undefined) {
      console.log(msg, data);
    } else {
      console.log(msg);
    }
  }

  // Pick a recorder mime that works cross browser.
  function pickRecorderMime(): string {
    const preferred = "audio/webm;codecs=opus";  // Chrome
    const fallback = "audio/mp4";                // Safari iOS
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(preferred)) {
      return preferred;
    }
    return fallback;
  }

  // Map a mime type to a sensible file extension so Whisper sees a correct filename.
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

  // Start microphone capture and record into memory.
  async function startRecording() {
    try {
      // Request mic with size-reducing constraints - browsers may treat these as hints.
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,        // mono - halves data vs stereo
          sampleRate: 16000,      // 16 kHz - good for speech
          sampleSize: 16,         // 16-bit samples
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      };
      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      logDebug("getUserMedia ok", { tracks: currentStream.getTracks().length });

      const mimeType = pickRecorderMime();
      mediaRecorder = new MediaRecorder(currentStream, { mimeType });
      logDebug("MediaRecorder created", { mimeType });

      const chunks: BlobPart[] = [];

      // Emit data every second - prevents huge single chunk, keeps session alive on iOS.
      mediaRecorder.ondataavailable = (e) => {
        logDebug("ondataavailable", { size: e.data?.size || 0, type: e.data?.type || "" });
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstart = () => logDebug("onstart");
      mediaRecorder.onpause = () => logDebug("onpause");
      mediaRecorder.onresume = () => logDebug("onresume");
      mediaRecorder.onerror = (err: any) => logDebug("onerror", { name: err?.name, message: err?.message });

      // When recording stops we will send audio to the server for transcription.
      mediaRecorder.onstop = async () => {
        logDebug("onstop", { chunkCount: chunks.length });
        try {
          transcribing = true; // show spinner while we wait

          // If no chunks were produced, surface that explicitly and bail.
          if (!chunks.length) {
            logDebug("no chunks - nothing to transcribe");
            return;
          }

          // Build a blob with the same type the recorder produced.
          const firstType = (chunks[0] as any)?.type || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: firstType });
          lastBlobInfo = { type: blob.type || firstType, size: blob.size || 0 };
          logDebug("built blob", lastBlobInfo);

          if (!blob.size) {
            logDebug("blob has zero size - aborting upload");
            return;
          }

          // Wrap in a File so name and type travel together.
          const ext = extFromMime(blob.type || "");
          const fileForUpload = new File([blob], `note.${ext}`, { type: blob.type || firstType });

          // Build the request body expected by the API route.
          const fd = new FormData();
          fd.append("file", fileForUpload); // field must be "file"

          // Call your server endpoint which calls Whisper.
          const resp = await fetch("/api/transcribe", { method: "POST", body: fd });

          // Try to parse JSON even on non 2xx to surface errors during testing.
          const data = await resp.json().catch(() => ({} as any));
          logDebug("transcribe response", { ok: resp.ok, status: resp.status, keys: Object.keys(data || {}) });

          // Support either { transcript } or { text } shapes.
          transcript = (data.transcript || data.text || "").trim();

          // Append the transcript to any typed text instead of overwriting.
          if (transcript) {
            text = text ? `${text} ${transcript}` : transcript;
          }
        } catch (err) {
          logDebug("Transcribe failed", { message: (err as any)?.message || String(err) });
        } finally {
          transcribing = false;
          // Always stop mic tracks so the browser mic indicator turns off.
          currentStream?.getTracks().forEach((t) => t.stop());
          currentStream = null;
        }
      };

      // Start with a 1s timeslice so ondataavailable fires periodically.
      mediaRecorder.start(1000);
      recording = true;
      logDebug("mediaRecorder.start(1000)");
    } catch (err) {
      logDebug("startRecording error", { message: (err as any)?.message || String(err) });
      // Clean up any partially opened stream
      currentStream?.getTracks().forEach((t) => t.stop());
      currentStream = null;
      mediaRecorder = null;
      recording = false;
    }
  }

  // Stop recording - triggers onstop which starts transcription.
  function stopRecording() {
    if (!recording) return;
    recording = false;
    transcribing = true;        // immediate feedback in UI
    try {
      mediaRecorder?.stop();
      logDebug("mediaRecorder.stop called");
    } catch (err) {
      logDebug("stopRecording error", { message: (err as any)?.message || String(err) });
      transcribing = false;
    }
  }

  // Ask your summarize endpoint to summarize current notes and suggest tags.
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
        logDebug("summarize non 2xx", { status: resp.status, error: data?.error });
        return;
      }

      summary = (data.summary || "").trim();
      tags = Array.isArray(data.tags) ? data.tags.join(", ") : (tags || "");
    } catch (err) {
      logDebug("summarize error", { message: (err as any)?.message || String(err) });
    } finally {
      summarizing = false;
    }
  }

  // When the form submits to ?/save we flip saving=true for a spinner on the button.
  function handleSubmit() {
    saving = true;
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

    {#if debugEnabled}
      <div class="card" style="padding:12px; margin-top:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <strong>Recorder debug</strong>
          <label style="font-size:0.9rem;">
            <input type="checkbox" bind:checked={debugEnabled} />
            Show
          </label>
        </div>
        <div style="margin:8px 0; color:var(--muted); font-size:0.9rem;">
          Last blob: {lastBlobInfo ? `${lastBlobInfo.type} - ${(lastBlobInfo.size/1024).toFixed(1)} KB` : "none"}
        </div>
        <pre style="white-space:pre-wrap; max-height:180px; overflow:auto; font-size:0.85rem; background:var(--surface-muted); padding:8px; border-radius:8px;">
{debug.join("\n")}
        </pre>
      </div>
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

  /* Inline wait indicator layout */
  .inline-wait {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .muted { color: var(--muted); }
</style>
